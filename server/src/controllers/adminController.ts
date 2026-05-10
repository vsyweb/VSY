import { Request, Response } from 'express';
import { Booking } from '../models/Booking';
import { BlockedSlot } from '../models/BlockedSlot';
import { PricingRule } from '../models/PricingRule';
import { User } from '../models/User';
import { isValidDate, isValidHour } from '../utils/helpers';
import { TurfId } from '../types';
import mongoose from 'mongoose';

/**
 * Helper to calculate price for a slot based on rules or fallback.
 */
const calculatePrice = (slot: { turfId: string; date: string; startHour: number }, rules: any[]) => {
  const isWeekend = (() => {
    const date = new Date(slot.date + 'T00:00:00');
    const day = date.getDay();
    return day === 0 || day === 5 || day === 6;
  })();
  const dayType = isWeekend ? 'weekend' : 'weekday';

  const matchingRule = rules.find(r =>
    r.turfId === slot.turfId &&
    r.dayType === dayType &&
    (r.startHour <= r.endHour
      ? (slot.startHour >= r.startHour && slot.startHour < r.endHour)
      : (slot.startHour >= r.startHour || slot.startHour < r.endHour))
  );

  if (matchingRule) return matchingRule.price;

  // Fallback pricing matching pricingService.ts
  const isDaytime = slot.startHour >= 6 && slot.startHour < 18;
  if (slot.turfId === 'A') {
    return isWeekend ? (isDaytime ? 900 : 1000) : (isDaytime ? 800 : 700);
  } else {
    return isWeekend ? (isDaytime ? 900 : 1000) : (isDaytime ? 900 : 800);
  }
};

/**
 * Get all bookings with optional filters.
 */
export const getAllBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, turfId, status, search, page = '1', limit = '8' } = req.query;

    // Cleanup expired pending bookings globally
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    await Booking.updateMany(
      { status: 'pending', createdAt: { $lt: fiveMinsAgo } },
      { $set: { status: 'cancelled' } }
    );

    const filter: any = {};
    if (date && typeof date === 'string') filter.date = date;
    if (turfId && typeof turfId === 'string') filter.turfId = turfId;
    if (status && typeof status === 'string') filter.status = status;

    // Add search mapping for User references
    if (search && typeof search === 'string' && search.trim() !== '') {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      if (users.length > 0) {
        filter.userId = { $in: users.map(u => u._id) };
      } else {
        // If users not found, maybe search was for something else, but here we enforce user search
        filter.userId = null; // Forces empty result if no user matched
      }
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));

    // Fetch Bookings
    const [bookings, totalBookings] = await Promise.all([
      Booking.find(filter)
        .populate('userId', 'phone name')
        .sort({ date: 1, startHour: 1 }) // Better sort for admin view
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Booking.countDocuments(filter),
    ]);

    // If status is empty or 'blocked', we might want to include BlockedSlots
    let extraRecords: any[] = [];
    if (!status || status === 'blocked') {
      const blockedFilter: any = {};
      if (date && typeof date === 'string') blockedFilter.date = date;
      if (turfId && typeof turfId === 'string') blockedFilter.turfId = turfId;

      if (search && typeof search === 'string' && search.trim() !== '') {
        blockedFilter.$or = [
          { customerName: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } },
          { reason: { $regex: search, $options: 'i' } }
        ];
      }

      const [blockedSlots, pricingRules] = await Promise.all([
        BlockedSlot.find(blockedFilter).populate('blockedBy', 'name').lean(),
        PricingRule.find({ isActive: true }).lean()
      ]);

      // Transform blocked slots to look like bookings
      extraRecords = blockedSlots.map(bs => {
        const price = calculatePrice(bs, pricingRules);

        // Try to get customer info from explicit fields or extract from reason field
        let resolvedName = bs.customerName || '';
        let resolvedPhone = bs.phoneNumber || '';

        // Extract name from old-style "Walk-in: [Name]" reason field
        if (!resolvedName && bs.reason && bs.reason.startsWith('Walk-in: ')) {
          resolvedName = bs.reason.replace('Walk-in: ', '').trim();
        }

        const hasCustomerInfo = !!(resolvedName || resolvedPhone);

        return {
          ...bs,
          status: 'blocked',
          userId: hasCustomerInfo
            ? { name: resolvedName || 'Walk-in Customer', phone: resolvedPhone }
            : null,
          reason: bs.reason,
          totalAmount: price,
          paidAmount: price,
          paymentType: 'full',
          isBlocked: true,
          isAdminBooked: hasCustomerInfo // flag to distinguish from maintenance block
        };
      });
    }

    // Combine and sort (for page 1 simplicity, ideally we'd use aggregation for true combined pagination)
    let combinedResults = [...bookings, ...extraRecords];

    // Sort combined by date and hour ascending
    combinedResults.sort((a, b) => {
      const dateA = a.date + (a.startHour < 10 ? '0' : '') + a.startHour;
      const dateB = b.date + (b.startHour < 10 ? '0' : '') + b.startHour;
      return dateA.localeCompare(dateB);
    });

    res.status(200).json({
      success: true,
      message: 'Bookings retrieved',
      data: {
        bookings: combinedResults,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalBookings + extraRecords.length,
          pages: Math.ceil((totalBookings + extraRecords.length) / limitNum),
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get bookings';
    res.status(500).json({ success: false, message });
  }
};

/**
 * Admin cancel a booking.
 */
export const adminCancelBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    await Booking.updateMany(
      { razorpayOrderId: booking.razorpayOrderId },
      { $set: { status: 'cancelled' } }
    );
    res.status(200).json({ success: true, message: 'Booking cancelled', data: { bookingId: booking._id, status: 'cancelled' } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to cancel' });
  }
};

/**
 * Admin collect remaining cash payment for 'advance' bookings.
 */
export const adminCollectPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    // Collect payment for all bookings under the same order
    await Booking.updateMany(
      { razorpayOrderId: booking.razorpayOrderId },
      [{ $set: { paymentType: 'full', paidAmount: '$totalAmount' } }]
    );
    res.status(200).json({ success: true, message: 'Payment collected', data: { bookingId: booking._id } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to collect' });
  }
};

/**
 * Block a slot (Admin/Walk-in booking).
 */
export const blockSlot = async (req: Request, res: Response): Promise<void> => {
  try {
    const { turfId, date, reason, phoneNumber, customerName, ballType = 'none' } = req.body;
    let { startHour, startHours } = req.body;
    const adminId = req.userId;

    if (startHour !== undefined && !startHours) {
      startHours = [startHour];
    }

    if (!startHours || !Array.isArray(startHours) || startHours.length === 0) {
      res.status(400).json({ success: false, message: 'Invalid start hours' });
      return;
    }

    // Convert to numbers to avoid string concatenation bugs during chunking
    const numericStartHours = startHours.map(Number).sort((a: number, b: number) => a - b);
    
    const chunks: number[][] = [];
    let currentChunk = [numericStartHours[0]];

    for (let i = 1; i < numericStartHours.length; i++) {
      if (numericStartHours[i] === numericStartHours[i - 1] + 1) {
        currentChunk.push(numericStartHours[i]);
      } else {
        chunks.push(currentChunk);
        currentChunk = [numericStartHours[i]];
      }
    }
    chunks.push(currentChunk);

    // If phone number is provided, it's a Walk-in Booking
    if (phoneNumber) {
      let user = await User.findOne({ phone: phoneNumber });
      if (!user) {
        user = await User.create({
          phone: phoneNumber,
          name: customerName || 'Walk-in Customer',
          role: 'user'
        });
      } else if (customerName && !user.name) {
        user.name = customerName;
        await user.save();
      }

      const pricingRules = await PricingRule.find({ isActive: true }).lean();
      const BALL_PRICES: Record<string, number> = { light_tennis: 80, hard_tennis: 100, none: 0 };
      
      const allBookings = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const razorpayOrderId = `WALKIN-${Date.now()}-C${i}`;
        
        for (let j = 0; j < chunk.length; j++) {
          const hour = chunk[j];
          const isFirstBooking = j === 0;
          const currentBallType = isFirstBooking ? ballType : 'none';
          const ballAmount = isFirstBooking ? (BALL_PRICES[ballType] || 0) : 0;
          
          let price = calculatePrice({ turfId, date, startHour: hour }, pricingRules);
          price += ballAmount;

          const booking = await Booking.create({
            userId: user._id,
            turfId,
            date,
            startHour: hour,
            totalAmount: price,
            paidAmount: price,
            paymentType: 'full',
            status: 'confirmed',
            razorpayOrderId,
            razorpayPaymentId: 'CASH_PAYMENT',
            razorpaySignature: 'ADMIN_COLLECTED',
            ballType: currentBallType,
            ballAmount: isFirstBooking ? ballAmount : 0
          });
          allBookings.push(booking);
        }
      }

      res.status(201).json({ success: true, message: 'Walk-in booking created successfully', data: allBookings });
      return;
    }

    // If no phone number, it's a maintenance block
    const allBlocks = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const groupId = `BLOCK-${Date.now()}-C${i}`;
      for (let j = 0; j < chunk.length; j++) {
        const hour = chunk[j];
        const blocked = await BlockedSlot.create({
          turfId,
          date,
          startHour: hour,
          reason: reason || 'Admin Block',
          blockedBy: new mongoose.Types.ObjectId(adminId),
          groupId
        });
        allBlocks.push(blocked);
      }
    }

    res.status(201).json({ success: true, message: 'Slots blocked successfully', data: allBlocks });
  } catch (error) {
    console.error('Block slot error:', error);
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
};

/**
 * Unblock a slot.
 */
export const unblockSlot = async (req: Request, res: Response): Promise<void> => {
  try {
    const { turfId, date, startHour } = req.body;
    await BlockedSlot.deleteOne({ turfId, date, startHour });
    res.status(200).json({ success: true, message: 'Slot unblocked' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to unblock' });
  }
};

/**
 * Get dashboard statistics.
 */
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    // Extract filters
    const { month: qMonth, year: qYear, showAll, date: qDate } = req.query;
    let dateFilter: any = {};
    if (showAll !== 'true') {
      if (qDate && String(qDate).trim() !== '') {
        dateFilter.date = String(qDate);
      } else {
        const filterYear = qYear ? String(qYear) : String(year);
        const filterMonth = qMonth ? String(qMonth).padStart(2, '0') : month;
        dateFilter.date = { $regex: new RegExp(`^${filterYear}-${filterMonth}`) };
      }
    }

    // Fetch stats
    const statsResult = await Promise.all([
      Booking.countDocuments(dateFilter),
      Booking.countDocuments({ status: 'confirmed', ...dateFilter }),
      Booking.countDocuments({ date: today, status: 'confirmed' }), // Today stays strictly today
      User.countDocuments(), // Total users is global
      BlockedSlot.countDocuments(dateFilter),
      BlockedSlot.countDocuments({ date: today }),
      Booking.aggregate([
        { $match: { status: 'confirmed', ...dateFilter } },
        {
          $group: {
            _id: {
              $cond: {
                if: {
                  $in: ['$razorpayPaymentId', ['CASH_PAYMENT', 'MIGRATED_WALKIN', 'ADMIN_COLLECTED']]
                },
                then: 'walkin',
                else: 'online'
              }
            },
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        }
      ]),
      Booking.aggregate([
        { $match: { status: 'confirmed', ...dateFilter } },
        { $group: { _id: '$turfId', total: { $sum: { $subtract: ['$totalAmount', '$ballAmount'] } }, count: { $sum: 1 } } }
      ]),
      Booking.aggregate([
        { $match: { status: 'confirmed', ...dateFilter } },
        { $group: { _id: null, totalBall: { $sum: '$ballAmount' } } }
      ])
    ]);

    const [totalBookings, confirmedBookings, todayBookings, totalUsers, totalBlocked, todayBlocked, revenueResult, turfRevenueResult, ballRevenueResult] = statsResult;

    // Parse revenue and counts result
    let onlineRevenue = 0;
    let walkinRevenue = 0;
    let onlineCount = 0;
    let walkinCount = 0;

    revenueResult.forEach((res: any) => {
      if (res._id === 'walkin') {
        walkinRevenue += res.total;
        walkinCount += res.count;
      } else {
        onlineRevenue += res.total;
        onlineCount += res.count;
      }
    });

    const recentBookings = await Booking.find({ status: 'confirmed' })
      .populate('userId', 'phone name')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const currentHour = new Date().getHours();
    const upcomingBookings = await Booking.find({
      status: 'confirmed',
      $or: [
        { date: { $gt: today } },
        { date: today, startHour: { $gte: currentHour } }
      ]
    })
      .populate('userId', 'phone name')
      .sort({ date: 1, startHour: 1 })
      .limit(5)
      .lean();

    res.status(200).json({
      success: true,
      message: 'Stats retrieved',
      data: {
        totalBookings,
        confirmedBookings,
        todayBookings,
        totalUsers,
        totalRevenue: onlineRevenue + walkinRevenue,
        onlineRevenue,
        walkinRevenue,
        onlineCount,
        walkinCount,
        revenueByTurf: turfRevenueResult,
        totalBallRevenue: ballRevenueResult[0]?.totalBall || 0,
        recentBookings,
        upcomingBookings,
        totalBlocked,
        todayBlocked,
        todayOccupancy: todayBookings + todayBlocked,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
};

/**
 * Get pricing rules.
 */
export const getPricingRules = async (_req: Request, res: Response): Promise<void> => {
  try {
    let rules = await PricingRule.find().sort({ turfId: 1, dayType: 1, startHour: 1 });

    // Force update if the timings are not the new 6-6 blocks
    const needsUpdate = rules.length < 8 || rules.some((r: any) => r.endHour !== 18 && r.endHour !== 6);

    if (needsUpdate) {
      console.log('🔄 Pricing timings are outdated or missing. Force-repairing rules...');
      const turfs: ('A' | 'B')[] = ['A', 'B'];
      const dayTypes: ('weekday' | 'weekend')[] = ['weekday', 'weekend'];

      for (const turfId of turfs) {
        for (const dayType of dayTypes) {
          // Day Rule (6-18)
          await PricingRule.create({ turfId, dayType, startHour: 6, endHour: 18, price: dayType === 'weekday' ? 800 : 1000 });

          // Night Rule (18-6)
          await PricingRule.create({ turfId, dayType, startHour: 18, endHour: 6, price: dayType === 'weekday' ? 1200 : 1500 });
        }
      }
      // Re-fetch now that they are created
      rules = await PricingRule.find().sort({ turfId: 1, dayType: 1, startHour: 1 });
      console.log('✅ Pricing table verified and filled');
    }

    res.status(200).json({ success: true, data: rules });
  } catch (error) {
    console.error('Pricing Fetch Error:', error);
    res.status(500).json({ success: false, message: 'Pricing system initialization failed' });
  }
};

/**
 * Update pricing rule.
 */
export const updatePricingRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ruleId } = req.params;
    const { price, isActive } = req.body;
    const rule = await PricingRule.findByIdAndUpdate(ruleId, { price, isActive }, { new: true });
    res.status(200).json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

/**
 * Migrate old walk-in BlockedSlots (with phoneNumber) to real confirmed Bookings.
 */
export const migrateWalkIns = async (_req: Request, res: Response): Promise<void> => {
  try {
    const oldWalkIns = await BlockedSlot.find({ phoneNumber: { $exists: true, $ne: '' } }).lean();

    let migrated = 0;
    let skipped = 0;
    const errors: string[] = [];

    const pricingRules = await PricingRule.find({ isActive: true }).lean();

    for (const bs of oldWalkIns) {
      try {
        // Find or create user
        let user = await User.findOne({ phone: bs.phoneNumber });
        if (!user) {
          user = await User.create({
            phone: bs.phoneNumber,
            name: bs.customerName || 'Walk-in Customer',
            role: 'user'
          });
        }

        // Check if a booking already exists for this slot
        const existing = await Booking.findOne({
          turfId: bs.turfId,
          date: bs.date,
          startHour: bs.startHour,
          status: 'confirmed'
        });

        if (existing) {
          // Just delete the stale BlockedSlot
          await BlockedSlot.deleteOne({ _id: bs._id });
          skipped++;
          continue;
        }

        const price = calculatePrice(bs, pricingRules);

        await Booking.create({
          userId: user._id,
          turfId: bs.turfId,
          date: bs.date,
          startHour: bs.startHour,
          totalAmount: price,
          paidAmount: price,
          paymentType: 'full',
          status: 'confirmed',
          razorpayOrderId: `WALKIN-MIGRATED-${bs._id}`,
          razorpayPaymentId: 'CASH_PAYMENT',
          razorpaySignature: 'ADMIN_COLLECTED'
        });

        // Remove the old BlockedSlot
        await BlockedSlot.deleteOne({ _id: bs._id });
        migrated++;
      } catch (err) {
        errors.push(`Slot ${bs._id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    res.status(200).json({
      success: true,
      message: `Migration complete: ${migrated} migrated, ${skipped} already existed`,
      data: { migrated, skipped, errors }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Migration failed' });
  }
};

/**
 * Get blocked slots.
 */
export const getBlockedSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, turfId } = req.query;
    const filter: any = {};
    if (date) filter.date = date;
    if (turfId) filter.turfId = turfId;
    const blocked = await BlockedSlot.find(filter).populate('blockedBy', 'name email').sort({ date: 1, startHour: 1 });
    res.status(200).json({ success: true, data: blocked });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get blocked slots' });
  }
};
