import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import DatePicker from '../components/DatePicker';
import {
  getAdminStats,
  getAdminBookings,
  adminCancelBooking,
  adminCollectPayment,
  blockSlotAdmin,
  unblockSlotAdmin,
  getBlockedSlots,
  getPricingRules,
  updatePricingRule,
  getSlots,
  migrateWalkIns,
} from '../services/api';
import { formatDate, formatHour, formatCurrency, getDateRange, getTodayStr, getRelativeTime, isPastSlot } from '../utils/helpers';
import type { DashboardStats, Booking, PricingRule, BlockedSlotInfo, TurfId, SlotInfo } from '../types';
import toast from 'react-hot-toast';
import {
  MdDashboard,
  MdBookOnline,
  MdBlock,
  MdCurrencyRupee,
  MdPeople,
  MdCheckCircle,
  MdSportsCricket,
  MdRefresh,
  MdAttachMoney,
  MdSearch,
  MdFilterList,
  MdChevronLeft,
  MdChevronRight,
  MdClose,
} from 'react-icons/md';

type AdminTab = 'dashboard' | 'bookings' | 'slots' | 'pricing';

const groupBookingsList = (bookingsList: any[]) => {
  if (!bookingsList || !Array.isArray(bookingsList)) return [];
  const groups: { [key: string]: any } = {};
  bookingsList.forEach((booking: any) => {
    const key = booking.razorpayOrderId || booking.groupId || booking._id;
    if (!groups[key]) {
      groups[key] = {
        ...booking,
        startHours: [booking.startHour],
        endHour: booking.startHour + 1,
        totalAmountGrouped: Number(booking.totalAmount) || 0,
        paidAmountGrouped: Number(booking.paidAmount) || 0,
      };
    } else {
      groups[key].startHours.push(booking.startHour);
      groups[key].startHours.sort((a: number, b: number) => a - b);
      groups[key].endHour = Math.max(...groups[key].startHours) + 1;
      groups[key].totalAmountGrouped += (Number(booking.totalAmount) || 0);
      groups[key].paidAmountGrouped += (Number(booking.paidAmount) || 0);
      if (booking.ballType && booking.ballType !== 'none') {
        groups[key].ballType = booking.ballType;
      }
    }
  });
  // Sort back to their original rough order based on createdAt or date
  return Object.values(groups).sort((a: any, b: any) => {
    const timeA = new Date(a.date + 'T' + String(a.startHours[0]).padStart(2, '0') + ':00').getTime();
    const timeB = new Date(b.date + 'T' + String(b.startHours[0]).padStart(2, '0') + ':00').getTime();
    return timeB - timeA; // default to desc like recent
  });
};

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bookings, setBookings] = useState<any[]>([]); // GroupedBooking
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [selectedTurf, setSelectedTurf] = useState<TurfId>('A');
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlotInfo[]>([]);

  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [editPrice, setEditPrice] = useState('');

  const [filterDate, setFilterDate] = useState(getTodayStr());
  const [filterTurf, setFilterTurf] = useState('');
  const [filterStatus, setFilterStatus] = useState('confirmed');
  const [filterCompleted, setFilterCompleted] = useState(false); // show completed by default
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
  const [blockingInProgress, setBlockingInProgress] = useState(false);

  const [showUpcoming, setShowUpcoming] = useState(false);

  // Stats filters
  const [statsMonth, setStatsMonth] = useState(String(new Date().getMonth() + 1));
  const [statsYear, setStatsYear] = useState(String(new Date().getFullYear()));
  const [statsDay, setStatsDay] = useState('');
  const [statsShowAll, setStatsShowAll] = useState(false);

  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState(false);
  const [paymentBookingId, setPaymentBookingId] = useState<string | null>(null);
  const [collectingPayment, setCollectingPayment] = useState(false);

  // Memoize dates so the array reference is stable across renders.
  // Without this, DatePicker re-mounts every render → double-click needed to select a date.
  const dates = useMemo(() => getDateRange(30), []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      let specificDate = '';
      if (statsDay) {
        specificDate = `${statsYear}-${statsMonth.padStart(2, '0')}-${statsDay.padStart(2, '0')}`;
      }
      const res = await getAdminStats({ month: statsMonth, year: statsYear, date: specificDate, showAll: statsShowAll });
      if (res.success && res.data) {
        const statsData = res.data;
        if (statsData.recentBookings) statsData.recentBookings = groupBookingsList(statsData.recentBookings);
        if (statsData.upcomingBookings) {
          statsData.upcomingBookings = groupBookingsList(statsData.upcomingBookings);
          // Sort upcoming ascending rather than descending
          statsData.upcomingBookings.reverse();
        }
        setStats(statsData);
      }
    } catch {
      toast.error('Failed to load stats');
    } finally {
      setLoadingStats(false);
    }
  }, [statsMonth, statsYear, statsDay, statsShowAll]);

  const fetchBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const params: Record<string, string | number> = { page: filterPage, limit: 24 };
      if (filterDate) params.date = filterDate;
      if (filterTurf) params.turfId = filterTurf;
      if (filterStatus) params.status = filterStatus;
      if (filterSearch) params.search = filterSearch;

      const res = await getAdminBookings(params);
      if (res.success && res.data) {
        // Group bookings by razorpayOrderId
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
          // Sort by Date first
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          // Then by Start Hour (Ascending: 12am -> 11pm)
          const hourA = a.startHours[0];
          const hourB = b.startHours[0];
          if (hourA !== hourB) return hourA - hourB;
          // Then by Turf ID (A -> B)
          return a.turfId.localeCompare(b.turfId);
        });

        // Strip completed bookings (both explicitly 'completed' status AND past confirmed slots)
        // unless the admin explicitly toggles "Show Completed" on.
        if (filterCompleted) {
          grouped = grouped.filter((b: any) =>
            b.status !== 'completed' &&
            !(b.status === 'confirmed' && isPastSlot(b.date, b.endHour ?? b.startHour))
          );
        }

        setBookings(grouped);
        setTotalPages(res.data.pagination.pages);
      }
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoadingBookings(false);
    }
  }, [filterDate, filterTurf, filterStatus, filterSearch, filterPage, filterCompleted]);

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

  const fetchPricing = useCallback(async () => {
    setLoadingPricing(true);
    try {
      const res = await getPricingRules();
      if (res.success && res.data) setPricingRules(res.data);
    } catch {
      toast.error('Failed to load pricing');
    } finally {
      setLoadingPricing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (activeTab === 'bookings') fetchBookings(); }, [activeTab, fetchBookings]);
  useEffect(() => { if (activeTab === 'slots') fetchSlots(); }, [activeTab, fetchSlots]);
  useEffect(() => { if (activeTab === 'pricing') fetchPricing(); }, [activeTab, fetchPricing]);

  // Silently migrate any old walk-in BlockedSlots to real Bookings on first load
  useEffect(() => {
    migrateWalkIns().catch(() => {/* silent */ });
  }, []);

  const handleCancelBooking = (bookingId: string) => {
    setCancelBookingId(bookingId);
  };

  const confirmCancellation = async () => {
    if (!cancelBookingId) return;
    setCancellingBooking(true);
    try {
      const res = await adminCancelBooking(cancelBookingId);
      if (res.success) {
        toast.success('Booking cancelled');
        fetchBookings();
        fetchStats();
        setCancelBookingId(null);
      }
    } catch {
      toast.error('Failed to cancel');
    } finally {
      setCancellingBooking(false);
    }
  };

  const handleCollectPayment = (bookingId: string) => {
    setPaymentBookingId(bookingId);
  };

  const confirmCollection = async () => {
    if (!paymentBookingId) return;
    setCollectingPayment(true);
    try {
      const res = await adminCollectPayment(paymentBookingId);
      if (res.success) {
        toast.success('Payment collected');
        fetchBookings();
        fetchStats();
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
      const res = await blockSlotAdmin(
        selectedTurf,
        selectedDate,
        selectedAdminSlots,
        walkinName ? `Walk-in: ${walkinName}` : 'Admin Block',
        walkinPhone,
        walkinName,
        walkinPhone ? walkinBallType : 'none'
      );

      if (res.success) {
        if (walkinPhone) {
          toast.success(`✅ Walk-in booking confirmed for ${walkinName || walkinPhone}!`);
        } else {
          toast.success('Slot blocked (maintenance)');
        }
        setShowBlockModal(false);
        fetchSlots();
        fetchStats();
        fetchBookings();
        setSelectedAdminSlots([]);
      } else {
        toast.error(res.message || 'Failed to process');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to process slot');
    } finally {
      setBlockingInProgress(false);
    }
  };

  const handleUnblockSlot = async (hour: number, date?: string, turf?: TurfId) => {
    try {
      const res = await unblockSlotAdmin(turf || selectedTurf, date || selectedDate, hour);
      if (res.success) {
        toast.success('Slot unblocked');
        fetchSlots();
        if (activeTab === 'bookings') fetchBookings();
      }
    } catch { toast.error('Failed to unblock'); }
  };

  const handleUpdatePricing = async () => {
    if (!editingRule) return;
    const price = parseInt(editPrice, 10);
    if (isNaN(price) || price < 0) { toast.error('Invalid price'); return; }
    try {
      const res = await updatePricingRule(editingRule._id, price, editingRule.isActive);
      if (res.success) { toast.success('Price updated'); setEditingRule(null); fetchPricing(); }
      else { toast.error(res.message || 'Failed to update'); }
    } catch (error: any) {
      console.error(error);
      const msg = error?.response?.data?.message || 'Failed to update';
      toast.error(msg);
    }
  };

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard', label: 'Overview', icon: <MdDashboard size={18} /> },
    { key: 'bookings', label: 'Bookings', icon: <MdBookOnline size={18} /> },
    { key: 'slots', label: 'Slots', icon: <MdBlock size={18} /> },
    { key: 'pricing', label: 'Pricing', icon: <MdAttachMoney size={18} /> },
  ];

  /* ─── RENDER ─── */
  return (
    <div className="min-h-screen bg-surface-950">
      <Navbar />
      <main className="pt-20 pb-12 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-4 sm:mb-6 animate-fade-in flex flex-col gap-3">
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white">
            Admin <span className="gradient-text">Dashboard</span>
          </h1>

          {/* Scrolling Marquee for Bookings */}
          {stats && (
            <div className="w-full overflow-hidden bg-white/5 border border-white/10 rounded-lg py-2 flex flex-col justify-center gap-1.5 relative h-16 sm:h-16 shadow-inner">

              {/* CURRENTLY RUNNING Ticker */}
              <div className="w-full relative h-[1.2rem] sm:h-[1.4rem]">
                <div className="absolute whitespace-nowrap animate-shimmer flex items-center h-full text-xs sm:text-sm font-bold text-surface-300" style={{ animationDuration: '16s' }}>
                  {(() => {
                    const today = getTodayStr();
                    const currentHour = new Date().getHours();
                    const running = [
                      ...(stats.upcomingBookings || []),
                      ...(stats.recentBookings || [])
                    ].filter(b => b.date === today && b.startHour === currentHour && b.status === 'confirmed');

                    const uniqueRunning = Array.from(new Map(running.map(b => [b._id, b])).values());

                    return (
                      <div className="flex gap-8">
                        {['A', 'B'].map(turf => {
                          const match = uniqueRunning.find(b => b.turfId === turf);
                          if (match) {
                            const u = typeof match.userId === 'object' ? match.userId : null;
                            const nameOrPhone = u ? `${u.name || ''} ${u.phone || ''}`.trim() || 'Walk-in' : 'Reserved';
                            return (
                              <span key={turf} className="text-green-400">
                                🟢 CURRENTLY RUNNING: Arena {match.turfId === 'A' ? '1' : '2'} | Customer: {nameOrPhone} | {formatDate(match.date)} | {formatHour(match.startHour)} to {formatHour(match.startHour + 1)}
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

              {/* UPCOMING NEXT HOUR Ticker */}
              <div className="w-full relative h-[1.2rem] sm:h-[1.4rem]">
                <div className="absolute whitespace-nowrap animate-shimmer flex items-center h-full text-[11px] sm:text-[13px] font-bold text-surface-400" style={{ animationDuration: '22s', animationDelay: '-8s' }}>
                  {(() => {
                    let d = new Date();
                    d.setHours(d.getHours() + 1);
                    const nextYear = d.getFullYear();
                    const nextMonth = String(d.getMonth() + 1).padStart(2, '0');
                    const nextDay = String(d.getDate()).padStart(2, '0');
                    const nextDs = `${nextYear}-${nextMonth}-${nextDay}`;
                    const searchHour = d.getHours();

                    const nextBookings = [
                      ...(stats.upcomingBookings || [])
                    ].filter(b => b.date === nextDs && b.startHour === searchHour && b.status === 'confirmed');

                    const uniqueNext = Array.from(new Map(nextBookings.map(b => [b._id, b])).values());

                    return (
                      <div className="flex gap-8">
                        {['A', 'B'].map(turf => {
                          const match = uniqueNext.find(b => b.turfId === turf);
                          if (match) {
                            const u = typeof match.userId === 'object' ? match.userId : null;
                            const nameOrPhone = u ? `${u.name || ''} ${u.phone || ''}`.trim() || 'Walk-in' : 'Reserved';
                            return (
                              <span key={turf} className="text-cyan-400">
                                ⏩ NEXT HOUR: Arena {match.turfId === 'A' ? '1' : '2'} | Customer: {nameOrPhone} | {formatHour(match.startHour)} to {formatHour(match.startHour + 1)}
                              </span>
                            );
                          }
                          return (
                            <span key={turf} className="text-surface-600">
                              ⏩ Arena {turf === 'A' ? '1' : '2'}: Next slot is empty / available!
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
          )}
        </div>

        {/* Tabs - scrollable on mobile */}
        <div className="flex gap-1 mb-6 sm:mb-8 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${activeTab === tab.key
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                : 'bg-white/5 text-surface-400 border border-white/5 hover:bg-white/10'
                }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ═══ DASHBOARD TAB ═══ */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in">
            {loadingStats ? (
              <div className="flex justify-center py-20">
                <LoadingSpinner size="lg" text="Loading statistics..." />
              </div>
            ) : stats ? (
              <div className="space-y-4 sm:space-y-6">

                {/* Stats Filter Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-[10px] sm:text-xs font-bold text-surface-400 uppercase tracking-widest">Filter:</label>
                    <select
                      value={statsMonth}
                      onChange={(e) => { setStatsMonth(e.target.value); setStatsDay(''); }}
                      disabled={statsShowAll}
                      className="bg-surface-900 border border-white/10 text-white text-xs rounded-lg px-2 py-1 outline-none disabled:opacity-50"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={String(m)}>{new Date(2000, m - 1).toLocaleString('default', { month: 'short' })}</option>
                      ))}
                    </select>
                    <select
                      value={statsYear}
                      onChange={(e) => { setStatsYear(e.target.value); setStatsDay(''); }}
                      disabled={statsShowAll}
                      className="bg-surface-900 border border-white/10 text-white text-xs rounded-lg px-2 py-1 outline-none disabled:opacity-50"
                    >
                      {[0, 1, 2].map(offset => {
                        const y = new Date().getFullYear() + offset - 1;
                        return <option key={y} value={String(y)}>{y}</option>;
                      })}
                    </select>

                    <select
                      value={statsDay}
                      onChange={(e) => setStatsDay(e.target.value)}
                      disabled={statsShowAll}
                      className="bg-surface-900 border border-white/10 text-white text-xs rounded-lg px-2 py-1 outline-none disabled:opacity-50"
                    >
                      <option value="">All Days</option>
                      {Array.from(
                        { length: new Date(Number(statsYear), Number(statsMonth), 0).getDate() },
                        (_, i) => i + 1
                      ).map(d => (
                        <option key={d} value={String(d)}>Day {d}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => setStatsShowAll(!statsShowAll)}
                    className={`flex items-center justify-center px-4 py-1.5 rounded-lg border transition-all duration-300 sm:w-auto w-full text-[10px] sm:text-xs font-black uppercase tracking-widest focus:outline-none ${statsShowAll
                      ? 'bg-primary-500/20 text-primary-400 border-primary-500/50 shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                      : 'bg-white/5 hover:bg-white/10 text-surface-300 hover:text-white border-white/5'
                      }`}
                  >
                    {statsShowAll ? 'Showing All-Time' : 'Show All-Time'}
                  </button>
                </div>

                {/* Stats Grid Redesigned */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">

                  <div className="md:col-span-2 lg:col-span-4 relative group rounded-3xl p-6 sm:p-8 border border-green-500/20 bg-gradient-to-br from-green-500/10 via-transparent to-transparent">
                    {/* Background Clipping Container */}
                    <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                      <div className="absolute -right-10 -top-10 w-40 h-40 bg-green-500/10 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity" />
                    </div>

                    <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center text-green-400 shadow-lg shadow-green-500/20">
                          <MdCurrencyRupee size={32} />
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-surface-500 mb-1">Gross Revenue</p>
                          <h3 className="text-4xl sm:text-6xl font-display font-black text-white">{formatCurrency(stats.totalRevenue ?? 0)}</h3>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 sm:gap-8">
                        <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-surface-500 mb-1">Online</p>
                          <p className="text-xl font-black text-primary-400">{formatCurrency(stats.onlineRevenue ?? 0)}</p>
                        </div>
                        <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-surface-500 mb-1">Cash/Walk-in</p>
                          <p className="text-xl font-black text-amber-500">{formatCurrency(stats.walkinRevenue ?? 0)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                      <div className="flex gap-4">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-surface-400">
                          <span className="w-2 h-2 rounded-full bg-green-500" /> {stats.confirmedBookings ?? 0} Completed Sessions
                        </span>
                      </div>

                      <div className="relative">
                        <button
                          onClick={() => setShowUpcoming(!showUpcoming)}
                          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-[11px] uppercase tracking-widest font-black text-white transition-all active:scale-95"
                        >
                          Upcoming ▾
                        </button>

                        {showUpcoming && (
                          <div className="absolute right-0 top-full mt-3 w-72 sm:w-80 bg-surface-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-scale-in">
                            <div className="px-4 py-3 bg-white/5 border-b border-white/10">
                              <h4 className="text-[10px] font-black uppercase tracking-wider text-surface-400">
                                Upcoming Next
                              </h4>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                              {(stats.upcomingBookings || []).length > 0 ? (
                                stats.upcomingBookings.map((b) => {
                                  const u = typeof b.userId === 'object' ? b.userId : null;
                                  return (
                                    <div key={b._id} className="p-4 border-b border-white/5 hover:bg-white/5 transition flex justify-between items-center gap-3">
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{u?.name || u?.phone || 'Guest'}</p>
                                        <p className="text-[10px] text-surface-500">
                                          {formatDate(b.date)} · T{b.turfId}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-[10px] font-black text-primary-400">{formatHour(b.startHours?.[0] ?? b.startHour)}</p>
                                        <p className="text-[9px] text-surface-600 font-bold uppercase">{b.status}</p>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="p-8 text-center text-surface-600 text-[11px] font-bold">No upcoming bookings</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Secondary Stats Cards */}
                  {[
                    { label: 'Total Users', value: stats.totalUsers ?? 0, icon: <MdPeople size={24} />, color: 'purple', sub: 'Registered' },
                    { label: 'Total Bookings', value: stats.totalBookings ?? 0, icon: <MdCheckCircle size={24} />, color: 'primary', sub: 'Across all time' },
                    { label: 'Arena 1 Income', value: (stats.revenueByTurf ?? []).find(t => t._id === 'A')?.total ?? 0, icon: <MdSportsCricket size={24} />, color: 'primary', sub: `${(stats.revenueByTurf ?? []).find(t => t._id === 'A')?.count ?? 0} Games` },
                    { label: 'Arena 2 Income', value: (stats.revenueByTurf ?? []).find(t => t._id === 'B')?.total ?? 0, icon: <MdSportsCricket size={24} />, color: 'accent', sub: `${(stats.revenueByTurf ?? []).find(t => t._id === 'B')?.count ?? 0} Games` },
                    { label: 'Ball Revenue', value: stats.totalBallRevenue ?? 0, icon: <MdAttachMoney size={24} />, color: 'amber', sub: 'Equipment' },
                  ].map((stat, idx) => (
                    <div key={idx} className={`group relative overflow-hidden rounded-3xl p-6 border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300`}>
                      <div className="relative z-10 flex flex-col gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                          stat.color === 'primary' ? 'bg-primary-500/20 text-primary-400' :
                          stat.color === 'accent' ? 'bg-accent-500/20 text-accent-400' :
                          stat.color === 'amber' ? 'bg-amber-500/20 text-amber-400' :
                          stat.color === 'purple' ? 'bg-purple-500/20 text-purple-400' : 'bg-white/10'
                          }`}>
                          {stat.icon}
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-surface-500 mb-1">{stat.label}</p>
                          <h4 className="text-2xl font-black text-white">
                            {typeof stat.value === 'number' && stat.label.includes('Income') ? formatCurrency(stat.value) : stat.value}
                          </h4>
                          <p className="text-[10px] text-surface-600 font-bold mt-1">{stat.sub}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Today's Occupancy */}
                <div className="glass-card p-4 sm:p-6 bg-gradient-to-br from-primary-500/10 to-transparent border-primary-500/10">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-primary-400">Today's Occupancy</p>
                      <span className="text-sm sm:text-base text-white font-black">{stats.todayOccupancy ?? 0}/48</span>
                    </div>
                    <div className="h-2.5 sm:h-3 w-full bg-white/5 rounded-full overflow-hidden flex">
                      <div className="h-full bg-primary-500 transition-all duration-1000" style={{ width: `${((stats.todayBookings ?? 0) / 48) * 100}%` }} />
                      <div className="h-full bg-red-500/50 transition-all duration-1000" style={{ width: `${((stats.todayBlocked ?? 0) / 48) * 100}%` }} />
                    </div>
                    <div className="flex gap-4 text-[10px] sm:text-xs font-bold text-surface-400">
                      <span>🟦 Booked: {stats.todayBookings ?? 0}</span>
                      <span>🟥 Blocked: {stats.todayBlocked ?? 0}</span>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="glass-card p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h3 className="font-display font-bold text-white text-sm sm:text-base">Recent Activity</h3>
                    <button onClick={fetchStats} className="p-1.5 sm:p-2 rounded-lg bg-white/5 text-surface-400 hover:text-white transition-colors">
                      <MdRefresh size={18} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(stats.recentBookings ?? []).length > 0 ? (
                      stats.recentBookings.map((booking) => {
                        const user = typeof booking.userId === 'object' ? booking.userId : null;
                        return (
                          <div key={booking._id} className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/5">
                            <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${booking.turfId === 'A' ? 'bg-primary-500/15 text-primary-400' : 'bg-accent-500/15 text-accent-400'
                              }`}>
                              <MdSportsCricket size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-white truncate">{user?.name || user?.phone || 'Guest'}</p>
                              <p className="text-[10px] sm:text-xs text-surface-500 truncate">
                                Arena {booking.turfId === 'A' ? '1' : '2'} · {formatDate(booking.date)} · {(booking.startHours?.length ?? 0) > 1 ? `${booking.startHours?.length} Slots: ` : ''}{formatHour(booking.startHours?.[0] ?? booking.startHour)} - {formatHour(booking.endHour ?? booking.startHour + 1)}
                                {booking.ballType && booking.ballType !== 'none' && ` · 🏏 ${booking.ballType.replace('_', ' ')}`}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs sm:text-sm font-black text-white">{formatCurrency(booking.totalAmountGrouped ?? booking.totalAmount ?? 0)}</p>
                              <p className="text-[9px] sm:text-[10px] text-surface-500 font-bold">{getRelativeTime(booking.createdAt)}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-center py-8 text-surface-500 text-sm">No recent activity</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-card p-8 sm:p-12 text-center">
                <MdBlock className="text-red-400 mx-auto mb-4" size={40} />
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Failed to Load</h3>
                <p className="text-surface-400 text-sm mb-6">Check your connection and try again.</p>
                <button onClick={fetchStats} className="btn-primary px-8">Retry</button>
              </div>
            )}
          </div>
        )}

        {/* ═══ BOOKINGS TAB ═══ */}
        {activeTab === 'bookings' && (
          <div className="animate-fade-in space-y-4">
            {/* Search + Filter Row */}
            <div className="flex gap-2">
              {/* Search Input */}
              <div className="relative flex-1">
                <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" size={18} />
                <input
                  type="text"
                  value={filterSearch}
                  onChange={(e) => { setFilterSearch(e.target.value); setFilterPage(1); }}
                  placeholder="Search by name or phone..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-primary-500/50"
                />
                {filterSearch && (
                  <button onClick={() => setFilterSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white">
                    <MdClose size={16} />
                  </button>
                )}
              </div>

              {/* Filter Dropdown Button */}
              <div className="relative">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-bold transition-all ${(filterDate !== getTodayStr() || filterTurf || filterStatus !== 'confirmed' || filterCompleted)
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

                {/* Dropdown Panel */}
                {showFilters && (
                  <div className="absolute right-0 top-full mt-2 z-30 w-64 bg-surface-900 border border-white/10 rounded-2xl shadow-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-black uppercase tracking-widest text-surface-400">Filters</p>
                      <button
                        onClick={() => { setFilterDate(getTodayStr()); setFilterTurf(''); setFilterStatus('confirmed'); setFilterCompleted(false); setFilterPage(1); setShowFilters(false); }}
                        className="text-[10px] text-primary-400 font-bold hover:text-primary-300"
                      >Reset</button>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-surface-500 mb-1">Date</label>
                      <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => { setFilterDate(e.target.value); setFilterPage(1); }}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-surface-500 mb-1">Arena</label>
                      <select
                        value={filterTurf}
                        onChange={(e) => { setFilterTurf(e.target.value); setFilterPage(1); }}
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
                        onChange={(e) => { setFilterStatus(e.target.value); setFilterPage(1); }}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500/50"
                      >
                        <option value="">All Status</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="blocked">Blocked</option>
                        <option value="pending">Pending</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    {/* Show/hide completed bookings toggle */}
                    <div className="flex items-center justify-between pt-1">
                      <label className="text-[10px] font-bold uppercase text-surface-500">Show Completed</label>
                      <button
                        onClick={() => setFilterCompleted(prev => !prev)}
                        className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${!filterCompleted ? 'bg-primary-500' : 'bg-surface-700'
                          }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${!filterCompleted ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                      </button>
                    </div>

                    <button
                      onClick={() => setShowFilters(false)}
                      className="w-full btn-primary py-2 text-sm rounded-xl mt-1"
                    >Apply</button>
                  </div>
                )}
              </div>
            </div>

            {loadingBookings ? (
              <div className="flex justify-center py-12"><LoadingSpinner text="Loading bookings..." /></div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-12 text-surface-400 bg-white/5 rounded-2xl border border-white/5">No bookings found</div>
            ) : (
              <>
                {/* Mobile: Card layout */}
                <div className="sm:hidden space-y-3">
                  {bookings.map((b) => {
                    const rawUser = typeof b.userId === 'object' && b.userId !== null ? b.userId : null;
                    // Filter out legacy fake "ADMIN BLOCKED" user objects only — real customers always show
                    const FAKE_NAMES = ['ADMIN BLOCKED', 'ADMIN BLOCK', 'Admin Blocked'];
                    const user = rawUser && !FAKE_NAMES.includes(rawUser.name) && (rawUser.name || rawUser.phone) ? rawUser : null;
                    const isBlocked = b.status === 'blocked' || b.isBlocked;
                    return (
                      <div key={b._id} className="glass-card p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            {user ? (
                              <>
                                {isBlocked && (
                                  <span className="inline-block text-[8px] bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded px-1 py-0.5 font-black uppercase tracking-wider mb-1">Admin Booked</span>
                                )}
                                <p className="text-sm font-black text-white">{user.name || user.phone}</p>
                                {user.name && user.phone && <p className="text-[10px] text-surface-400">{user.phone}</p>}
                              </>
                            ) : (
                              <div>
                                {isBlocked && (
                                  <span className="inline-block text-[8px] bg-surface-600/30 text-surface-500 border border-surface-600/30 rounded px-1 py-0.5 font-black uppercase tracking-wider mb-1">Maintenance</span>
                                )}
                                <p className="text-sm font-black text-surface-400">Slot Reserved</p>
                              </div>
                            )}
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${b.status === 'confirmed' && isPastSlot(b.date, b.startHour) ? 'bg-primary-500/15 text-primary-400 border-primary-500/20'
                            : b.status === 'confirmed' ? 'bg-green-500/15 text-green-400 border-green-500/20'
                              : b.status === 'blocked' ? 'bg-red-500/15 text-red-300 border-red-500/20'
                                : b.status === 'cancelled' ? 'bg-red-500/15 text-red-400 border-red-500/20'
                                  : b.status === 'pending' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                                    : 'bg-surface-500/15 text-surface-400 border-surface-500/20'
                            }`}>{b.status === 'confirmed' && isPastSlot(b.date, b.startHour) ? 'COMPLETED' : b.status}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className={`px-1.5 py-0.5 rounded font-black text-[10px] ${b.turfId === 'A' ? 'bg-primary-500/20 text-primary-400' : 'bg-accent-500/20 text-accent-400'}`}>
                              Arena {b.turfId === 'A' ? '1' : '2'}
                            </span>
                            <span className="text-surface-400">{formatDate(b.date)}</span>
                            <span className="text-primary-400 font-bold">{(b.startHours?.length ?? 0) > 1 ? `${b.startHours?.length} Slots: ` : ''} {formatHour(b.startHours?.[0] ?? b.startHour)} - {formatHour(b.endHour ?? b.startHour + 1)}</span>
                            {b.ballType && b.ballType !== 'none' && (
                              <span className="text-accent-400 text-[10px] font-bold capitalize px-1.5 py-0.5 bg-accent-500/10 rounded">🏏 {b.ballType.replace('_', ' ')}</span>
                            )}
                          </div>
                        </div>
                        <div className="pt-3 border-t border-white/5 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[9px] font-black text-surface-500 uppercase tracking-widest leading-none">Total</p>
                              <p className="text-sm font-black text-white">₹{b.totalAmountGrouped || b.totalAmount}</p>
                            </div>
                            {!isBlocked && b.paymentType === 'advance' && (
                              <>
                                <div className="text-right">
                                  <p className="text-[9px] font-black text-surface-500 uppercase tracking-widest leading-none">Paid</p>
                                  <p className="text-xs font-black text-green-400">₹{b.paidAmountGrouped || b.paidAmount}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[9px] font-black text-surface-500 uppercase tracking-widest leading-none">Bal</p>
                                  <p className="text-xs font-black text-amber-400">₹{(b.totalAmountGrouped || b.totalAmount) - (b.paidAmountGrouped || b.paidAmount)}</p>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="flex gap-2 justify-end">
                            {b.status === 'confirmed' && (
                              <button onClick={() => handleCancelBooking(b._id)} className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-1.5 rounded-lg font-black uppercase tracking-tighter hover:bg-red-400/20 transition-all">Cancel</button>
                            )}
                            {b.paymentType === 'advance' && b.status === 'confirmed' && (
                              <button onClick={() => handleCollectPayment(b._id)} className="text-[10px] text-green-400 bg-green-400/10 border border-green-400/20 px-3 py-1.5 rounded-lg font-black uppercase tracking-tighter hover:bg-green-400/20 transition-all">Collect Cash</button>
                            )}
                            {isBlocked && (
                              <button onClick={() => handleUnblockSlot(b.startHour, b.date, b.turfId)} className="text-[10px] text-primary-400 bg-primary-400/10 border border-primary-400/20 px-3 py-1.5 rounded-lg font-black uppercase tracking-tighter hover:bg-primary-400/20 transition-all">Unblock</button>
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
                        <th className="text-left py-3 px-4 text-surface-400 font-bold uppercase tracking-widest text-[10px]">Customer</th>
                        <th className="text-left py-3 px-4 text-surface-400 font-bold uppercase tracking-widest text-[10px]">Arena</th>
                        <th className="text-left py-3 px-4 text-surface-400 font-bold uppercase tracking-widest text-[10px]">Schedule</th>
                        <th className="text-left py-3 px-4 text-surface-400 font-bold uppercase tracking-widest text-[10px]">Payment</th>
                        <th className="text-left py-3 px-4 text-surface-400 font-bold uppercase tracking-widest text-[10px]">Status</th>
                        <th className="text-left py-3 px-4 text-surface-400 font-bold uppercase tracking-widest text-[10px]">Actions</th>
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
                                    <span className="inline-block text-[8px] bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded px-1 py-0.5 font-black uppercase tracking-wider mb-1">Admin Booked</span>
                                  )}
                                  <p className="font-bold text-sm tracking-tight">{user.name || user.phone}</p>
                                  {user.name && user.phone && <p className="text-xs text-surface-400">{user.phone}</p>}
                                </div>
                              ) : (
                                <div>
                                  {isBlocked && (
                                    <span className="inline-block text-[8px] bg-surface-600/30 text-surface-500 border border-surface-600/30 rounded px-1 py-0.5 font-black uppercase tracking-wider mb-1">Maintenance</span>
                                  )}
                                  <p className="font-bold text-sm text-surface-400">Slot Reserved</p>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded font-black text-xs ${b.turfId === 'A' ? 'bg-primary-500/20 text-primary-400' : 'bg-accent-500/20 text-accent-400'}`}>Arena {b.turfId === 'A' ? '1' : '2'}</span>
                            </td>
                            <td className="py-3 px-4">
                              <p className="text-sm font-bold text-white">{formatDate(b.date)}</p>
                              <p className="text-xs text-primary-400 font-bold">{(b.startHours?.length ?? 0) > 1 ? `${b.startHours?.length} Slots: ` : ''} {formatHour(b.startHours?.[0] ?? b.startHour)} - {formatHour(b.endHour ?? b.startHour + 1)}</p>
                              {b.ballType && b.ballType !== 'none' && (
                                <p className="text-[10px] text-accent-400 font-bold capitalize mt-0.5">🏏 {b.ballType.replace('_', ' ')}</p>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <p className="text-sm font-black text-white leading-none">₹{b.totalAmountGrouped || b.totalAmount}</p>
                                {!isBlocked && b.paymentType === 'advance' && (
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 opacity-80 mt-1">
                                    <p className="text-[10px] text-green-500 font-black uppercase tracking-tighter">Paid: ₹{b.paidAmountGrouped || b.paidAmount}</p>
                                    <p className="text-[10px] text-amber-500 font-black uppercase tracking-tighter">Due: ₹{(b.totalAmountGrouped || b.totalAmount) - (b.paidAmountGrouped || b.paidAmount)}</p>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${b.status === 'confirmed' && isPastSlot(b.date, b.startHour) ? 'bg-primary-500/15 text-primary-400 border-primary-500/20'
                                : b.status === 'confirmed' ? 'bg-green-500/15 text-green-400 border-green-500/20'
                                  : b.status === 'blocked' ? 'bg-red-500/15 text-red-300 border-red-500/20'
                                    : b.status === 'cancelled' ? 'bg-red-500/15 text-red-400 border-red-500/20'
                                      : b.status === 'pending' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                                        : 'bg-surface-500/15 text-surface-400 border-surface-500/20'
                                }`}>{b.status === 'confirmed' && isPastSlot(b.date, b.startHour) ? 'COMPLETED' : b.status}</span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                {b.status === 'confirmed' && (
                                  <button onClick={() => handleCancelBooking(b._id)} className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-lg font-black uppercase hover:bg-red-500/20 transition-colors">Cancel</button>
                                )}
                                {b.paymentType === 'advance' && b.status === 'confirmed' && (
                                  <button onClick={() => handleCollectPayment(b._id)} className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-lg font-black uppercase hover:bg-green-500/20 transition-colors">Collect Cash</button>
                                )}
                                {isBlocked && (
                                  <button onClick={() => handleUnblockSlot(b.startHour, b.date, b.turfId)} className="text-[10px] text-primary-400 bg-primary-500/10 border border-primary-500/20 px-3 py-1 rounded-lg font-black uppercase hover:bg-primary-500/20 transition-colors">Unblock</button>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-surface-500 font-bold">
                  Page {filterPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={filterPage <= 1}
                    onClick={() => setFilterPage(p => Math.max(1, p - 1))}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-surface-300 disabled:opacity-40 hover:bg-white/10 transition-all"
                  >
                    <MdChevronLeft size={16} /> Prev
                  </button>
                  <button
                    disabled={filterPage >= totalPages}
                    onClick={() => setFilterPage(p => Math.min(totalPages, p + 1))}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-surface-300 disabled:opacity-40 hover:bg-white/10 transition-all"
                  >
                    Next <MdChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ SLOTS TAB ═══ */}
        {activeTab === 'slots' && (
          <div className="animate-fade-in space-y-4 sm:space-y-6">
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-surface-300 uppercase tracking-wider mb-3">Select Date</h3>
              <DatePicker dates={dates} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            </div>

            <div className="flex gap-2">
              {(['A', 'B'] as TurfId[]).map((t) => (
                <button key={t} onClick={() => { setSelectedTurf(t); setSelectedAdminSlots([]); }}
                  className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${selectedTurf === t ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' : 'bg-white/5 text-surface-400 border border-white/5'
                    }`}>Arena {t === 'A' ? '1' : '2'}</button>
              ))}
            </div>

            {loadingSlots ? (
              <div className="flex justify-center py-12"><LoadingSpinner text="Loading slots..." /></div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
                {(() => {
                  const today = getTodayStr();
                  const currentHour = new Date().getHours();
                  const displaySlots = selectedDate === today ? slots.filter(s => s.hour > currentHour) : slots;

                  return displaySlots.map((slot) => (
                    <div key={slot.hour}
                      onClick={() => {
                        if (slot.status === 'available') {
                           setSelectedAdminSlots(prev => prev.includes(slot.hour) ? prev.filter(h => h !== slot.hour) : [...prev, slot.hour].sort((a, b) => a - b));
                        }
                      }}
                      className={`flex flex-col items-center p-2 sm:p-3 rounded-xl border transition-all cursor-pointer min-h-[80px] sm:min-h-[100px] ${
                        selectedAdminSlots.includes(slot.hour) ? 'bg-amber-500/20 border-amber-500/50 ring-1 ring-amber-500/50'
                        : slot.status === 'blocked' ? 'bg-surface-700/50 border-surface-600/30 cursor-not-allowed'
                        : slot.status === 'booked' ? 'bg-primary-500/10 border-primary-500/20 opacity-60 cursor-not-allowed'
                        : 'bg-white/5 border-white/5 hover:border-primary-500/30'
                      }`}>
                      <span className="text-[10px] sm:text-xs font-black text-surface-400 mb-1 sm:mb-2">{formatHour(slot.hour)}</span>
                      <span className={`text-[9px] sm:text-[10px] font-bold uppercase mb-2 sm:mb-3 ${slot.status === 'available' ? 'text-green-400' : 'text-surface-500'}`}>{slot.status}</span>
                      {slot.status === 'blocked' && (
                        <button onClick={(e) => { e.stopPropagation(); handleUnblockSlot(slot.hour); }} className="text-[9px] sm:text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 sm:py-1 rounded hover:bg-green-500/30 transition z-10 relative">Unblock</button>
                      )}
                      {slot.status === 'available' && !selectedAdminSlots.includes(slot.hour) && (
                        <span className="text-[9px] sm:text-[10px] bg-white/5 text-surface-400 px-2 py-0.5 sm:py-1 rounded transition">Select</span>
                      )}
                      {selectedAdminSlots.includes(slot.hour) && (
                        <span className="text-[9px] sm:text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 sm:py-1 rounded font-bold">Selected</span>
                      )}
                    </div>
                  ));
                })()}
              </div>
            )}

            {blockedSlots.length > 0 && (
              <div className="glass-card p-4 sm:p-5">
                <h3 className="font-display font-bold text-white text-sm sm:text-base mb-3">Currently Blocked</h3>
                <div className="space-y-2">
                  {blockedSlots.map((bs) => (
                    <div key={bs._id} className="flex items-center justify-between p-2.5 sm:p-3 bg-white/5 rounded-lg">
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm text-white">Arena {bs.turfId === 'A' ? '1' : '2'} · {formatHour(bs.startHour)}</span>
                        {bs.reason && <span className="text-[10px] sm:text-xs text-surface-400 ml-2 truncate">{bs.reason}</span>}
                      </div>
                      <button onClick={() => handleUnblockSlot(bs.startHour, bs.date, bs.turfId)} className="text-[10px] sm:text-xs text-green-400 bg-green-500/15 px-2 py-1 rounded flex-shrink-0 ml-2">Unblock</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Selection Action Bar for Admin */}
        {selectedAdminSlots.length > 0 && activeTab === 'slots' && (
          <div className="fixed bottom-6 inset-x-0 mx-auto w-[90%] max-w-2xl z-50 animate-slide-up">
            <div className="bg-surface-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-white font-bold">{selectedAdminSlots.length} {selectedAdminSlots.length === 1 ? 'Slot' : 'Slots'} Selected</span>
              <div className="flex gap-3">
                <button onClick={() => setSelectedAdminSlots([])} className="text-surface-400 hover:text-white px-3 py-2 text-sm transition font-medium">Clear</button>
                <button onClick={() => { setWalkinName(''); setWalkinPhone(''); setShowBlockModal(true); }} className="btn-primary py-2 px-6 shadow-xl text-sm whitespace-nowrap">Block / Walk-in</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PRICING TAB ═══ */}
        {activeTab === 'pricing' && (
          <div className="animate-fade-in space-y-4 sm:space-y-6">
            <div className="flex gap-2 mb-4">
              {(['A', 'B'] as TurfId[]).map((t) => (
                <button key={t} onClick={() => setSelectedTurf(t)}
                  className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold uppercase transition-all ${selectedTurf === t ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30 ring-1 ring-primary-500/50' : 'bg-white/5 text-surface-400 border border-white/5 hover:bg-white/10'
                    }`}>Arena {t === 'A' ? '1' : '2'}</button>
              ))}
            </div>

            {loadingPricing ? (
              <div className="flex justify-center py-12"><LoadingSpinner text="Loading pricing..." /></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {pricingRules.filter(rule => rule.turfId === selectedTurf).map((rule) => (
                  <div key={rule._id} className="glass-card p-4 sm:p-5 flex items-center justify-between border-white/5">
                    <div>
                      <p className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">{rule.dayType}</p>
                      <p className="text-[10px] sm:text-xs text-surface-400 font-bold mt-1">{formatHour(rule.startHour)} - {formatHour(rule.endHour)}</p>
                      <p className="text-xl sm:text-2xl font-black text-primary-400 mt-2">₹{rule.price}</p>
                    </div>
                    <button
                      onClick={() => { setEditingRule(rule); setEditPrice(rule.price.toString()); }}
                      className="text-xs sm:text-sm bg-primary-500/10 border border-primary-500/20 text-primary-400 hover:bg-primary-500/20 hover:text-primary-300 font-bold px-4 py-2 rounded-xl flex-shrink-0 transition-all"
                    >Edit Price</button>
                  </div>
                ))}
              </div>
            )}

            <Modal isOpen={!!editingRule} onClose={() => setEditingRule(null)} title="Edit Pricing Rule">
              {editingRule && (
                <div className="space-y-4">
                  <p className="text-sm text-surface-400">
                    {editingRule.dayType} · {formatHour(editingRule.startHour)} → {formatHour(editingRule.endHour)}
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1">Price (₹)</label>
                    <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="input-field" min="0" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setEditingRule(null)} className="btn-secondary flex-1">Cancel</button>
                    <button onClick={handleUpdatePricing} className="btn-primary flex-1">Save</button>
                  </div>
                </div>
              )}
            </Modal>
          </div>
        )}

        {/* Walk-in Booking Modal */}
        <Modal isOpen={showBlockModal} onClose={() => !blockingInProgress && setShowBlockModal(false)} title="Block Slot / Walk-in Booking">
          <div className="space-y-4">
            <div className="p-4 bg-primary-500/10 rounded-xl border border-primary-500/20">
              <p className="text-xs text-surface-400 font-bold uppercase tracking-widest">Selected Slot</p>
              <p className="text-white font-black">Arena {selectedTurf === 'A' ? '1' : '2'} · {formatDate(selectedDate)} · {selectedAdminSlots.map(h => formatHour(h)).join(', ')}</p>
            </div>

            {/* Info banner */}
            <div className={`p-3 rounded-xl border text-xs font-medium transition-all duration-300 ${walkinPhone ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
              {walkinPhone
                ? '✅ Walk-in Booking — A confirmed booking will be created and linked to this customer\'s account.'
                : '⚠️ No phone entered — This will be saved as a maintenance block only.'}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-black text-surface-500 uppercase tracking-widest mb-1.5">
                  Customer Phone <span className="text-primary-400 normal-case font-medium">(for walk-in booking)</span>
                </label>
                <input
                  type="tel"
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit phone number"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-surface-500 uppercase tracking-widest mb-1.5">Customer Name <span className="text-surface-600 normal-case font-medium">(optional)</span></label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. John Doe"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                />
              </div>

              {/* Ball Type Selection (Only if phone is entered, implying Walk-in booking) */}
              {walkinPhone && (
                <div className="pt-2 animate-fade-in">
                  <label className="block text-xs font-black text-surface-500 uppercase tracking-widest mb-2">
                    Select Ball <span className="text-primary-400 normal-case font-medium">(Optional)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'none', label: 'None', price: 0 },
                      { id: 'light_tennis', label: 'Light', price: 80 },
                      { id: 'hard_tennis', label: 'Hard', price: 100 },
                    ].map((ball) => (
                      <button
                        key={ball.id}
                        type="button"
                        onClick={() => setWalkinBallType(ball.id)}
                        className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                          walkinBallType === ball.id
                            ? 'bg-primary-500/20 border-primary-500 ring-1 ring-primary-500/30'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-[10px] sm:text-xs font-black text-white uppercase text-center mb-0.5">{ball.label}</span>
                        <span className="text-[9px] sm:text-[10px] font-bold text-surface-400">{ball.price > 0 ? `₹${ball.price}` : 'Free'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowBlockModal(false)}
                disabled={blockingInProgress}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBlock}
                disabled={blockingInProgress}
                className={`flex-1 px-4 py-2.5 rounded-xl font-black text-sm transition-all duration-200 ${walkinPhone ? 'bg-primary-500 hover:bg-primary-600 text-white' : 'bg-surface-700 hover:bg-surface-600 text-white'}`}
              >
                {blockingInProgress ? 'Processing...' : walkinPhone ? '✅ Confirm Walk-in Booking' : '🔒 Block Slot'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Cancel Booking Modal */}
        <Modal
          isOpen={!!cancelBookingId}
          onClose={() => !cancellingBooking && setCancelBookingId(null)}
          title="Cancel Booking"
        >
          <div className="text-center p-2 sm:p-4">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20 shadow-lg shadow-red-500/5">
              <MdClose size={32} />
            </div>

            <h3 className="text-2xl font-display font-black text-white mb-2">Are you sure?</h3>
            <p className="text-surface-400 text-sm mb-8 leading-relaxed">
              This will permanently cancel the booking and release the slots back to the public. This action cannot be undone.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setCancelBookingId(null)}
                disabled={cancellingBooking}
                className="flex-1 px-6 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[11px] hover:bg-white/10 transition-all disabled:opacity-50"
              >
                Keep Booking
              </button>
              <button
                onClick={confirmCancellation}
                disabled={cancellingBooking}
                className="flex-1 px-6 py-3.5 rounded-xl bg-red-600 text-white font-black uppercase tracking-widest text-[11px] hover:bg-red-500 shadow-lg shadow-red-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancellingBooking ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Cancelling...
                  </>
                ) : 'Yes, Cancel Booking'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Collect Payment Modal */}
        <Modal
          isOpen={!!paymentBookingId}
          onClose={() => !collectingPayment && setPaymentBookingId(null)}
          title="Payment Collection"
        >
          <div className="text-center p-2 sm:p-4">
            <div className="w-16 h-16 bg-green-500/10 text-green-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-green-500/20 shadow-lg shadow-green-500/5">
              <MdCurrencyRupee size={32} />
            </div>

            <h3 className="text-2xl font-display font-black text-white mb-2">Mark as Collected?</h3>
            <p className="text-surface-400 text-sm mb-8 leading-relaxed">
              Confirm that the pending balance has been collected in cash at the arena. This will update the booking status to fully paid.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setPaymentBookingId(null)}
                disabled={collectingPayment}
                className="flex-1 px-6 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[11px] hover:bg-white/10 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmCollection}
                disabled={collectingPayment}
                className="flex-1 px-6 py-3.5 rounded-xl bg-green-500 text-black font-black uppercase tracking-widest text-[11px] hover:bg-green-400 shadow-lg shadow-green-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {collectingPayment ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Processing...
                  </>
                ) : 'Confirm Cash Collection'}
              </button>
            </div>
          </div>
        </Modal>

      </main>
    </div>
  );
};

export default AdminDashboard;
