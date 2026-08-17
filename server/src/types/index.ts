import mongoose from 'mongoose';

export interface IUser {
  _id: mongoose.Types.ObjectId;
  phone: string;
  name: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAdmin {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'worker';
  createdAt: Date;
}

export type TurfId = 'A' | 'B';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'failed';
export type PaymentStatus = 'PROCESSING' | 'SUCCESS' | 'FAILED';
export type PaymentType = 'full' | 'advance';

export interface IBooking {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  turfId: TurfId;
  date: string; // YYYY-MM-DD
  startHour: number; // 0-23
  totalAmount: number;
  paidAmount: number;
  paymentType: PaymentType;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  ballType: string;
  ballAmount: number;
  couponCode?: string;
  discountAmount?: number;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISlotLock {
  _id: mongoose.Types.ObjectId;
  turfId: TurfId;
  date: string;
  startHour: number;
  userId: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

export interface IBlockedSlot {
  _id: mongoose.Types.ObjectId;
  turfId: TurfId;
  date: string;
  startHour: number;
  reason?: string;
  phoneNumber?: string;
  customerName?: string;
  blockedBy: mongoose.Types.ObjectId;
  groupId?: string;
  createdAt: Date;
}

export interface IPricingRule {
  _id: mongoose.Types.ObjectId;
  turfId: TurfId;
  dayType: 'weekday' | 'weekend';
  startHour: number;
  endHour: number;
  price: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlotInfo {
  hour: number;
  timeLabel: string;
  status: 'available' | 'booked' | 'blocked' | 'locked' | 'pending';
  price: number;
}

export interface JwtPayload {
  id: string;
  role: 'user' | 'admin' | 'worker';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}
