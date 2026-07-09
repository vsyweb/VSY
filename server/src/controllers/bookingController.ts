import { Request, Response } from 'express';
import { Booking } from '../models/Booking';
import { SlotLock } from '../models/SlotLock';
import { Coupon } from '../models/Coupon';
import { isSlotAvailable } from '../services/slotService';
import { createOrder, verifyPaymentSignature } from '../services/paymentService';
import { getSlotPrice } from '../services/pricingService';
import {
  getOrderPaymentStatus,
  schedulePaymentVerificationRetries,
  verifyAndReconcilePayment,
} from '../services/paymentVerificationService';
import { isValidDate, isValidHour, isFutureOrToday } from '../utils/helpers';
import { TurfId } from '../types';
import { config } from '../config/env';
import mongoose from 'mongoose';

/**
 * Create a booking order (initiate payment).
 */
export const createBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { turfId, date, startHours, paymentType = 'full', ballType = 'none', couponCode } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!turfId || !['A', 'B'].includes(turfId)) {
      res.status(400).json({ success: false, message: 'Invalid turf ID' });
      return;
    }

    if (!date || !isValidDate(date) || !isFutureOrToday(date)) {
      res.status(400).json({ success: false, message: 'Invalid or past date' });
      return;
    }

    const hours = Array.isArray(startHours) ? startHours : [req.body.startHour];

    if (hours.length === 0 || hours.some((h: any) => !isValidHour(h))) {
      res.status(400).json({ success: false, message: 'Invalid hours selected' });
      return;
    }

    const BALL_PRICES: Record<string, number> = {
      light_tennis: 80,
      hard_tennis: 100,
      old_ball: 0,
      none: 0
    };
    const ballAmount = BALL_PRICES[ballType] || 0;

    let totalBookingAmount = ballAmount;
    const bookingsData = [];

    // Verify locks and availability for all slots
    for (const hour of hours) {
      const lock = await SlotLock.findOne({
        turfId,
        date,
        startHour: hour,
        userId: new mongoose.Types.ObjectId(userId),
        expiresAt: { $gt: new Date() },
      });

      if (!lock) {
        res.status(409).json({
          success: false,
          message: `Slot lock for ${hour}:00 expired or not found.`,
        });
        return;
      }

      const available = await isSlotAvailable(turfId as TurfId, date, hour);
      if (!available) {
        res.status(409).json({ success: false, message: `Slot ${hour}:00 is no longer available` });
        return;
      }

      const price = await getSlotPrice(date, hour, turfId as string);
      totalBookingAmount += price;
      bookingsData.push({ hour, price });
    }

    // --- Coupon Validation ---
    let discountAmount = 0;
    let appliedCoupon: any = null;
    if (couponCode && typeof couponCode === 'string' && couponCode.trim() !== '') {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase().trim() });
      if (coupon && coupon.isActive) {
        const now = new Date();
        const withinExpiry = !coupon.expiresAt || now <= new Date(coupon.expiresAt);
        const withinUsage = coupon.maxUses === 0 || coupon.usedCount < coupon.maxUses;
        const paymentTypeAllowed = coupon.applicableTo === 'both' || paymentType === 'full';
        const meetsMinAmount = totalBookingAmount >= coupon.minBookingAmount;

        if (withinExpiry && withinUsage && paymentTypeAllowed && meetsMinAmount) {
          if (coupon.discountType === 'percentage') {
            discountAmount = Math.round((totalBookingAmount * coupon.discountValue) / 100);
          } else {
            discountAmount = Math.min(coupon.discountValue, totalBookingAmount);
          }
          appliedCoupon = coupon;
        }
      }
    }

    // Effective total after discount
    const effectiveTotal = totalBookingAmount - discountAmount;

    // Calculate amount to pay now
    const amountToPay = paymentType === 'advance' ? Math.round(effectiveTotal * 0.3) : effectiveTotal;
    console.log('--- DEBUG ---', { ballType, ballAmount, totalBookingAmount, discountAmount, effectiveTotal, bookingsData });

    // Create Razorpay order for the amount to pay
    // Shorten bookingRef to stay under Razorpay's 40-char limit for receipt
    const bookingRef = `VSY-${turfId}-${Date.now().toString(36)}`;
    const order = await createOrder(amountToPay, bookingRef);

    // Create multiple pending bookings
    const bookings = await Promise.all(
      bookingsData.map(async (data, index) => {
        // Add the ball cost to the first booking only to avoid duplication and fractions
        const isFirstBooking = index === 0;
        const currentBallAmount = isFirstBooking ? ballAmount : 0;
        const currentBallType = isFirstBooking ? ballType : 'none';
        // Apply full discount to the first booking slot
        const slotPrice = data.price + currentBallAmount;
        const effectiveSlotPrice = index === 0 ? Math.max(0, slotPrice - discountAmount) : slotPrice;
        // For individual records, we split the paid amount proportionally
        const individualPaidAmount = paymentType === 'advance' ? Math.round(effectiveSlotPrice * 0.3) : effectiveSlotPrice;

        return await Booking.create({
          userId: new mongoose.Types.ObjectId(userId),
          turfId,
          date,
          startHour: data.hour,
          totalAmount: effectiveSlotPrice,
          paidAmount: individualPaidAmount,
          paymentType,
          status: 'pending',
          paymentStatus: 'PROCESSING',
          razorpayOrderId: order.orderId,
          ballType: currentBallType,
          ballAmount: currentBallAmount,
          couponCode: appliedCoupon ? appliedCoupon.code : '',
          discountAmount: index === 0 ? discountAmount : 0,
        });
      })
    );

    // Increment coupon usage count after bookings are created
    if (appliedCoupon) {
      await Coupon.findByIdAndUpdate(appliedCoupon._id, { $inc: { usedCount: 1 } });
    }

    schedulePaymentVerificationRetries(order.orderId);

    res.status(201).json({
      success: true,
      message: `Order created for ${paymentType} payment.`,
      data: {
        bookingIds: bookings.map((b) => b._id),
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        razorpayKeyId: config.razorpay.keyId,
        turfId,
        date,
        startHours: hours,
        paymentType,
        totalBookingAmount,
        discountAmount,
        effectiveTotal,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create booking';
    res.status(500).json({ success: false, message });
  }
};

/**
 * Verify payment and confirm booking.
 */
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      res.status(400).json({ success: false, message: 'Missing payment verification data' });
      return;
    }

    // Verify Razorpay signature first
    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!isValid) {
      schedulePaymentVerificationRetries(razorpayOrderId);
      await verifyAndReconcilePayment({
        razorpayOrderId,
        razorpayPaymentId,
        source: 'frontend_callback',
      });
      res.status(400).json({
        success: false,
        message: 'Payment signature invalid. Verification retry started.',
      });
      return;
    }

    const result = await verifyAndReconcilePayment({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      source: 'frontend_callback',
    });

    if (result.paymentStatus === 'SUCCESS') {
      res.status(200).json({
        success: true,
        message: 'Payment verified and booking confirmed.',
        data: {
          razorpayOrderId,
          paymentStatus: result.paymentStatus,
          bookingStatus: result.bookingStatus,
        },
      });
      return;
    }

    if (result.paymentStatus === 'FAILED') {
      res.status(400).json({
        success: false,
        message: 'Payment failed',
        data: {
          razorpayOrderId,
          paymentStatus: result.paymentStatus,
          bookingStatus: result.bookingStatus,
        },
      });
      return;
    }

    schedulePaymentVerificationRetries(razorpayOrderId);

    res.status(202).json({
      success: true,
      message: 'Payment is being verified. Please wait...',
      data: {
        razorpayOrderId,
        paymentStatus: result.paymentStatus,
        bookingStatus: result.bookingStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment verification failed';
    res.status(500).json({ success: false, message });
  }
};

/**
 * Poll payment status for an order while callback reconciliation is in progress.
 */
export const getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!orderId) {
      res.status(400).json({ success: false, message: 'Missing order ID' });
      return;
    }

    const booking = await Booking.findOne({
      razorpayOrderId: orderId,
      userId: new mongoose.Types.ObjectId(userId),
    }).select('_id');

    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found for this order' });
      return;
    }

    const status = await getOrderPaymentStatus(orderId);
    if (!status) {
      res.status(404).json({ success: false, message: 'Payment record not found' });
      return;
    }

    if (status.paymentStatus === 'PROCESSING') {
      schedulePaymentVerificationRetries(orderId);
    }

    res.status(200).json({
      success: true,
      message: status.paymentStatus === 'PROCESSING' ? 'Payment is being verified. Please wait...' : 'Payment status updated',
      data: {
        razorpayOrderId: orderId,
        paymentStatus: status.paymentStatus,
        bookingStatus: status.bookingStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get payment status';
    res.status(500).json({ success: false, message });
  }
};

/**
 * Razorpay webhook reconciliation endpoint.
 */
export const handleRazorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const event = req.body?.event;
    const payment = req.body?.payload?.payment?.entity;
    const razorpayOrderId = payment?.order_id as string | undefined;
    const razorpayPaymentId = payment?.id as string | undefined;

    if (!razorpayOrderId) {
      res.status(200).json({ success: true, message: 'Webhook ignored: no payment data' });
      return;
    }

    const explicitFailure = event === 'payment.failed' || payment?.status === 'failed';
    const result = await verifyAndReconcilePayment({
      razorpayOrderId,
      razorpayPaymentId,
      source: 'webhook',
      explicitFailure,
    });

    console.log(
      JSON.stringify({
        event: 'Webhook Reconciled Payment',
        at: new Date().toISOString(),
        razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId || null,
        paymentStatus: result.paymentStatus,
      })
    );

    if (result.paymentStatus === 'PROCESSING') {
      schedulePaymentVerificationRetries(razorpayOrderId);
    }

    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    res.status(500).json({ success: false, message });
  }
};

/**
 * Get user's booking history.
 */
export const getUserBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    // Cleanup expired pending bookings
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    await Booking.updateMany(
      { status: 'pending', createdAt: { $lt: fiveMinsAgo } },
      { $set: { status: 'cancelled' } }
    );

    const bookings = await Booking.find({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      message: 'Bookings retrieved',
      data: bookings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get bookings';
    res.status(500).json({ success: false, message });
  }
};

/**
 * Cancel a booking.
 */
export const cancelBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const userId = req.userId;

    const booking = await Booking.findOne({
      _id: bookingId,
      userId: new mongoose.Types.ObjectId(userId),
      status: 'confirmed',
    });

    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found or cannot be cancelled' });
      return;
    }

    // Check if booking date is in the future
    const bookingDate = new Date(booking.date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
      res.status(400).json({ success: false, message: 'Cannot cancel past bookings' });
      return;
    }

    await Booking.updateMany(
      { razorpayOrderId: booking.razorpayOrderId, userId: new mongoose.Types.ObjectId(userId) },
      { $set: { status: 'cancelled' } }
    );

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        bookingId: booking._id,
        status: booking.status,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel booking';
    res.status(500).json({ success: false, message });
  }
};
