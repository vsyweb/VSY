import mongoose, { Schema, Document } from 'mongoose';

export interface ICoupon {
  _id: mongoose.Types.ObjectId;
  code: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  applicableTo: 'full' | 'both';
  minBookingAmount: number;
  maxUses: number; // 0 = unlimited
  usedCount: number;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CouponDocument extends Omit<ICoupon, '_id'>, Document {}

const couponSchema = new Schema<CouponDocument>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    applicableTo: {
      type: String,
      enum: ['full', 'both'],
      default: 'both',
    },
    minBookingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxUses: {
      type: Number,
      default: 0, // 0 = unlimited
      min: 0,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

couponSchema.index({ code: 1 });

export const Coupon = mongoose.model<CouponDocument>('Coupon', couponSchema);
