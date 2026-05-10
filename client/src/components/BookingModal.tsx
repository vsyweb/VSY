import React, { useState } from 'react';
import type { SlotInfo, TurfId } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';
import { lockSlot, createBooking, verifyPayment, unlockSlot } from '../services/api';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { MdSportsCricket, MdAccessTime, MdPayment, MdCheckCircle } from 'react-icons/md';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSlots: SlotInfo[];
  turfId: TurfId;
  date: string;
  onBookingComplete: () => void;
}

type BookingStep = 'confirm' | 'locking' | 'locked' | 'paying' | 'verifying' | 'success';

const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  selectedSlots,
  turfId,
  date,
  onBookingComplete,
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<BookingStep>('confirm');
  const [countdown, setCountdown] = useState(300);
  const [paymentType, setPaymentType] = useState<'full' | 'advance'>('full');
  const [ballType, setBallType] = useState<'light_tennis' | 'hard_tennis' | 'old_ball'>('light_tennis');
  const [demoOrder, setDemoOrder] = useState<any>(null);

  const resetAndClose = () => {
    setStep('confirm');
    setCountdown(300);
    setDemoOrder(null);
    setPaymentType('full');
    setBallType('light_tennis');
    onClose();
  };

  const handleLockAndPay = async () => {
    if (selectedSlots.length === 0) return;

    try {
      setStep('locking');
      
      // Lock each selected slot
      for (const slot of selectedSlots) {
        const lockRes = await lockSlot(turfId, date, slot.hour);
        if (!lockRes.success) {
          toast.error(`Could not lock slot ${slot.timeLabel}: ${lockRes.message}`);
          resetAndClose();
          return;
        }
      }

      setStep('locked');

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Create booking order for ALL selected hours with selected payment type
      const selectedHours = selectedSlots.map(s => s.hour);
      const orderRes = await createBooking(turfId, date, selectedHours, paymentType, ballType);
      
      if (!orderRes.success || !orderRes.data) {
        clearInterval(timer);
        toast.error(orderRes.message || 'Failed to create order');
        for (const slot of selectedSlots) {
          await unlockSlot(turfId, date, slot.hour).catch(() => {});
        }
        resetAndClose();
        return;
      }

      const orderData = orderRes.data;

      // Check for Demo Mode (if Razorpay key is missing/placeholder)
      if (orderData.orderId.startsWith('order_DEMO_')) {
        setStep('paying');
        setDemoOrder(orderData);
        clearInterval(timer);
        return;
      }

      // Step 3: Open Razorpay checkout
      setStep('paying');

      const options = {
        key: orderData.razorpayKeyId,
        amount: orderData.amount * 100,
        currency: orderData.currency,
        name: 'VSY Box Cricket Pro',
        description: `Turf ${turfId} | ${formatDate(date)} | ${selectedSlots.length} Slots + ${ballType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} (${paymentType})`,
        order_id: orderData.orderId,
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          clearInterval(timer);
          setStep('verifying');

          try {
            const verifyRes = await verifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );

            if (verifyRes.success) {
              setStep('success');
              toast.success('🎉 Booking confirmed!');
              setTimeout(() => {
                onBookingComplete();
                resetAndClose();
              }, 2000);
            } else {
              toast.error('Payment verification failed');
              resetAndClose();
            }
          } catch {
            toast.error('Payment verification error');
            resetAndClose();
          }
        },
        prefill: {
          contact: user?.phone || '',
          name: user?.name || '',
        },
        theme: {
          color: '#338bff',
        },
        modal: {
          ondismiss: () => {
            clearInterval(timer);
            for (const slot of selectedSlots) {
               unlockSlot(turfId, date, slot.hour).catch(() => {});
            }
            toast.error('Payment cancelled');
            resetAndClose();
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error: any) {
      const message = error.response?.data?.message || (error instanceof Error ? error.message : 'Booking failed');
      toast.error(message);
      for (const slot of selectedSlots) {
        unlockSlot(turfId, date, slot.hour).catch(() => {});
      }
      resetAndClose();
    }
  };

  const handleDemoPayment = async () => {
    if (!demoOrder) return;
    setStep('verifying');
    
    await new Promise(r => setTimeout(r, 1500));
    
    try {
      const verifyRes = await verifyPayment(
        demoOrder.orderId,
        `pay_DEMO_${Math.random().toString(36).slice(2, 11)}`,
        'demo_signature'
      );

      if (verifyRes.success) {
        setStep('success');
        toast.success('🎉 Demo Booking confirmed!');
        setTimeout(() => {
          onBookingComplete();
          resetAndClose();
        }, 2000);
      } else {
        toast.error('Demo Payment verification failed');
        resetAndClose();
      }
    } catch {
      toast.error('Demo Payment verification error');
      resetAndClose();
    }
  };

  if (selectedSlots.length === 0) return null;

  const BALL_PRICES = {
    light_tennis: 80,
    hard_tennis: 100,
    old_ball: 0,
    none: 0,
  };
  
  const slotsAmount = selectedSlots.reduce((sum, s) => sum + s.price, 0);
  const ballAmount = BALL_PRICES[ballType];
  const totalAmount = slotsAmount + ballAmount;
  const advanceAmount = Math.round(totalAmount * 0.3);
  const payableNow = paymentType === 'advance' ? advanceAmount : totalAmount;

  const formatCountdown = (secs: number) => {
    const min = Math.floor(secs / 60);
    const sec = secs % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <Modal isOpen={isOpen} onClose={step === 'confirm' ? resetAndClose : () => {}} title="Complete Your Booking">
      {step === 'confirm' && (
        <div className="space-y-4 animate-fade-in">
          {/* Booking Details Card */}
          <div className="bg-white/5 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/10 space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-3 sm:pb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-primary-500/20 flex items-center justify-center">
                  <MdSportsCricket className="text-primary-400 text-lg sm:text-2xl" />
                </div>
                <div>
                  <p className="text-[9px] sm:text-[10px] text-surface-400 font-bold uppercase tracking-widest">Selected Facility</p>
                  <p className="text-white font-black text-base sm:text-lg leading-tight">Arena {turfId === 'A' ? '1' : '2'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] sm:text-[10px] text-surface-400 font-bold uppercase tracking-widest">Match Date</p>
                <p className="text-white font-black text-base sm:text-lg leading-tight">{formatDate(date)}</p>
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <p className="text-[9px] sm:text-[10px] text-surface-400 font-bold uppercase tracking-widest">Selected Time Slots ({selectedSlots.length})</p>
              <div className="grid grid-cols-2 gap-2 max-h-32 sm:max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {selectedSlots.map(slot => (
                  <div key={slot.hour} className="flex items-center gap-1.5 sm:gap-2 bg-primary-500/10 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border border-primary-500/20">
                    <MdAccessTime className="text-primary-400 text-sm sm:text-base" />
                    <span className="text-xs sm:text-sm text-primary-100 font-bold truncate">{slot.timeLabel}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ball Type Selection */}
            <div className="space-y-2 sm:space-y-3">
              <p className="text-[9px] sm:text-[10px] text-surface-400 font-bold uppercase tracking-widest">Select Ball</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'light_tennis', label: 'Light', price: 80, desc: 'Tennis' },
                  { id: 'hard_tennis', label: 'Hard', price: 100, desc: 'Tennis' },
                ].map((ball) => (
                  <button
                    key={ball.id}
                    onClick={() => setBallType(ball.id as any)}
                    className={`flex flex-col items-center p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all ${
                      ballType === ball.id
                        ? 'bg-primary-500/20 border-primary-500 ring-1 ring-primary-500/30'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-[10px] sm:text-[11px] font-black text-white uppercase text-center mb-0.5 leading-tight">{ball.label}</span>
                    <span className="text-xs sm:text-sm font-black text-white">{ball.price > 0 ? `₹${ball.price}` : 'Free'}</span>
                    <span className="text-[8px] sm:text-[9px] text-surface-400 uppercase tracking-tighter mt-0.5 text-center truncate w-full">{ball.desc}</span>
                  </button>
                ))}
              </div>

            </div>

            {/* Payment Option Selection */}
            <div className="space-y-2 sm:space-y-3">
              <p className="text-[9px] sm:text-[10px] text-surface-400 font-bold uppercase tracking-widest">Payment Option</p>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button 
                  onClick={() => setPaymentType('full')}
                  className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-lg sm:rounded-xl border transition-all ${
                    paymentType === 'full' 
                    ? 'bg-primary-500/20 border-primary-500 ring-1 ring-primary-500/30' 
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="text-[10px] sm:text-xs font-black text-white uppercase mb-0.5 sm:mb-1">Full Payment</span>
                  <span className="text-base sm:text-lg font-black text-white">₹{totalAmount}</span>
                  <span className="text-[8px] sm:text-[10px] text-surface-400 uppercase tracking-tighter mt-0.5 sm:mt-1 truncate w-full text-center">Pay 100% now</span>
                </button>
                <button 
                  onClick={() => setPaymentType('advance')}
                  className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-lg sm:rounded-xl border transition-all ${
                    paymentType === 'advance' 
                    ? 'bg-accent-500/20 border-accent-500 ring-1 ring-accent-500/30' 
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="text-[10px] sm:text-xs font-black text-white uppercase mb-0.5 sm:mb-1">Advance (30%)</span>
                  <span className="text-base sm:text-lg font-black text-white">₹{advanceAmount}</span>
                  <span className="text-[8px] sm:text-[10px] text-surface-400 uppercase tracking-tighter mt-0.5 sm:mt-1 truncate w-full text-center">Pay rest at turf</span>
                </button>
              </div>
            </div>

            <div className="pt-3 sm:pt-4 border-t border-white/10 flex items-end justify-between">
              <div>
                <p className="text-[9px] sm:text-[10px] text-surface-400 font-bold uppercase tracking-widest mb-0.5 sm:mb-1">Payable Now</p>
                <p className="text-white font-black text-2xl sm:text-3xl tracking-tight leading-none">
                   <span className="text-primary-400 mr-0.5">₹</span>{payableNow}
                </p>
              </div>
              <div className="flex flex-col items-end">
                 <span className="text-[8px] sm:text-[10px] text-surface-500 font-bold uppercase mb-1">
                   {paymentType === 'full' ? 'Payment in Full' : `Balance: ₹${totalAmount - advanceAmount}`}
                 </span>
                 <div className="bg-green-500/20 text-green-400 text-[8px] sm:text-[9px] font-black px-2 py-0.5 sm:px-3 sm:py-1 rounded-full border border-green-500/30 uppercase tracking-tighter">
                   Best Price Guarantee
                 </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 sm:gap-3 pt-2">
            <button onClick={resetAndClose} className="btn-secondary flex-1 py-3 sm:py-4 font-black uppercase tracking-widest text-[10px] sm:text-xs">
              Change
            </button>
            <button 
              onClick={handleLockAndPay} 
              disabled={step !== 'confirm'}
              className="btn-primary flex-[2] py-3 sm:py-4 font-black uppercase tracking-widest text-[10px] sm:text-xs shadow-xl shadow-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === 'confirm' ? 'Confirm & Pay' : 'Processing...'}
            </button>
          </div>
          
          <p className="text-center text-[9px] sm:text-[10px] text-surface-500 font-medium pb-2 sm:pb-0">
            Slots are held for 5 minutes once confirmed.
          </p>
        </div>
      )}

      {step === 'locking' && (
        <div className="flex flex-col items-center py-16 animate-fade-in">
          <LoadingSpinner size="lg" text="Securing your turf slots..." />
          <p className="text-surface-500 text-xs mt-4 animate-pulse">Checking availability in real-time</p>
        </div>
      )}

      {step === 'locked' && (
        <div className="flex flex-col items-center py-12 animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-6 border border-amber-500/20 shadow-lg shadow-amber-500/5">
            <MdAccessTime className="text-amber-400" size={40} />
          </div>
          <p className="text-amber-400 font-black text-4xl mb-2 tracking-tighter">{formatCountdown(countdown)}</p>
          <p className="text-white font-bold">Successfully Reserved!</p>
          <p className="text-surface-500 text-sm mt-1">Initiating secure payment gateway...</p>
        </div>
      )}

      {step === 'paying' && demoOrder && (
        <div className="flex flex-col items-center py-10 animate-fade-in text-center px-4">
          <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 border border-blue-500/20 shadow-xl shadow-blue-500/5">
            <MdPayment className="text-blue-400" size={40} />
          </div>
          <h3 className="text-2xl font-display font-black text-white mb-2 uppercase tracking-tight">Demo Mode Active</h3>
          <p className="text-surface-400 text-sm mb-8 leading-relaxed">
            Razorpay API keys are not configured. You can complete this transaction in <span className="text-blue-400 font-bold">Demo Mode</span> to test the application flow.
          </p>
          <button 
            onClick={handleDemoPayment}
            className="w-full btn-primary py-5 bg-blue-600 hover:bg-blue-500 shadow-2xl shadow-blue-500/40 font-black uppercase tracking-widest"
          >
            Pay {formatCurrency(payableNow)} (Demo)
          </button>
          <button 
            onClick={resetAndClose}
            className="mt-6 text-surface-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors"
          >
            Cancel Transaction
          </button>
        </div>
      )}

      {step === 'paying' && !demoOrder && (
        <div className="flex flex-col items-center py-16 animate-fade-in text-center">
          <LoadingSpinner size="lg" text="Secure Checkout in Progress..." />
          <div className="mt-8 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20">
             <p className="text-amber-400 text-xs font-black uppercase tracking-widest">
                Action Required: Payment Window Open
             </p>
          </div>
          <p className="text-surface-500 text-[10px] mt-4 font-bold uppercase tracking-tighter">
            Expires in {formatCountdown(countdown)}
          </p>
        </div>
      )}

      {step === 'verifying' && (
        <div className="flex flex-col items-center py-16 animate-fade-in text-center">
          <div className="relative">
            <LoadingSpinner size="lg" />
            <div className="absolute inset-0 flex items-center justify-center">
               <MdPayment className="text-primary-500/30" size={24} />
            </div>
          </div>
          <h3 className="text-xl font-display font-black text-white mt-8 uppercase tracking-widest">Verifying Payment</h3>
          <p className="text-surface-500 text-xs mt-2">Checking transaction status with the bank</p>
        </div>
      )}

      {step === 'success' && (
        <div className="flex flex-col items-center py-14 animate-scale-in text-center px-6">
          <div className="relative mb-8">
            <div className="h-28 w-40 rounded-3xl bg-green-500/10 flex items-center justify-center shadow-[0_0_60px_rgba(34,197,94,0.2)] border border-green-500/20 p-2">
              <img src="/images/logo.png" alt="VSY Logo" className="w-full h-full object-contain" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg border-4 border-surface-950">
               <MdCheckCircle className="text-white" size={24} />
            </div>
          </div>
          <h3 className="text-3xl font-display font-black text-green-400 mb-2 uppercase tracking-tighter">Booking Confirmed!</h3>
          <p className="text-white font-bold text-lg mb-1">Get ready for your match!</p>
          <p className="text-surface-500 text-sm max-w-[240px]">
            Your reservation for <span className="text-white font-bold">Arena {turfId === 'A' ? '1' : '2'}</span> on <span className="text-white font-bold">{formatDate(date)}</span> is successful.
          </p>
          
          <div className="mt-8 w-full p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center gap-2">
             <span className="text-[10px] text-surface-500 font-black uppercase tracking-widest">Status:</span>
             <span className="text-[10px] text-green-400 font-black uppercase tracking-widest">Active reservation</span>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default BookingModal;
