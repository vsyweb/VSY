import { Booking } from '../models/Booking';
import { SlotLock } from '../models/SlotLock';
import { razorpayInstance } from '../config/razorpay';
import { PaymentStatus } from '../types';

export type VerificationSource = 'frontend_callback' | 'retry_job' | 'webhook' | 'status_poll';

interface VerifyPaymentInput {
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  source: VerificationSource;
  explicitFailure?: boolean;
}

export interface VerifyPaymentResult {
  paymentStatus: PaymentStatus;
  bookingStatus: 'pending' | 'confirmed' | 'failed' | 'cancelled';
  updatedCount: number;
  message: string;
}

const RETRY_DELAYS_MS = [20000, 50000, 80000, 110000, 140000, 170000, 200000, 230000, 260000, 290000];
const scheduledOrders = new Set<string>();

const log = (event: string, payload: Record<string, unknown>) => {
  console.log(
    JSON.stringify({
      event,
      at: new Date().toISOString(),
      ...payload,
    })
  );
};

const toPaymentStatus = (status?: string): PaymentStatus => {
  if (status === 'captured') return 'SUCCESS';
  if (status === 'failed') return 'FAILED';
  return 'PROCESSING';
};

const getLatestPaymentState = async (
  razorpayOrderId: string,
  razorpayPaymentId?: string,
  explicitFailure?: boolean
): Promise<{ paymentStatus: PaymentStatus; paymentId?: string }> => {
  if (explicitFailure) {
    return {
      paymentStatus: 'FAILED',
      paymentId: razorpayPaymentId,
    };
  }

  if (razorpayOrderId.startsWith('order_DEMO_')) {
    if (razorpayPaymentId?.startsWith('pay_DEMO_')) {
      return {
        paymentStatus: 'SUCCESS',
        paymentId: razorpayPaymentId,
      };
    }
    return { paymentStatus: 'PROCESSING' };
  }

  if (!razorpayInstance) {
    return { paymentStatus: 'PROCESSING', paymentId: razorpayPaymentId };
  }

  if (razorpayPaymentId) {
    try {
      const payment = await razorpayInstance.payments.fetch(razorpayPaymentId);
      return {
        paymentStatus: toPaymentStatus(payment.status),
        paymentId: payment.id,
      };
    } catch {
      return { paymentStatus: 'PROCESSING', paymentId: razorpayPaymentId };
    }
  }

  try {
    const orderPayments = await razorpayInstance.orders.fetchPayments(razorpayOrderId);
    const items = orderPayments.items || [];

    const captured = items.find((item: any) => item.status === 'captured');
    if (captured) {
      return {
        paymentStatus: 'SUCCESS',
        paymentId: captured.id,
      };
    }

    const failed = items.find((item: any) => item.status === 'failed');
    if (failed) {
      return {
        paymentStatus: 'FAILED',
        paymentId: failed.id,
      };
    }

    const authorized = items.find((item: any) => item.status === 'authorized');
    if (authorized) {
      return {
        paymentStatus: 'PROCESSING',
        paymentId: authorized.id,
      };
    }
  } catch {
    return { paymentStatus: 'PROCESSING' };
  }

  return { paymentStatus: 'PROCESSING' };
};

const applyPaymentOutcome = async (
  razorpayOrderId: string,
  paymentStatus: PaymentStatus,
  razorpayPaymentId?: string,
  razorpaySignature?: string
): Promise<VerifyPaymentResult> => {
  const alreadyConfirmed = await Booking.exists({
    razorpayOrderId,
    status: 'confirmed',
  });

  if (alreadyConfirmed) {
    return {
      paymentStatus: 'SUCCESS',
      bookingStatus: 'confirmed',
      updatedCount: 0,
      message: 'Already confirmed',
    };
  }

  if (paymentStatus === 'SUCCESS') {
    const updateResult = await Booking.updateMany(
      {
        razorpayOrderId,
        status: 'pending',
        paymentStatus: { $ne: 'SUCCESS' },
      },
      {
        $set: {
          status: 'confirmed',
          paymentStatus: 'SUCCESS',
          ...(razorpayPaymentId ? { razorpayPaymentId } : {}),
          ...(razorpaySignature ? { razorpaySignature } : {}),
        },
      }
    );

    const confirmedBookings = await Booking.find({
      razorpayOrderId,
      status: 'confirmed',
    }).lean();

    await Promise.all(
      confirmedBookings.map((booking) =>
        SlotLock.deleteOne({
          turfId: booking.turfId,
          date: booking.date,
          startHour: booking.startHour,
        })
      )
    );

    return {
      paymentStatus: 'SUCCESS',
      bookingStatus: 'confirmed',
      updatedCount: updateResult.modifiedCount,
      message: 'Payment captured',
    };
  }

  if (paymentStatus === 'FAILED') {
    const updateResult = await Booking.updateMany(
      {
        razorpayOrderId,
        status: 'pending',
        paymentStatus: { $ne: 'SUCCESS' },
      },
      {
        $set: {
          status: 'failed',
          paymentStatus: 'FAILED',
          ...(razorpayPaymentId ? { razorpayPaymentId } : {}),
          ...(razorpaySignature ? { razorpaySignature } : {}),
        },
      }
    );

    return {
      paymentStatus: 'FAILED',
      bookingStatus: 'failed',
      updatedCount: updateResult.modifiedCount,
      message: 'Payment failed',
    };
  }

  const updateResult = await Booking.updateMany(
    {
      razorpayOrderId,
      status: 'pending',
      paymentStatus: { $nin: ['SUCCESS', 'FAILED'] },
    },
    {
      $set: {
        paymentStatus: 'PROCESSING',
      },
    }
  );

  return {
    paymentStatus: 'PROCESSING',
    bookingStatus: 'pending',
    updatedCount: updateResult.modifiedCount,
    message: 'Payment still processing',
  };
};

export const verifyAndReconcilePayment = async (input: VerifyPaymentInput): Promise<VerifyPaymentResult> => {
  log('Payment Verification Started', {
    source: input.source,
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId || null,
  });

  const latest = await getLatestPaymentState(
    input.razorpayOrderId,
    input.razorpayPaymentId,
    input.explicitFailure
  );

  const reconciled = await applyPaymentOutcome(
    input.razorpayOrderId,
    latest.paymentStatus,
    latest.paymentId || input.razorpayPaymentId,
    input.razorpaySignature
  );

  if (reconciled.paymentStatus === 'SUCCESS') {
    log('Payment Captured', {
      source: input.source,
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: latest.paymentId || input.razorpayPaymentId || null,
      updatedCount: reconciled.updatedCount,
    });
  } else if (reconciled.paymentStatus === 'FAILED') {
    log('Payment Failed', {
      source: input.source,
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: latest.paymentId || input.razorpayPaymentId || null,
      updatedCount: reconciled.updatedCount,
    });
  } else {
    log('Payment Still Processing', {
      source: input.source,
      razorpayOrderId: input.razorpayOrderId,
      updatedCount: reconciled.updatedCount,
    });
  }

  return reconciled;
};

export const schedulePaymentVerificationRetries = (razorpayOrderId: string): void => {
  if (scheduledOrders.has(razorpayOrderId)) {
    return;
  }

  scheduledOrders.add(razorpayOrderId);

  RETRY_DELAYS_MS.forEach((delay, index) => {
    setTimeout(async () => {
      try {
        const latestBooking = await Booking.findOne({ razorpayOrderId }).select('status paymentStatus').lean();
        if (!latestBooking) {
          scheduledOrders.delete(razorpayOrderId);
          return;
        }

        if (
          latestBooking.status === 'confirmed' ||
          latestBooking.status === 'failed' ||
          latestBooking.status === 'cancelled' ||
          latestBooking.paymentStatus === 'SUCCESS' ||
          latestBooking.paymentStatus === 'FAILED'
        ) {
          scheduledOrders.delete(razorpayOrderId);
          return;
        }

        const result = await verifyAndReconcilePayment({
          razorpayOrderId,
          source: 'retry_job',
        });

        if (result.paymentStatus !== 'PROCESSING') {
          log('Retry Success', {
            razorpayOrderId,
            attempt: index + 1,
            afterMs: delay,
            paymentStatus: result.paymentStatus,
          });
          scheduledOrders.delete(razorpayOrderId);
          return;
        }

        log('Retry Scheduled', {
          razorpayOrderId,
          attempt: index + 2,
          nextAfterMs: RETRY_DELAYS_MS[index + 1] ?? null,
        });

        if (index === RETRY_DELAYS_MS.length - 1) {
          scheduledOrders.delete(razorpayOrderId);
        }
      } catch (error) {
        log('Retry Error', {
          razorpayOrderId,
          attempt: index + 1,
          message: error instanceof Error ? error.message : 'Unknown retry error',
        });

        if (index === RETRY_DELAYS_MS.length - 1) {
          scheduledOrders.delete(razorpayOrderId);
        }
      }
    }, delay);
  });

  log('Retry Scheduled', {
    razorpayOrderId,
    attempt: 1,
    nextAfterMs: RETRY_DELAYS_MS[0],
  });
};

export const getOrderPaymentStatus = async (razorpayOrderId: string) => {
  const booking = await Booking.findOne({ razorpayOrderId }).lean();

  if (!booking) {
    return null;
  }

  let paymentStatus = booking.paymentStatus || 'PROCESSING';
  if (booking.status === 'confirmed') paymentStatus = 'SUCCESS';
  if (booking.status === 'failed') paymentStatus = 'FAILED';

  if (paymentStatus === 'PROCESSING') {
    const result = await verifyAndReconcilePayment({
      razorpayOrderId,
      source: 'status_poll',
    });
    paymentStatus = result.paymentStatus;
  }

  return {
    paymentStatus,
    bookingStatus:
      paymentStatus === 'SUCCESS'
        ? 'confirmed'
        : paymentStatus === 'FAILED'
          ? 'failed'
          : 'pending',
  };
};
