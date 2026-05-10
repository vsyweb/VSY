import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { getUserBookings, cancelBooking } from '../services/api';
import { formatDate, formatHour, formatCurrency, getRelativeTime } from '../utils/helpers';
import type { Booking } from '../types';
import toast from 'react-hot-toast';
import { MdCancel, MdCheckCircle, MdAccessTime, MdError, MdSportsCricket } from 'react-icons/md';

const MyBookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]); // GroupedBooking
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'cancelled' | 'completed'>('confirmed');

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await getUserBookings();
      if (res.success && res.data) {
        // Group bookings by razorpayOrderId
        const groups: { [key: string]: any } = {};
        res.data.forEach((booking: Booking) => {
          const key = booking.razorpayOrderId || booking._id;
          if (!groups[key]) {
            groups[key] = {
              ...booking,
              startHours: [booking.startHour],
              endHour: booking.startHour + 1,
              totalAmountGrouped: Number(booking.totalAmount) || 0,
              paidAmountGrouped: Number((booking as any).paidAmount) || Number(booking.paidAmount) || 0,
              subBookings: [booking],
            };
          } else {
            groups[key].startHours.push(booking.startHour);
            groups[key].startHours.sort((a: number, b: number) => a - b);
            groups[key].endHour = Math.max(...groups[key].startHours) + 1;
            groups[key].totalAmountGrouped += (Number(booking.totalAmount) || 0);
            groups[key].paidAmountGrouped += (Number((booking as any).paidAmount) || Number(booking.paidAmount) || 0);
            if (booking.ballType && booking.ballType !== 'none') {
              groups[key].ballType = booking.ballType;
            }
            groups[key].subBookings.push(booking);
          }
        });
        const grouped = Object.values(groups).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setBookings(grouped);
      }
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [targetBooking, setTargetBooking] = useState<Booking | null>(null);

  const initiateCancel = (booking: Booking) => {
    setTargetBooking(booking);
    setCancelModalOpen(true);
  };

  const handleCancel = async () => {
    if (!targetBooking) return;

    setCancellingId(targetBooking._id);
    setCancelModalOpen(false);
    
    try {
      const res = await cancelBooking(targetBooking._id);
      if (res.success) {
        toast.success('Booking cancelled');
        fetchBookings();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('Failed to cancel booking');
    } finally {
      setCancellingId(null);
      setTargetBooking(null);
    }
  };

  const isCompleted = (booking: Booking) => {
    if (booking.status !== 'confirmed') return false;
    const bookingDate = new Date(booking.date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) return true;
    if (bookingDate.getTime() === today.getTime() && booking.startHour < new Date().getHours()) return true;
    return false;
  };

  const getDisplayStatus = (booking: Booking) => {
    if (isCompleted(booking)) return 'completed';
    return booking.status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <MdCheckCircle className="text-green-400" size={18} />;
      case 'completed':
        return <MdCheckCircle className="text-primary-400" size={18} />;
      case 'cancelled':
        return <MdCancel className="text-red-400" size={18} />;
      case 'pending':
        return <MdAccessTime className="text-amber-400" size={18} />;
      case 'failed':
        return <MdError className="text-red-400" size={18} />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const base = 'px-2.5 py-1 rounded-full text-xs font-medium capitalize';
    switch (status) {
      case 'confirmed':
        return `${base} bg-green-500/15 text-green-400`;
      case 'completed':
        return `${base} bg-primary-500/15 text-primary-400`;
      case 'cancelled':
        return `${base} bg-red-500/15 text-red-400`;
      case 'pending':
        return `${base} bg-amber-500/15 text-amber-400`;
      case 'failed':
        return `${base} bg-red-500/15 text-red-400`;
      default:
        return `${base} bg-surface-500/15 text-surface-400`;
    }
  };

  const filteredBookings = filter === 'all'
    ? bookings
    : bookings.filter((b) => getDisplayStatus(b) === filter);

  const canCancel = (booking: Booking) => {
    if (booking.status !== 'confirmed' || isCompleted(booking)) return false;
    return true; // Already handled past date check in isCompleted
  };

  return (
    <div className="min-h-screen bg-surface-950">
      <Navbar />

      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl sm:text-4xl font-display font-black text-white">
            My <span className="gradient-text">Bookings</span>
          </h1>
          <p className="text-surface-400 mt-2">View and manage your turf bookings</p>
        </div>

        {/* Sleek Stats Section */}
        {!loading && bookings.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-slide-up">
            {[
              { id: 'confirmed', label: 'Upcoming', count: bookings.filter((b) => getDisplayStatus(b) === 'confirmed').length, icon: <MdCheckCircle size={20} />, color: 'green' },
              { id: 'all', label: 'Total', count: bookings.length, icon: <MdSportsCricket size={20} />, color: 'primary' },
              { id: 'completed', label: 'History', count: bookings.filter((b) => getDisplayStatus(b) === 'completed').length, icon: <MdAccessTime size={20} />, color: 'purple' },
              { id: 'cancelled', label: 'Cancelled', count: bookings.filter((b) => b.status === 'cancelled').length, icon: <MdCancel size={20} />, color: 'red' }
            ].map((stat) => (
              <button
                key={stat.id}
                onClick={() => setFilter(stat.id as any)}
                className={`relative px-5 py-4 rounded-2xl transition-all duration-300 border text-left flex items-center gap-4 ${
                  filter === stat.id 
                    ? `bg-${stat.color === 'primary' ? 'primary' : stat.color}-500/10 border-${stat.color === 'primary' ? 'primary' : stat.color}-500/30 ring-1 ring-${stat.color === 'primary' ? 'primary' : stat.color}-500/10`
                    : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
                }`}
              >
                <div className={`p-2.5 rounded-xl flex-shrink-0 transition-colors ${
                  filter === stat.id 
                    ? `bg-${stat.color === 'primary' ? 'primary' : stat.color}-500/20 text-${stat.color === 'primary' ? 'primary' : stat.color}-400`
                    : 'bg-white/5 text-surface-500 group-hover:text-surface-300'
                }`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-[10px] font-black text-surface-500 uppercase tracking-widest">{stat.label}</p>
                  <h3 className={`text-xl font-display font-black leading-none mt-1 ${
                      filter === stat.id ? `text-${stat.color === 'primary' ? 'primary' : stat.color}-400` : 'text-white'
                  }`}>
                    {stat.count}
                  </h3>
                </div>
                {filter === stat.id && (
                   <div className={`absolute right-3 top-3 w-1.5 h-1.5 rounded-full bg-${stat.color === 'primary' ? 'primary' : stat.color}-500 animate-pulse`} />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" text="Loading your bookings..." />
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredBookings.length === 0 && (
          <div className="text-center py-20 animate-fade-in glass-card">
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/5">
              <MdSportsCricket className="text-surface-500" size={40} />
            </div>
            <h3 className="text-xl font-display font-black text-white">No bookings found</h3>
            <p className="text-surface-500 mt-2 font-medium">
              {filter === 'all' ? 'Book your first slot to get started!' : `No ${filter === 'confirmed' ? 'upcoming' : filter} bookings`}
            </p>
          </div>
        )}

        {/* Bookings list */}
        {!loading && filteredBookings.length > 0 && (
          <div className="grid grid-cols-1 gap-3 animate-slide-up">
            {filteredBookings.map((booking) => {
              const displayStat = getDisplayStatus(booking);
              return (
              <div
                key={booking._id}
                className={`group relative overflow-hidden rounded-2xl transition-all duration-300 border ${
                  displayStat === 'completed' ? 'opacity-90' : ''
                } ${
                  displayStat === 'confirmed' ? 'bg-gradient-to-b from-white/[0.05] to-transparent border-green-500/20' : 
                  displayStat === 'cancelled' ? 'bg-white/[0.02] border-red-500/20' :
                  'bg-white/[0.03] border-white/10'
                }`}
              >
                {/* Active Status Indicator Line */}
                {displayStat === 'confirmed' && (
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-green-500/50 to-transparent" />
                )}

                <div className="p-3 sm:px-5 sm:py-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Left: Turf Branding */}
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden ${
                        booking.turfId === 'A' ? 'bg-primary-500/10' : 'bg-accent-500/10'
                      }`}>
                        {/* Decorative background letter */}
                        <span className={`absolute -right-1 -bottom-2 text-3xl font-black opacity-10 select-none ${
                        booking.turfId === 'A' ? 'text-primary-500' : 'text-accent-500'
                      }`}>{booking.turfId}</span>
                        
                        <span className={`relative font-display font-black text-xl ${
                          booking.turfId === 'A' ? 'text-primary-400' : 'text-accent-400'
                        }`}>
                          {booking.turfId}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-1">
                          <span className={getStatusBadge(displayStat)}>
                            <span className="flex items-center gap-1.5 font-bold uppercase tracking-widest text-[9px]">
                              {getStatusIcon(displayStat)}
                              {displayStat}
                            </span>
                          </span>
                          <span className="text-[9px] text-surface-500 font-bold uppercase tracking-widest">
                            Ref: #{booking.razorpayOrderId?.slice(-6).toUpperCase() || booking._id.slice(-6).toUpperCase()}
                          </span>
                        </div>
                        
                        <h4 className="text-white text-base font-black tracking-tight flex items-center gap-2">
                          {formatDate(booking.date)}
                        </h4>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5 text-xs font-medium text-surface-400">
                           <span className="flex items-center gap-1.5">
                              <MdAccessTime size={14} className="text-primary-400/70" />
                              {booking.startHours?.length > 1 ? `${booking.startHours.length} Slots: ` : ''}
                              <span className="text-surface-200 font-bold">{formatHour(booking.startHours[0])} - {formatHour(booking.endHour)}</span>
                           </span>
                           {booking.ballType && booking.ballType !== 'none' && (
                             <span className="flex items-center gap-1.5">
                                <MdSportsCricket size={14} className="text-accent-400/70" />
                                <span className="text-surface-200 font-bold capitalize">{booking.ballType.replace('_', ' ')}</span>
                             </span>
                           )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Booking Age */}
                    <div className="hidden sm:block text-right">
                       <p className="text-[9px] uppercase font-black tracking-[0.2em] text-surface-600 mb-0.5">Booked On</p>
                       <p className="text-[10px] font-bold text-surface-400">{getRelativeTime(booking.createdAt)}</p>
                    </div>
                  </div>

                  {/* Redesigned Payment Summary Section */}
                  <div className="mt-4 pt-4 border-t border-white/5 bg-white/[0.01] -mx-3 -mb-3 px-3 pb-3 sm:-mx-5 sm:-mb-3.5 sm:px-5 sm:pb-3.5 rounded-b-3xl transition-colors group-hover:bg-white/[0.03]">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-end justify-between gap-5">
                        <div className="flex flex-wrap gap-6">
                          <div>
                            <p className="text-[9px] font-black text-surface-500 uppercase tracking-widest mb-1">Total Amount</p>
                            <p className="text-lg font-black text-white leading-none">{formatCurrency(booking.totalAmountGrouped || 0)}</p>
                          </div>

                          {booking.status === 'pending' ? (
                            <div className="pl-5 border-l border-white/5">
                              <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Payment Status</p>
                              <p className="text-[10px] font-bold text-amber-400 leading-tight">
                                ⚠️ Awaiting payment... <br/> Please finish the transaction.
                              </p>
                            </div>
                          ) : booking.status === 'cancelled' ? (
                            <div className="pl-5 border-l border-white/5">
                              <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">Reason</p>
                              <p className="text-[10px] font-bold text-surface-400 leading-tight">
                                ❌ Payment failed/timed out. <br/>
                                <span className="text-[9px] opacity-70">Refunds (if debited) will reflect in 5-7 days.</span>
                              </p>
                            </div>
                          ) : (booking.paidAmountGrouped < booking.totalAmountGrouped) ? (
                            <>
                              <div className="pl-5 border-l border-white/5">
                                <p className="text-[9px] font-black text-surface-500 uppercase tracking-widest mb-1">Paid Online</p>
                                <p className="text-sm font-black text-green-400 leading-none">{formatCurrency(booking.paidAmountGrouped)}</p>
                              </div>
                              <div className="pl-5 border-l border-white/5">
                                <p className="text-[9px] font-black text-surface-500 uppercase tracking-widest mb-1">Balance</p>
                                <p className="text-sm font-black text-amber-500 leading-none">{formatCurrency(booking.totalAmountGrouped - booking.paidAmountGrouped)}</p>
                              </div>
                            </>
                          ) : (
                            <div className="pl-5 border-l border-white/5">
                              <p className="text-[9px] font-black text-surface-500 uppercase tracking-widest mb-1">Status</p>
                              <div className="flex items-center gap-1.5 text-[10px] font-black text-green-400 uppercase tracking-tighter leading-none">
                                 <MdCheckCircle size={12} /> Full Paid
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="w-full flex justify-center mt-4 pt-4 border-t border-white/5">
                        {canCancel(booking) && (
                          <button
                            onClick={() => initiateCancel(booking)}
                            disabled={cancellingId === booking._id}
                            className="group/btn relative overflow-hidden flex items-center justify-center gap-2 px-8 py-2.5 rounded-xl transition-all duration-300
                              bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 hover:shadow-lg hover:shadow-red-500/20 disabled:opacity-50 min-w-[200px]"
                          >
                            <span className="relative z-10 text-[11px] uppercase tracking-widest font-black text-red-400 group-hover/btn:text-white text-center w-full">
                              {cancellingId === booking._id ? 'Processing...' : 'Cancel Booking'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}
      </main>
      
      {/* Cancellation Warning Modal */}
      <Modal 
        isOpen={cancelModalOpen} 
        onClose={() => setCancelModalOpen(false)} 
        title="Cancel Booking"
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20">
              <MdError className="text-red-400" size={32} />
            </div>
            <h3 className="text-xl font-display font-black text-white uppercase tracking-tight">Are you sure?</h3>
            <p className="text-surface-400 text-sm mt-2 leading-relaxed">
              You are about to cancel your booking for <span className="text-white font-bold">{targetBooking && formatDate(targetBooking.date)}</span> ({(targetBooking as any)?.startHours?.length} slots: <span className="text-white font-bold">{targetBooking && formatHour((targetBooking as any).startHours[0])} - {targetBooking && formatHour((targetBooking as any).endHour)}</span>).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center animate-pulse">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">Cancellation Policy</p>
            <p className="text-xs font-bold text-red-300">
               ⚠️ IMPORTANT: Payments are strictly <span className="underline decoration-red-500 underline-offset-2">NON-REFUNDABLE</span> for any cancellations as per our policy.
            </p>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setCancelModalOpen(false)} 
              className="btn-secondary flex-1 py-4 font-black uppercase tracking-widest text-xs"
            >
              Keep Booking
            </button>
            <button 
              onClick={handleCancel} 
              className="bg-red-600 hover:bg-red-500 text-white flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-red-500/20"
            >
              Confirm Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MyBookingsPage;
