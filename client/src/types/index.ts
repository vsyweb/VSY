export type TurfId = 'A' | 'B';
export type SlotStatus = 'available' | 'booked' | 'blocked' | 'locked' | 'pending';

export interface User {
  id: string;
  phone: string;
  name: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'worker';
}

export interface SlotInfo {
  hour: number;
  timeLabel: string;
  status: SlotStatus;
  price: number;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'failed' | 'blocked';
export type PaymentStatus = 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface Booking {
  _id: string;
  userId: string | { _id: string; phone: string; name: string };
  turfId: TurfId;
  date: string;
  startHour: number;
  startHours?: number[]; // Added for consolidated bookings
  endHour?: number;      // Added for consolidated bookings
  totalAmount: number;
  totalAmountGrouped?: number; // Added for consolidated bookings
  paidAmount: number;
  paidAmountGrouped?: number;  // Added for consolidated bookings
  paymentType: 'full' | 'advance';
  status: BookingStatus;
  paymentStatus?: PaymentStatus;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  ballType?: string;
  ballAmount?: number;
  createdAt: string;
  updatedAt: string;
  isBlocked?: boolean; // For manual admin blocks
  reason?: string;
  phoneNumber?: string;
  customerName?: string;
  subBookings?: Booking[];
  createdBy?: string;
}

export interface PricingRule {
  _id: string;
  turfId: TurfId;
  dayType: 'weekday' | 'weekend';
  startHour: number;
  endHour: number;
  price: number;
  isActive: boolean;
}

export interface BlockedSlotInfo {
  _id: string;
  turfId: TurfId;
  date: string;
  startHour: number;
  reason?: string;
  phoneNumber?: string;
  customerName?: string;
  blockedBy: { name: string; email: string };
}

export interface DashboardStats {
  totalBookings: number;
  confirmedBookings: number;
  todayBookings: number;
  totalUsers: number;
  totalRevenue: number;
  onlineRevenue: number;
  walkinRevenue: number;
  onlineCount: number;
  walkinCount: number;
  totalBlocked: number;
  todayBlocked: number;
  todayOccupancy: number;
  revenueByTurf: Array<{ _id: TurfId; total: number; count: number }>;
  totalBallRevenue: number;
  recentBookings: Booking[];
  upcomingBookings: Booking[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export interface Coupon {
  _id: string;
  code: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  applicableTo: 'full' | 'both';
  minBookingAmount: number;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CouponValidateResponse {
  coupon: {
    _id: string;
    code: string;
    discountType: 'percentage' | 'flat';
    discountValue: number;
    applicableTo: 'full' | 'both';
  };
  discountAmount: number;
  discountedTotal: number;
  originalAmount: number;
}

export interface CreateOrderResponse {
  bookingIds: string[];
  orderId: string;
  amount: number;
  currency: string;
  razorpayKeyId: string;
  turfId: TurfId;
  date: string;
  startHours: number[];
  paymentType: 'full' | 'advance';
  totalBookingAmount: number;
}

export interface PaymentStatusResponse {
  razorpayOrderId: string;
  paymentStatus: PaymentStatus;
  bookingStatus: 'pending' | 'confirmed' | 'failed';
}

export interface LockSlotResponse {
  turfId: TurfId;
  date: string;
  startHour: number;
  price: number;
  lockExpiresIn: number;
}

// Razorpay types
export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: {
    contact: string;
    name: string;
  };
  theme: {
    color: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

export interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open: () => void;
      close: () => void;
    };
  }
}
