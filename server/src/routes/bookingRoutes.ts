import { Router } from 'express';
import {
  createBooking,
  verifyPayment,
  getPaymentStatus,
  handleRazorpayWebhook,
  getUserBookings,
  cancelBooking,
} from '../controllers/bookingController';
import { validateCoupon } from '../controllers/couponController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Razorpay webhook should not require user auth.
router.post('/razorpay/webhook', handleRazorpayWebhook);

// All booking routes require authentication
router.use(authMiddleware);

router.post('/create', createBooking);
router.post('/verify-payment', verifyPayment);
router.get('/payment-status/:orderId', getPaymentStatus);
router.get('/my-bookings', getUserBookings);
router.put('/cancel/:bookingId', cancelBooking);
router.post('/validate-coupon', validateCoupon);

export default router;
