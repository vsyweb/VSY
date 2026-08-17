import { Router } from 'express';
import {
  getAllBookings,
  adminCancelBooking,
  adminCollectPayment,
  blockSlot,
  unblockSlot,
  getDashboardStats,
  getPricingRules,
  updatePricingRule,
  getBlockedSlots,
  migrateWalkIns,
} from '../controllers/adminController';
import {
  createCoupon,
  getAllCoupons,
  updateCoupon,
  deleteCoupon,
} from '../controllers/couponController';
import { authMiddleware, adminMiddleware, adminOrWorkerMiddleware } from '../middleware/auth';

const router = Router();

// Require auth header for all endpoints in this router
router.use(authMiddleware);

// --- Admin Only Routes ---
router.get('/stats', adminMiddleware, getDashboardStats);
router.get('/pricing', adminMiddleware, getPricingRules);
router.put('/pricing/:ruleId', adminMiddleware, updatePricingRule);
router.get('/coupons', adminMiddleware, getAllCoupons);
router.post('/coupons', adminMiddleware, createCoupon);
router.put('/coupons/:id', adminMiddleware, updateCoupon);
router.delete('/coupons/:id', adminMiddleware, deleteCoupon);
router.post('/migrate-walkins', adminMiddleware, migrateWalkIns);

// --- Admin and Worker Shared Routes ---
router.get('/bookings', adminOrWorkerMiddleware, getAllBookings);
router.put('/bookings/cancel/:bookingId', adminOrWorkerMiddleware, adminCancelBooking);
router.put('/bookings/collect-payment/:bookingId', adminOrWorkerMiddleware, adminCollectPayment);
router.post('/slots/block', adminOrWorkerMiddleware, blockSlot);
router.post('/slots/unblock', adminOrWorkerMiddleware, unblockSlot);
router.get('/slots/blocked', adminOrWorkerMiddleware, getBlockedSlots);

export default router;
