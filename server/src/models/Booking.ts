import mongoose, { Schema, Document } from 'mongoose';
import { IBooking, TurfId, BookingStatus } from '../types';

export interface BookingDocument extends Omit<IBooking, '_id'>, Document {}

const bookingSchema = new Schema<BookingDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    turfId: {
      type: String,
      enum: ['A', 'B'] as TurfId[],
      required: true,
    },
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
    },
    startHour: {
      type: Number,
      required: true,
      min: 0,
      max: 23,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentType: {
      type: String,
      enum: ['full', 'advance'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'failed'] as BookingStatus[],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['PROCESSING', 'SUCCESS', 'FAILED'],
      default: 'PROCESSING',
    },
    razorpayOrderId: {
      type: String,
      required: true,
    },
    razorpayPaymentId: {
      type: String,
      default: '',
    },
    razorpaySignature: {
      type: String,
      default: '',
    },
    ballType: {
      type: String,
      enum: ['light_tennis', 'hard_tennis', 'old_ball', 'none'],
      default: 'none',
    },
    ballAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    couponCode: {
      type: String,
      default: '',
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent double bookings
bookingSchema.index({ turfId: 1, date: 1, startHour: 1, status: 1 });
bookingSchema.index({ userId: 1, createdAt: -1 });

export const Booking = mongoose.model<BookingDocument>('Booking', bookingSchema);
