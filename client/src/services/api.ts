import axios from 'axios';
import type {
  ApiResponse,
  User,
  AdminUser,
  SlotInfo,
  LockSlotResponse,
  CreateOrderResponse,
  Booking,
  DashboardStats,
  PricingRule,
  BlockedSlotInfo,
  TurfId,
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor to attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vsy_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('vsy_token');
      localStorage.removeItem('vsy_user');
      localStorage.removeItem('vsy_role');
      // Don't redirect, let the component handle it
    }
    return Promise.reject(error);
  }
);

// ===== AUTH =====
export const loginWithPhone = async (phone: string, name?: string) => {
  const res = await api.post<ApiResponse<{ token: string; user: User }>>('/auth/login', { phone, name });
  return res.data;
};

export const adminLogin = async (email: string, password: string) => {
  const res = await api.post<ApiResponse<{ token: string; admin: AdminUser }>>('/auth/admin/login', { email, password });
  return res.data;
};

export const getProfile = async () => {
  const res = await api.get<ApiResponse<User>>('/auth/profile');
  return res.data;
};

export const updateProfile = async (name: string) => {
  const res = await api.put<ApiResponse<User>>('/auth/profile', { name });
  return res.data;
};

// ===== SLOTS =====
export const getSlots = async (turfId: TurfId, date: string) => {
  const res = await api.get<ApiResponse<{ turfId: string; date: string; slots: SlotInfo[] }>>(
    `/slots/${turfId}/${date}`
  );
  return res.data;
};

export const lockSlot = async (turfId: TurfId, date: string, startHour: number) => {
  const res = await api.post<ApiResponse<LockSlotResponse>>('/slots/lock', { turfId, date, startHour });
  return res.data;
};

export const unlockSlot = async (turfId: TurfId, date: string, startHour: number) => {
  const res = await api.post<ApiResponse>('/slots/unlock', { turfId, date, startHour });
  return res.data;
};

export const getSlotPrice = async (date: string, hour: number) => {
  const res = await api.get<ApiResponse<{ price: number }>>(`/slots/price/${date}/${hour}`);
  return res.data;
};

export const getPublicPricing = async () => {
  const res = await api.get<ApiResponse<PricingRule[]>>('/slots/pricing');
  return res.data;
};

// ===== BOOKINGS =====
export const createBooking = async (turfId: TurfId, date: string, startHours: number[], paymentType: 'full' | 'advance' = 'full', ballType: string = 'light_tennis') => {
  const res = await api.post<ApiResponse<CreateOrderResponse>>('/bookings/create', { 
    turfId, 
    date, 
    startHours,
    paymentType,
    ballType
  });
  return res.data;
};

export const verifyPayment = async (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
) => {
  const res = await api.post<ApiResponse<Booking>>('/bookings/verify-payment', {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });
  return res.data;
};

export const getUserBookings = async () => {
  const res = await api.get<ApiResponse<Booking[]>>('/bookings/my-bookings');
  return res.data;
};

export const cancelBooking = async (bookingId: string) => {
  const res = await api.put<ApiResponse>(`/bookings/cancel/${bookingId}`);
  return res.data;
};

// ===== ADMIN =====
export const getAdminStats = async (params?: { month?: string; year?: string; date?: string; showAll?: boolean }) => {
  const res = await api.get<ApiResponse<DashboardStats>>('/admin/stats', { params });
  return res.data;
};

export const getAdminBookings = async (params?: {
  date?: string;
  turfId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const res = await api.get<
    ApiResponse<{
      bookings: Booking[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>
  >('/admin/bookings', { params });
  return res.data;
};

export const adminCancelBooking = async (bookingId: string) => {
  const res = await api.put<ApiResponse>(`/admin/bookings/cancel/${bookingId}`);
  return res.data;
};

export const adminCollectPayment = async (bookingId: string) => {
  const res = await api.put<ApiResponse>(`/admin/bookings/collect-payment/${bookingId}`);
  return res.data;
};

export const blockSlotAdmin = async (
  turfId: TurfId, 
  date: string, 
  startHours: number[], 
  reason?: string,
  phoneNumber?: string,
  customerName?: string,
  ballType?: string
) => {
  const res = await api.post<ApiResponse>('/admin/slots/block', { 
    turfId, 
    date, 
    startHours, 
    reason,
    phoneNumber,
    customerName,
    ballType
  });
  return res.data;
};

export const unblockSlotAdmin = async (turfId: TurfId, date: string, startHour: number) => {
  const res = await api.post<ApiResponse>('/admin/slots/unblock', { turfId, date, startHour });
  return res.data;
};

export const getBlockedSlots = async (date?: string, turfId?: string) => {
  const res = await api.get<ApiResponse<BlockedSlotInfo[]>>('/admin/slots/blocked', {
    params: { date, turfId },
  });
  return res.data;
};

export const getPricingRules = async () => {
  const res = await api.get<ApiResponse<PricingRule[]>>('/admin/pricing');
  return res.data;
};

export const updatePricingRule = async (ruleId: string, price: number, isActive: boolean) => {
  const res = await api.put<ApiResponse<PricingRule>>(`/admin/pricing/${ruleId}`, { price, isActive });
  return res.data;
};

export const migrateWalkIns = async () => {
  const res = await api.post<ApiResponse>('/admin/migrate-walkins');
  return res.data;
};
