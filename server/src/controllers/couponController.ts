import { Request, Response } from 'express';
import { Coupon } from '../models/Coupon';

/**
 * Admin: Create a new coupon.
 */
export const createCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, discountType, discountValue, applicableTo, minBookingAmount, maxUses, expiresAt, isActive } = req.body;

    if (!code || !discountType || discountValue === undefined) {
      res.status(400).json({ success: false, message: 'code, discountType, and discountValue are required' });
      return;
    }

    if (!['percentage', 'flat'].includes(discountType)) {
      res.status(400).json({ success: false, message: 'discountType must be "percentage" or "flat"' });
      return;
    }

    if (discountType === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
      res.status(400).json({ success: false, message: 'Percentage discount must be between 1 and 100' });
      return;
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      res.status(409).json({ success: false, message: 'Coupon code already exists' });
      return;
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase().trim(),
      discountType,
      discountValue,
      applicableTo: applicableTo || 'both',
      minBookingAmount: minBookingAmount || 0,
      maxUses: maxUses || 0,
      expiresAt: expiresAt || null,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({ success: true, message: 'Coupon created successfully', data: coupon });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create coupon';
    res.status(500).json({ success: false, message });
  }
};

/**
 * Admin: Get all coupons.
 */
export const getAllCoupons = async (_req: Request, res: Response): Promise<void> => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: coupons });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch coupons' });
  }
};

/**
 * Admin: Update a coupon.
 */
export const updateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Uppercase code if being updated
    if (updates.code) {
      updates.code = updates.code.toUpperCase().trim();
      // Check uniqueness (excluding current)
      const existing = await Coupon.findOne({ code: updates.code, _id: { $ne: id } });
      if (existing) {
        res.status(409).json({ success: false, message: 'Another coupon with this code already exists' });
        return;
      }
    }

    const coupon = await Coupon.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!coupon) {
      res.status(404).json({ success: false, message: 'Coupon not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Coupon updated', data: coupon });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update coupon' });
  }
};

/**
 * Admin: Delete a coupon.
 */
export const deleteCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      res.status(404).json({ success: false, message: 'Coupon not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete coupon' });
  }
};

/**
 * User: Validate and preview a coupon discount.
 * Body: { code, totalAmount, paymentType }
 */
export const validateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, totalAmount, paymentType } = req.body;

    if (!code || totalAmount === undefined || !paymentType) {
      res.status(400).json({ success: false, message: 'code, totalAmount, and paymentType are required' });
      return;
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });

    if (!coupon) {
      res.status(404).json({ success: false, message: 'Invalid coupon code' });
      return;
    }

    if (!coupon.isActive) {
      res.status(400).json({ success: false, message: 'This coupon is no longer active' });
      return;
    }

    // Check expiry
    if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
      res.status(400).json({ success: false, message: 'This coupon has expired' });
      return;
    }

    // Check max uses
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      res.status(400).json({ success: false, message: 'This coupon has reached its usage limit' });
      return;
    }

    // Check applicable payment type
    if (coupon.applicableTo === 'full' && paymentType !== 'full') {
      res.status(400).json({ success: false, message: 'This coupon is only applicable on full payment' });
      return;
    }

    // Check min booking amount
    if (coupon.minBookingAmount > 0 && totalAmount < coupon.minBookingAmount) {
      res.status(400).json({
        success: false,
        message: `This coupon requires a minimum booking amount of ₹${coupon.minBookingAmount}`,
      });
      return;
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round((totalAmount * coupon.discountValue) / 100);
    } else {
      discountAmount = Math.min(coupon.discountValue, totalAmount);
    }

    const discountedTotal = totalAmount - discountAmount;

    res.status(200).json({
      success: true,
      message: `Coupon applied! You save ₹${discountAmount}`,
      data: {
        coupon: {
          _id: coupon._id,
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          applicableTo: coupon.applicableTo,
        },
        discountAmount,
        discountedTotal,
        originalAmount: totalAmount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to validate coupon' });
  }
};
