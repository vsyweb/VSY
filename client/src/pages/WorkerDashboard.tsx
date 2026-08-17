import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import DatePicker from '../components/DatePicker';
import {
  getAdminBookings,
  adminCollectPayment,
  blockSlotAdmin,
  unblockSlotAdmin,
  getBlockedSlots,
  getSlots,
} from '../services/api';
import { formatDate, formatHour, getDateRange, getTodayStr, isPastSlot } from '../utils/helpers';
import type { Booking, BlockedSlotInfo, TurfId, SlotInfo } from '../types';
import toast from 'react-hot-toast';
import {
  MdBookOnline,
  MdBlock,
  MdSearch,
  MdFilterList,
  MdChevronLeft,
  MdChevronRight,
  MdClose,
  MdPeople,
} from 'react-icons/md';

type WorkerTab = 'bookings' | 'slots' | 'mybookings';

const WorkerDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<WorkerTab>('bookings');
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [selectedTurf, setSelectedTurf] = useState<TurfId>('A');
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlotInfo[]>([]);

  const [filterDate, setFilterDate] = useState(getTodayStr());
  const [filterTurf, setFilterTurf] = useState('');
  const [filterStatus, setFilterStatus] = useState('confirmed');
  const [filterCompleted, setFilterCompleted] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterPage, setFilterPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Walk-in booking state
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedAdminSlots, setSelectedAdminSlots] = useState<number[]>([]);
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [walkinBallType, setWalkinBallType] = useState<string>('none');
  const [walkinPaymentType, setWalkinPaymentType] = useState<'full' | 'advance'>('full');
  const [blockingInProgress, setBlockingInProgress] = useState(false);
  const [customAdvanceAmount, setCustomAdvanceAmount] = useState<string>('');
  const [walkinMode, setWalkinMode] = useState<'block' | 'walkin'>('block');
  const [workerMonthStats, setWorkerMonthStats] = useState<{ count: number; totalAmount: number; totalPaid: number } | null>(null);


  const [paymentBookingId, setPaymentBookingId] = useState<string | null>(null);
  const [collectingPayment, setCollectingPayment] = useState(false);

  const [marqueeBookings, setMarqueeBookings] = useState<any[]>([]);

  const dates = useMemo(() => getDateRange(30), []);

  // Fetch bookings specifically for the active/upcoming marquee ticker
  const fetchMarqueeData = useCallback(async () => {
    try {
      const today = getTodayStr();
      const res = await getAdminBookings({ date: today, status: 'confirmed', limit: 50 });
      if (res.success && res.data) {
        setMarqueeBookings(res.data.bookings);
      }
    } catch {
      // Fail silently for ticker
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const params: Record<string, string | number> = { page: filterPage, limit: 24 };
      if (filterDate) params.date = filterDate;
      if (filterTurf) params.turfId = filterTurf;
      if (filterStatus) params.status = filterStatus;
      if (filterSearch) params.search = filterSearch;
      if (activeTab === 'mybookings') {
        params.createdByMe = 'true';
      }

      const res = await getAdminBookings(params);
      if (res.success && res.data) {
        const groups: { [key: string]: any } = {};
        res.data.bookings.forEach((booking: Booking) => {
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
        let grouped = Object.values(groups).sort((a: any, b: any) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          const hourA = a.startHours[0];
          const hourB = b.startHours[0];
          if (hourA !== hourB) return hourA - hourB;
          return a.turfId.localeCompare(b.turfId);
        });

        if (filterCompleted) {
          grouped = grouped.filter((b: any) =>
            b.status !== 'completed' &&
            !(b.status === 'confirmed' && isPastSlot(b.date, b.endHour ?? b.startHour))
          );
        }

        setBookings(grouped);
        setTotalPages(res.data.pagination.pages);
        if (res.data.workerMonthStats) {
          setWorkerMonthStats(res.data.workerMonthStats);
        }
      }
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoadingBookings(false);
    }
  }, [filterDate, filterTurf, filterStatus, filterSearch, filterPage, filterCompleted, activeTab]);

  const fetchSlots = useCallback(async () => {
    setSelectedAdminSlots([]);
    setLoadingSlots(true);
    try {
      const [slotsRes, blockedRes] = await Promise.all([
        getSlots(selectedTurf, selectedDate),
        getBlockedSlots(selectedDate, selectedTurf),
      ]);
      if (slotsRes.success && slotsRes.data) setSlots(slotsRes.data.slots);
      if (blockedRes.success && blockedRes.data) setBlockedSlots(blockedRes.data);
    } catch {
      toast.error('Failed to load slots');
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedDate, selectedTurf]);

  useEffect(() => {
    fetchMarqueeData();
  }, [fetchMarqueeData]);

  useEffect(() => {
    if (activeTab === 'bookings' || activeTab === 'mybookings') fetchBookings();
  }, [activeTab, fetchBookings]);

  useEffect(() => {
    if (activeTab === 'slots') fetchSlots();
  }, [activeTab, fetchSlots]);



  const handleCollectPayment = (bookingId: string) => {
    setPaymentBookingId(bookingId);
  };

  const confirmCollection = async () => {
    if (!paymentBookingId) return;
    setCollectingPayment(true);
    try {
      const res = await adminCollectPayment(paymentBookingId);
      if (res.success) {
        toast.success('Cash payment collected successfully');
        fetchBookings();
        setPaymentBookingId(null);
      }
    } catch {
      toast.error('Failed to collect payment');
    } finally {
      setCollectingPayment(false);
    }
  };

  const handleConfirmBlock = async () => {
    if (selectedAdminSlots.length === 0) return;

    setBlockingInProgress(true);
    try {
      const BALL_PRICES: Record<string, number> = { light_tennis: 0, hard_tennis: 100, none: 0 };
      const slotsTotal = selectedAdminSlots.reduce((a, h) => a + (slots.find((s) => s.hour === h)?.price ?? 0), 0);
      const grandTotal = slotsTotal + (BALL_PRICES[walkinBallType] || 0);
      const defaultAdvance = Math.round(grandTotal * 0.3);
      const customPaid = walkinMode === 'walkin' && walkinPaymentType === 'advance'
        ? (customAdvanceAmount !== '' ? Number(customAdvanceAmount) : defaultAdvance)
        : undefined;

      const res = await blockSlotAdmin(
        selectedTurf,
        selectedDate,
        selectedAdminSlots,
        walkinName ? `Walk-in: ${walkinName}` : 'Desk Block',
        walkinMode === 'walkin' ? walkinPhone : undefined,
        walkinMode === 'walkin' ? walkinName : undefined,
        walkinMode === 'walkin' ? walkinBallType : 'none',
        walkinMode === 'walkin' ? walkinPaymentType : undefined,
        customPaid
      );

      if (res.success) {
        if (walkinMode === 'walkin') {
          toast.success(`Walk-in booking confirmed for ${walkinName || walkinPhone}!`);
        } else {
          toast.success('Slot blocked successfully');
        }
        setShowBlockModal(false);
        fetchSlots();
        fetchBookings();
        fetchMarqueeData();
        setSelectedAdminSlots([]);
      } else {
        toast.error(res.message || 'Failed to block slots');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to process slot block');
    } finally {
      setBlockingInProgress(false);
    }
  };

  const handleUnblockSlot = async (hour: number, date?: string, turf?: TurfId) => {
    try {
      const res = await unblockSlotAdmin(turf || selectedTurf, date || selectedDate, hour);
      if (res.success) {
        toast.success('Slot unblocked successfully');
        fetchSlots();
        if (activeTab === 'bookings') fetchBookings();
        fetchMarqueeData();
      }
    } catch {
      toast.error('Failed to unblock slot');
    }
  };

  const tabs: { key: WorkerTab; label: string; icon: React.ReactNode }[] = [
    { key: 'bookings', label: 'View Bookings', icon: <MdBookOnline size={18} /> },
    { key: 'slots', label: 'Arena Desk Calendar', icon: <MdBlock size={18} /> },
    { key: 'mybookings', label: 'Bookings Done By Me', icon: <MdPeople size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-surface-950">
      <Navbar />
      <main className="pt-20 pb-12 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6 animate-fade-in flex flex-col gap-3">
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white">
            Worker <span className="gradient-text">Dashboard</span>
          </h1>

          {/* Real-time ticker marquee */}
          <div className="w-full overflow-hidden bg-white/5 border border-white/10 rounded-lg py-2 flex flex-col justify-center gap-1.5 relative h-16 shadow-inner">
            {/* Active Sessions */}
            <div className="w-full relative h-[1.2rem] sm:h-[1.4rem]">
              <div
                className="absolute whitespace-nowrap animate-shimmer flex items-center h-full text-xs sm:text-sm font-bold text-surface-300"
                style={{ animationDuration: '18s' }}
              >
                {(() => {
                  const today = getTodayStr();
                  const currentHour = new Date().getHours();
                  const running = marqueeBookings.filter(
                    (b) => b.date === today && b.startHour === currentHour && b.status === 'confirmed'
                  );
                  const uniqueRunning = Array.from(new Map(running.map((b) => [b._id, b])).values());

                  return (
                    <div className="flex gap-8">
                      {['A', 'B'].map((turf) => {
                        const match = uniqueRunning.find((b) => b.turfId === turf);
                        if (match) {
                          const u = typeof match.userId === 'object' ? match.userId : null;
                          const nameOrPhone = u ? `${u.name || ''} ${u.phone || ''}`.trim() || 'Walk-in' : 'Desk Booking';
                          return (
                            <span key={turf} className="text-green-400">
                              🟢 ACTIVE NOW: Arena {match.turfId === 'A' ? '1' : '2'} | Customer: {nameOrPhone} | {formatHour(match.startHour)} to {formatHour(match.startHour + 1)}
                            </span>
                          );
                        }
                        return (
                          <span key={turf} className="text-surface-500">
                            🏏 Arena {turf === 'A' ? '1' : '2'}: Currently Available
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Upcoming Next Hour */}
            <div className="w-full relative h-[1.2rem] sm:h-[1.4rem]">
              <div
                className="absolute whitespace-nowrap animate-shimmer flex items-center h-full text-[11px] sm:text-[13px] font-bold text-surface-400"
                style={{ animationDuration: '24s', animationDelay: '-9s' }}
              >
                {(() => {
                  let d = new Date();
                  d.setHours(d.getHours() + 1);
                  const nextDs = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  const nextHour = d.getHours();
                  const upcoming = marqueeBookings.filter(
                    (b) => b.date === nextDs && b.startHour === nextHour && b.status === 'confirmed'
                  );
                  const uniqueUpcoming = Array.from(new Map(upcoming.map((b) => [b._id, b])).values());

                  return (
                    <div className="flex gap-8">
                      {['A', 'B'].map((turf) => {
                        const match = uniqueUpcoming.find((b) => b.turfId === turf);
                        if (match) {
                          const u = typeof match.userId === 'object' ? match.userId : null;
                          const nameOrPhone = u ? `${u.name || ''} ${u.phone || ''}`.trim() || 'Walk-in' : 'Desk Booking';
                          return (
                            <span key={turf} className="text-cyan-400">
                              ⏩ NEXT HOUR: Arena {match.turfId === 'A' ? '1' : '2'} | Customer: {nameOrPhone} | {formatHour(match.startHour)} to {formatHour(match.startHour + 1)}
                            </span>
                          );
                        }
                        return (
                          <span key={turf} className="text-surface-650 text-surface-600">
                            ⏩ Arena {turf === 'A' ? '1' : '2'}: Next hour is empty / available!
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            <style>{`
              @keyframes scroll-left {
                0% { transform: translateX(100vw); }
                100% { transform: translateX(-100%); }
              }
              .animate-shimmer {
                animation: scroll-left linear infinite;
              }
            `}</style>
          </div>
        </div>

        {/* Tab triggers */}
        <div className="flex gap-1 mb-6 sm:mb-8 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                activeTab === tab.key
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                  : 'bg-white/5 text-surface-400 border border-white/5 hover:bg-white/10'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* === BOOKINGS VIEW === */}
        {(activeTab === 'bookings' || activeTab === 'mybookings') && (
          <div className="animate-fade-in space-y-4">
            {activeTab === 'mybookings' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-4 bg-white/5 border border-white/10 rounded-2xl animate-fade-in">
                <div className="px-5 py-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-surface-500 mb-1">Bookings Count (This Month)</p>
                  <h4 className="text-xl font-black text-white">{workerMonthStats?.count ?? 0}</h4>
                </div>
                <div className="px-5 py-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-surface-500 mb-1">Total Value (This Month)</p>
                  <h4 className="text-xl font-black text-primary-400">₹{workerMonthStats?.totalAmount ?? 0}</h4>
                </div>
                <div className="px-5 py-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-surface-500 mb-1">Total Paid (This Month)</p>
                  <h4 className="text-xl font-black text-green-400">₹{workerMonthStats?.totalPaid ?? 0}</h4>
                </div>
              </div>
            )}
            {/* Filter Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" size={18} />
                <input
                  type="text"
                  value={filterSearch}
                  onChange={(e) => {
                    setFilterSearch(e.target.value);
                    setFilterPage(1);
                  }}
                  placeholder="Search by name or phone..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-primary-500/50"
                />
                {filterSearch && (
                  <button
                    onClick={() => setFilterSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white"
                  >
                    <MdClose size={16} />
                  </button>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                    filterDate !== getTodayStr() || filterTurf || filterStatus !== 'confirmed' || filterCompleted
                      ? 'bg-primary-500/20 border-primary-500/40 text-primary-400'
                      : 'bg-white/5 border-white/10 text-surface-300'
                  }`}
                >
                  <MdFilterList size={18} />
                  <span className="hidden sm:inline">Filters</span>
                  {(filterDate !== getTodayStr() || filterTurf || filterStatus !== 'confirmed' || filterCompleted) && (
                    <span className="w-2 h-2 rounded-full bg-primary-400" />
                  )}
                </button>

                {showFilters && (
                  <div className="absolute right-0 top-full mt-2 z-30 w-64 bg-surface-900 border border-white/10 rounded-2xl shadow-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-black uppercase tracking-widest text-surface-400">Filters</p>
                      <button
                        onClick={() => {
                          setFilterDate(getTodayStr());
                          setFilterTurf('');
                          setFilterStatus('confirmed');
                          setFilterCompleted(false);
                          setFilterPage(1);
                          setShowFilters(false);
                        }}
                        className="text-[10px] text-primary-400 font-bold hover:text-primary-300"
                      >
                        Reset
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-surface-500 mb-1">Date</label>
                      <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => {
                          setFilterDate(e.target.value);
                          setFilterPage(1);
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-surface-500 mb-1">Arena</label>
                      <select
                        value={filterTurf}
                        onChange={(e) => {
                          setFilterTurf(e.target.value);
                          setFilterPage(1);
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500/50"
                      >
                        <option value="">All Arenas</option>
                        <option value="A">Arena 1</option>
                        <option value="B">Arena 2</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-surface-500 mb-1">Status</label>
                      <select
                        value={filterStatus}
                        onChange={(e) => {
                          setFilterStatus(e.target.value);
                          setFilterPage(1);
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500/50"
                      >
                        <option value="">All Status</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="blocked">Blocked</option>
                        <option value="pending">Pending</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="text-[10px] font-bold uppercase text-surface-500">Show Completed</label>
                      <button
                        onClick={() => setFilterCompleted((prev) => !prev)}
                        className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
                          !filterCompleted ? 'bg-primary-500' : 'bg-surface-700'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                            !filterCompleted ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <button onClick={() => setShowFilters(false)} className="w-full btn-primary py-2 text-sm rounded-xl mt-1">
                      Apply
                    </button>
                  </div>
                )}
              </div>
            </div>

            {loadingBookings ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner text="Loading bookings..." />
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-12 text-surface-400 bg-white/5 rounded-2xl border border-white/5">
                No bookings found
              </div>
            ) : (
              <>
                {/* Mobile list view */}
                <div className="sm:hidden space-y-3">
                  {bookings.map((b) => {
                    const rawUser = typeof b.userId === 'object' && b.userId !== null ? b.userId : null;
                    const FAKE_NAMES = ['ADMIN BLOCKED', 'ADMIN BLOCK', 'Admin Blocked'];
                    const user = rawUser && !FAKE_NAMES.includes(rawUser.name) && (rawUser.name || rawUser.phone) ? rawUser : null;
                    const isBlocked = b.status === 'blocked' || b.isBlocked;
                    return (
                      <div key={b._id} className="glass-card p-4 space-y-3 border-white/5">
                        <div className="flex items-center justify-between">
                          <div>
                            {user ? (
                              <>
                                {isBlocked && (
                                  <span className="inline-block text-[8px] bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded px-1 py-0.5 font-black uppercase tracking-wider mb-1">
                                    Desk Booked
                                  </span>
                                )}
                                <p className="text-sm font-black text-white">{user.name || user.phone}</p>
                                {user.name && user.phone && <p className="text-[10px] text-surface-400">{user.phone}</p>}
                              </>
                            ) : (
                              <div>
                                {isBlocked && (
                                  <span className="inline-block text-[8px] bg-surface-600/30 text-surface-500 border border-surface-600/30 rounded px-1 py-0.5 font-black uppercase tracking-wider mb-1">
                                    Maintenance
                                  </span>
                                )}
                                <p className="text-sm font-black text-surface-400">Slot Reserved</p>
                              </div>
                            )}
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                              b.status === 'confirmed' && isPastSlot(b.date, b.startHour)
                                ? 'bg-primary-500/15 text-primary-400 border-primary-500/20'
                                : b.status === 'confirmed'
                                ? 'bg-green-500/15 text-green-400 border-green-500/20'
                                : b.status === 'blocked'
                                ? 'bg-red-500/15 text-red-300 border-red-500/20'
                                : b.status === 'cancelled'
                                ? 'bg-red-500/15 text-red-400 border-red-500/20'
                                : b.status === 'pending'
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                                : 'bg-surface-500/15 text-surface-400 border-surface-500/20'
                            }`}
                          >
                            {b.status === 'confirmed' && isPastSlot(b.date, b.startHour) ? 'COMPLETED' : b.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span
                              className={`px-1.5 py-0.5 rounded font-black text-[10px] ${
                                b.turfId === 'A' ? 'bg-primary-500/20 text-primary-400' : 'bg-accent-500/20 text-accent-400'
                              }`}
                            >
                              Arena {b.turfId === 'A' ? '1' : '2'}
                            </span>
                            <span className="text-surface-400">{formatDate(b.date)}</span>
                            <span className="text-primary-400 font-bold">
                              {(b.startHours?.length ?? 0) > 1 ? `${b.startHours?.length} Slots: ` : ''}{' '}
                              {formatHour(b.startHours?.[0] ?? b.startHour)} - {formatHour(b.endHour ?? b.startHour + 1)}
                            </span>
                            {b.ballType && b.ballType !== 'none' && (
                              <span className="text-accent-400 text-[10px] font-bold capitalize px-1.5 py-0.5 bg-accent-500/10 rounded">
                                🏏 {b.ballType.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="pt-3 border-t border-white/5 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[9px] font-black text-surface-500 uppercase tracking-widest leading-none">
                                Total
                              </p>
                              <p className="text-sm font-black text-white">₹{b.totalAmountGrouped || b.totalAmount}</p>
                            </div>
                            {!isBlocked && b.status === 'confirmed' && (b.paidAmountGrouped || b.paidAmount) < (b.totalAmountGrouped || b.totalAmount) && (
                              <>
                                <div className="text-right">
                                  <p className="text-[9px] font-black text-surface-500 uppercase tracking-widest leading-none">
                                    Paid
                                  </p>
                                  <p className="text-xs font-black text-green-400">₹{b.paidAmountGrouped || b.paidAmount}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[9px] font-black text-surface-500 uppercase tracking-widest leading-none">
                                    Bal
                                  </p>
                                  <p className="text-xs font-black text-amber-400">
                                    ₹{(b.totalAmountGrouped || b.totalAmount) - (b.paidAmountGrouped || b.paidAmount)}
                                  </p>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="flex gap-2 justify-end">
                            {b.status === 'confirmed' && (b.paidAmountGrouped || b.paidAmount) < (b.totalAmountGrouped || b.totalAmount) && (
                              <button
                                onClick={() => handleCollectPayment(b._id)}
                                className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg font-black uppercase tracking-tighter hover:bg-green-400/20 transition-all"
                              >
                                Collect Cash
                              </button>
                            )}
                            {isBlocked && (
                              <button
                                onClick={() => handleUnblockSlot(b.startHour, b.date, b.turfId)}
                                className="text-[10px] text-primary-400 bg-primary-400/10 border border-primary-400/20 px-3 py-1.5 rounded-lg font-black uppercase tracking-tighter hover:bg-primary-400/20 transition-all"
                              >
                                Unblock
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop: Table layout */}
                <div className="hidden sm:block overflow-x-auto bg-white/5 rounded-2xl border border-white/5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/5">
                        <th className="text-left py-3 px-4 text-surface-400 font-bold uppercase tracking-widest text-[10px]">
                          Customer
                        </th>
                        <th className="text-left py-3 px-4 text-surface-400 font-bold uppercase tracking-widest text-[10px]">
                          Arena
                        </th>
                        <th className="text-left py-3 px-4 text-surface-400 font-bold uppercase tracking-widest text-[10px]">
                          Schedule
                        </th>
                        <th className="text-left py-3 px-4 text-surface-400 font-bold uppercase tracking-widest text-[10px]">
                          Payment
                        </th>
                        <th className="text-left py-3 px-4 text-surface-400 font-bold uppercase tracking-widest text-[10px]">
                          Status
                        </th>
                        <th className="text-left py-3 px-4 text-surface-400 font-bold uppercase tracking-widest text-[10px]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => {
                        const rawUser = typeof b.userId === 'object' && b.userId !== null ? b.userId : null;
                        const FAKE_NAMES = ['ADMIN BLOCKED', 'ADMIN BLOCK', 'Admin Blocked'];
                        const user = rawUser && !FAKE_NAMES.includes(rawUser.name) && (rawUser.name || rawUser.phone) ? rawUser : null;
                        const isBlocked = b.status === 'blocked' || b.isBlocked;
                        return (
                          <tr key={b._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 text-white">
                              {user ? (
                                <div>
                                  {isBlocked && (
                                    <span className="inline-block text-[8px] bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded px-1 py-0.5 font-black uppercase tracking-wider mb-1">
                                      Desk Booked
                                    </span>
                                  )}
                                  <p className="font-bold text-sm tracking-tight">{user.name || user.phone}</p>
                                  {user.name && user.phone && <p className="text-xs text-surface-400">{user.phone}</p>}
                                </div>
                              ) : (
                                <div>
                                  {isBlocked && (
                                    <span className="inline-block text-[8px] bg-surface-600/30 text-surface-500 border border-surface-600/30 rounded px-1 py-0.5 font-black uppercase tracking-wider mb-1">
                                      Maintenance
                                    </span>
                                  )}
                                  <p className="font-bold text-sm text-surface-400">Slot Reserved</p>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded font-black text-xs ${
                                  b.turfId === 'A' ? 'bg-primary-500/20 text-primary-400' : 'bg-accent-500/20 text-accent-400'
                                }`}
                              >
                                Arena {b.turfId === 'A' ? '1' : '2'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <p className="text-sm font-bold text-white">{formatDate(b.date)}</p>
                              <p className="text-xs text-primary-400 font-bold">
                                {(b.startHours?.length ?? 0) > 1 ? `${b.startHours?.length} Slots: ` : ''}{' '}
                                {formatHour(b.startHours?.[0] ?? b.startHour)} - {formatHour(b.endHour ?? b.startHour + 1)}
                              </p>
                              {b.ballType && b.ballType !== 'none' && (
                                <p className="text-[10px] text-accent-400 font-bold capitalize mt-0.5">
                                  🏏 {b.ballType.replace('_', ' ')}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <p className="text-sm font-black text-white leading-none">
                                  ₹{b.totalAmountGrouped || b.totalAmount}
                                </p>
                                {!isBlocked && b.status === 'confirmed' && (b.paidAmountGrouped || b.paidAmount) < (b.totalAmountGrouped || b.totalAmount) && (
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 opacity-80 mt-1">
                                    <p className="text-[10px] text-green-500 font-black uppercase tracking-tighter">
                                      Paid: ₹{b.paidAmountGrouped || b.paidAmount}
                                    </p>
                                    <p className="text-[10px] text-amber-500 font-black uppercase tracking-tighter">
                                      Due: ₹{(b.totalAmountGrouped || b.totalAmount) - (b.paidAmountGrouped || b.paidAmount)}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                  b.status === 'confirmed' && isPastSlot(b.date, b.startHour)
                                    ? 'bg-primary-500/15 text-primary-400 border-primary-500/20'
                                    : b.status === 'confirmed'
                                    ? 'bg-green-500/15 text-green-400 border-green-500/20'
                                    : b.status === 'blocked'
                                    ? 'bg-red-500/15 text-red-300 border-red-500/20'
                                    : b.status === 'cancelled'
                                    ? 'bg-red-500/15 text-red-400 border-red-500/20'
                                    : b.status === 'pending'
                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                                    : 'bg-surface-500/15 text-surface-400 border-surface-500/20'
                                }`}
                              >
                                {b.status === 'confirmed' && isPastSlot(b.date, b.startHour) ? 'COMPLETED' : b.status}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                {b.status === 'confirmed' && (b.paidAmountGrouped || b.paidAmount) < (b.totalAmountGrouped || b.totalAmount) && (
                                  <button
                                    onClick={() => handleCollectPayment(b._id)}
                                    className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-lg font-black uppercase hover:bg-green-500/20 transition-colors"
                                  >
                                    Collect Cash
                                  </button>
                                )}
                                {isBlocked && (
                                  <button
                                    onClick={() => handleUnblockSlot(b.startHour, b.date, b.turfId)}
                                    className="text-[10px] text-primary-400 bg-primary-500/10 border border-primary-500/20 px-3 py-1 rounded-lg font-black uppercase hover:bg-primary-500/20 transition-colors"
                                  >
                                    Unblock
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-surface-500 font-bold">
                  Page {filterPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={filterPage <= 1}
                    onClick={() => setFilterPage((p) => Math.max(1, p - 1))}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-surface-300 disabled:opacity-40 hover:bg-white/10 transition-all"
                  >
                    <MdChevronLeft size={16} /> Prev
                  </button>
                  <button
                    disabled={filterPage >= totalPages}
                    onClick={() => setFilterPage((p) => Math.min(totalPages, p + 1))}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-surface-300 disabled:opacity-40 hover:bg-white/10 transition-all"
                  >
                    Next <MdChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === SLOTS VIEW (DESK CALENDAR) === */}
        {activeTab === 'slots' && (
          <div className="animate-fade-in space-y-4 sm:space-y-6">
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-surface-300 uppercase tracking-wider mb-3">
                Select Date
              </h3>
              <DatePicker dates={dates} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            </div>

            <div className="flex gap-2">
              {(['A', 'B'] as TurfId[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setSelectedTurf(t);
                    setSelectedAdminSlots([]);
                  }}
                  className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    selectedTurf === t
                      ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                      : 'bg-white/5 text-surface-400 border border-white/5 hover:bg-white/10'
                  }`}
                >
                  Arena {t === 'A' ? '1' : '2'}
                </button>
              ))}
            </div>

            {loadingSlots ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner text="Loading slots..." />
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
                {(() => {
                  const today = getTodayStr();
                  const currentHour = new Date().getHours();
                  const displaySlots = selectedDate === today ? slots.filter((s) => s.hour > currentHour) : slots;

                  return displaySlots.map((slot) => (
                    <div
                      key={slot.hour}
                      onClick={() => {
                        if (slot.status === 'available') {
                          setSelectedAdminSlots((prev) =>
                            prev.includes(slot.hour)
                              ? prev.filter((h) => h !== slot.hour)
                              : [...prev, slot.hour].sort((a, b) => a - b)
                          );
                        }
                      }}
                      className={`flex flex-col items-center p-2 sm:p-3 rounded-xl border transition-all cursor-pointer min-h-[80px] sm:min-h-[100px] ${
                        selectedAdminSlots.includes(slot.hour)
                          ? 'bg-amber-500/20 border-amber-500/50 ring-1 ring-amber-500/50'
                          : slot.status === 'blocked'
                          ? 'bg-surface-700/50 border-surface-600/30 cursor-not-allowed'
                          : slot.status === 'booked'
                          ? 'bg-primary-500/10 border-primary-500/20 opacity-60 cursor-not-allowed'
                          : 'bg-white/5 border-white/5 hover:border-primary-500/30'
                      }`}
                    >
                      <span className="text-[10px] sm:text-xs font-black text-surface-400 mb-1">
                        {formatHour(slot.hour)}
                      </span>
                      <span
                        className={`text-[9px] sm:text-[10px] font-bold uppercase ${
                          slot.status === 'available' ? 'text-green-400' : 'text-surface-500'
                        }`}
                      >
                        {slot.status}
                      </span>
                      {slot.status === 'available' && (
                        <span className="text-[10px] sm:text-[11px] font-black text-primary-400 mt-1">
                          ₹{slot.price}
                        </span>
                      )}
                      {slot.status === 'blocked' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnblockSlot(slot.hour);
                          }}
                          className="text-[9px] sm:text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 sm:py-1 rounded hover:bg-green-500/30 transition z-10 relative mt-1"
                        >
                          Unblock
                        </button>
                      )}
                      {slot.status === 'available' && !selectedAdminSlots.includes(slot.hour) && (
                        <span className="text-[9px] sm:text-[10px] bg-white/5 text-surface-400 px-2 py-0.5 sm:py-1 rounded transition mt-1">
                          Select
                        </span>
                      )}
                      {selectedAdminSlots.includes(slot.hour) && (
                        <span className="text-[9px] sm:text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 sm:py-1 rounded font-bold mt-1">
                          Selected
                        </span>
                      )}
                    </div>
                  ));
                })()}
              </div>
            )}

            {/* Blocked Slots Info */}
            {blockedSlots.length > 0 && (
              <div className="glass-card p-4 sm:p-5">
                <h3 className="font-display font-bold text-white text-sm sm:text-base mb-3">Currently Blocked</h3>
                <div className="space-y-2">
                  {blockedSlots.map((bs) => (
                    <div key={bs._id} className="flex items-center justify-between p-2.5 sm:p-3 bg-white/5 rounded-lg border border-white/5">
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm text-white">
                          Arena {bs.turfId === 'A' ? '1' : '2'} · {formatHour(bs.startHour)}
                        </span>
                        {bs.reason && (
                          <span className="text-[10px] sm:text-xs text-surface-400 ml-2 truncate">{bs.reason}</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleUnblockSlot(bs.startHour, bs.date, bs.turfId)}
                        className="text-[10px] sm:text-xs text-green-400 bg-green-500/15 px-2 py-1 rounded flex-shrink-0 ml-2 hover:bg-green-500/25 transition-colors"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Selection Bar for Walk-in Booking */}
        {selectedAdminSlots.length > 0 && activeTab === 'slots' && (() => {
          const BALL_PRICES: Record<string, number> = { light_tennis: 0, hard_tennis: 100, none: 0 };
          const selectedSlotPrices = selectedAdminSlots.map((h) => slots.find((s) => s.hour === h)?.price ?? 0);
          const slotsTotal = selectedSlotPrices.reduce((a, b) => a + b, 0);
          const ballTotal = walkinPhone ? BALL_PRICES[walkinBallType] || 0 : 0;
          const grandTotal = slotsTotal + ballTotal;

          return (
            <div className="fixed bottom-6 inset-x-0 mx-auto w-[90%] max-w-2xl z-50 animate-slide-up">
              <div className="bg-surface-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <span className="text-white font-bold">
                    {selectedAdminSlots.length} {selectedAdminSlots.length === 1 ? 'Slot' : 'Slots'} Selected
                  </span>
                  {grandTotal > 0 && <span className="text-primary-400 font-black text-sm ml-3">₹{grandTotal}</span>}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedAdminSlots([])}
                    className="text-surface-400 hover:text-white px-3 py-2 text-sm transition font-medium"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => {
                      setWalkinName('');
                      setWalkinPhone('');
                      setWalkinPaymentType('full');
                      setWalkinBallType('none');
                      setCustomAdvanceAmount('');
                      setWalkinMode('block');
                      setShowBlockModal(true);
                    }}
                    className="btn-primary py-2 px-6 shadow-xl text-sm whitespace-nowrap"
                  >
                    Block / Walk-in
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Block / Walk-in Modal */}
        <Modal
          isOpen={showBlockModal}
          onClose={() => setShowBlockModal(false)}
          title={`Block ${selectedAdminSlots.length} Slots (Arena ${selectedTurf === 'A' ? '1' : '2'} - ${formatDate(
            selectedDate
          )})`}
        >
          <div className="space-y-4">
            <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-1.5 text-xs text-surface-450">
              <p className="font-bold text-white uppercase text-[10px] tracking-wider">Select Mode:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWalkinMode('block');
                    setWalkinPhone('');
                    setWalkinName('');
                  }}
                  className={`py-2 px-3 rounded-lg border text-center font-bold transition-all ${
                    walkinMode === 'block'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                      : 'bg-white/5 border-white/5 text-surface-400 hover:bg-white/10'
                  }`}
                >
                  🛠 Maintenance Block
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWalkinMode('walkin');
                    setWalkinPhone('');
                    setWalkinName('');
                  }}
                  className={`py-2 px-3 rounded-lg border text-center font-bold transition-all ${
                    walkinMode === 'walkin'
                      ? 'bg-primary-500/20 border-primary-500/40 text-primary-400'
                      : 'bg-white/5 border-white/5 text-surface-400 hover:bg-white/10'
                  }`}
                >
                  🏏 Walk-in Booking
                </button>
              </div>
            </div>

            {walkinMode === 'block' ? (
              /* Maintenance Block Input */
              <div>
                <label className="block text-xs font-bold uppercase text-surface-500 mb-1.5">
                  Block Reason / Details (Optional)
                </label>
                <input
                  type="text"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  placeholder="e.g. Maintenance, Corporate booking, etc."
                  className="input-field"
                />
              </div>
            ) : (
              /* Walk-in Booking Inputs */
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-surface-500 mb-1.5">Customer Phone</label>
                  <input
                    type="tel"
                    value={walkinPhone}
                    onChange={(e) => setWalkinPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Enter 10-digit number"
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-surface-500 mb-1.5">Customer Name</label>
                  <input
                    type="text"
                    value={walkinName}
                    onChange={(e) => setWalkinName(e.target.value)}
                    placeholder="Enter customer name"
                    className="input-field"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-surface-500 mb-1.5">Cricket Ball Hire</label>
                    <select
                      value={walkinBallType}
                      onChange={(e) => setWalkinBallType(e.target.value)}
                      className="w-full bg-surface-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500/50"
                    >
                      <option value="none">No Ball Hire (₹0)</option>
                      <option value="light_tennis">Light Tennis Ball (FREE)</option>
                      <option value="hard_tennis">Hard Tennis Ball (₹100)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-surface-500 mb-1.5">Payment Model</label>
                    <select
                      value={walkinPaymentType}
                      onChange={(e) => setWalkinPaymentType(e.target.value as 'full' | 'advance')}
                      className="w-full bg-surface-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500/50"
                    >
                      <option value="full">Full Payment Collected</option>
                      <option value="advance">Advance Payment</option>
                    </select>
                  </div>
                </div>

                {walkinPaymentType === 'advance' && (() => {
                  const BALL_PRICES: Record<string, number> = { light_tennis: 0, hard_tennis: 100, none: 0 };
                  const slotsTotal = selectedAdminSlots.reduce((a, h) => a + (slots.find((s) => s.hour === h)?.price ?? 0), 0);
                  const grandTotal = slotsTotal + (BALL_PRICES[walkinBallType] || 0);
                  const defaultAdvance = Math.round(grandTotal * 0.3);
                  const currentAdvance = customAdvanceAmount !== '' ? Number(customAdvanceAmount) : defaultAdvance;
                  const remainingDue = grandTotal - currentAdvance;

                  return (
                    <div className="pt-2 animate-fade-in space-y-1">
                      <label className="block text-xs font-bold uppercase text-surface-500 mb-1.5">
                        Advance Amount Paid (₹)
                      </label>
                      <input
                        type="number"
                        className="input-field"
                        placeholder={`Default: ₹${defaultAdvance}`}
                        value={customAdvanceAmount}
                        onChange={(e) => setCustomAdvanceAmount(e.target.value)}
                      />
                      <p className="text-[10px] text-surface-500 font-bold mt-1">
                        Remaining Due: ₹{remainingDue}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                className="btn-secondary flex-1"
                disabled={blockingInProgress}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                className="btn-primary flex-1"
                disabled={blockingInProgress || (walkinMode === 'walkin' && (!walkinName || walkinPhone.length !== 10))}
              >
                {blockingInProgress ? 'Processing...' : walkinMode === 'block' ? 'Confirm Block' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </Modal>



        {/* Collect Cash Modal */}
        <Modal isOpen={!!paymentBookingId} onClose={() => setPaymentBookingId(null)} title="Collect Cash Payment">
          <div className="space-y-4">
            <p className="text-sm text-surface-400">
              Has the customer paid the remaining balance in cash? Confirming this will mark the booking's payment as
              fully paid.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPaymentBookingId(null)}
                className="btn-secondary flex-1"
                disabled={collectingPayment}
              >
                Cancel
              </button>
              <button
                onClick={confirmCollection}
                className="btn-primary flex-1"
                disabled={collectingPayment}
              >
                {collectingPayment ? 'Saving...' : 'Yes, Collected'}
              </button>
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
};

export default WorkerDashboard;
