import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import DatePicker from '../components/DatePicker';
import SlotGrid from '../components/SlotGrid';
import BookingModal from '../components/BookingModal';
import { getSlots } from '../services/api';
import { getDateRange, getTodayStr, isWeekend } from '../utils/helpers';
import type { SlotInfo, TurfId } from '../types';
import toast from 'react-hot-toast';
import { MdRefresh, MdInfo } from 'react-icons/md';

const DashboardPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [selectedTurf, setSelectedTurf] = useState<TurfId>('A');
  const [slotsA, setSlotsA] = useState<SlotInfo[]>([]);
  const [slotsB, setSlotsB] = useState<SlotInfo[]>([]);
  const [loadingA, setLoadingA] = useState(true);
  const [loadingB, setLoadingB] = useState(true);
  const [selectedSlots, setSelectedSlots] = useState<SlotInfo[]>([]);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  const dates = getDateRange(30); // Show 30 days

  const fetchSlots = useCallback(async (date: string) => {
    setLoadingA(true);
    setLoadingB(true);

    try {
      const [resA, resB] = await Promise.all([getSlots('A', date), getSlots('B', date)]);

      if (resA.success && resA.data) setSlotsA(resA.data.slots);
      if (resB.success && resB.data) setSlotsB(resB.data.slots);
    } catch {
      toast.error('Failed to load slots');
    } finally {
      setLoadingA(false);
      setLoadingB(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots(selectedDate);
    setSelectedSlots([]); // Clear selection when date changes
  }, [selectedDate, fetchSlots]);

  const handleSlotToggle = (slot: SlotInfo) => {
    setSelectedSlots(prev => {
      const isSelected = prev.some(s => s.hour === slot.hour);
      if (isSelected) {
        return prev.filter(s => s.hour !== slot.hour);
      } else {
        return [...prev, slot].sort((a, b) => a.hour - b.hour);
      }
    });
  };

  const handleBookingComplete = () => {
    fetchSlots(selectedDate);
    setSelectedSlots([]);
  };

  const totalAmount = selectedSlots.reduce((sum, slot) => sum + slot.price, 0);

  const weekend = isWeekend(selectedDate);

  return (
    <div className="min-h-screen bg-surface-950 pb-32">
      <Navbar />

      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-black text-white">
              Book Your <span className="gradient-text">Slots</span>
            </h1>
            <p className="text-surface-400 mt-2">
              Pick multiple slots for a longer game session 🏏
            </p>
          </div>
          
          <button
            onClick={() => fetchSlots(selectedDate)}
            className="w-fit px-4 py-2 rounded-xl bg-white/5 text-sm text-surface-300 hover:text-white hover:bg-white/10 flex items-center gap-2 transition-all border border-white/5"
          >
            <MdRefresh size={18} className={loadingA || loadingB ? 'animate-spin' : ''} />
            Refresh Slots
          </button>
        </div>

        {/* Date Picker */}
        <div className="mb-6 animate-slide-up">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs sm:text-sm font-bold text-surface-300 uppercase tracking-[0.15em]">Select Date</h2>
            
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] sm:text-xs">
              <MdInfo className={weekend ? 'text-amber-400' : 'text-green-400'} size={14} />
              {weekend ? (
                <span className="text-amber-400 font-medium">Weekend Pricing</span>
              ) : (
                <span className="text-green-400 font-medium">Weekday Pricing</span>
              )}
            </div>
          </div>
          <DatePicker dates={dates} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        </div>

        {/* Turf Tabs */}
        <div className="flex gap-2 mb-6">
          {(['A', 'B'] as TurfId[]).map((turf) => (
            <button
              key={turf}
              onClick={() => {
                setSelectedTurf(turf);
                setSelectedSlots([]); // Clear selection when switching turfs
              }}
              className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                selectedTurf === turf
                  ? turf === 'A'
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30 ring-1 ring-primary-500/50'
                    : 'bg-accent-500/20 text-accent-400 border border-accent-500/30 ring-1 ring-accent-500/50'
                  : 'bg-white/5 text-surface-400 border border-white/5 hover:bg-white/10'
              }`}
            >
              Turf {turf}
            </button>
          ))}
        </div>

        {/* Slot Grids */}
        <div className="space-y-8 animate-slide-up">
          {(() => {
            const today = getTodayStr();
            const currentHour = new Date().getHours();
            
            // Filter out past hours if today
            const filterPastSlots = (slots: SlotInfo[]) => {
              if (selectedDate !== today) return slots;
              return slots.filter((slot) => slot.hour > currentHour);
            };

            const filteredSlotsA = filterPastSlots(slotsA);
            const filteredSlotsB = filterPastSlots(slotsB);

            return selectedTurf === 'A' ? (
              <SlotGrid
                slots={filteredSlotsA}
                turfId="A"
                selectedSlotHours={selectedSlots.map(s => s.hour)}
                onSlotToggle={handleSlotToggle}
                isLoading={loadingA}
              />
            ) : (
              <SlotGrid
                slots={filteredSlotsB}
                turfId="B"
                selectedSlotHours={selectedSlots.map(s => s.hour)}
                onSlotToggle={handleSlotToggle}
                isLoading={loadingB}
              />
            );
          })()}
        </div>
      </main>

      {/* Selection Action Bar */}
      {selectedSlots.length > 0 && (
        <div className="fixed bottom-6 inset-x-0 mx-auto w-[90%] max-w-2xl z-50 animate-slide-up">
          <div className="bg-surface-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-4 shadow-2xl shadow-black/50 flex items-center justify-between">
            <div className="flex flex-col truncate pr-2">
              <span className="text-[10px] sm:text-xs text-surface-400 font-medium uppercase tracking-wider truncate">
                {selectedSlots.length} {selectedSlots.length === 1 ? 'Slot' : 'Slots'} Selected
              </span>
              <span className="text-lg sm:text-xl font-display font-black text-white">
                ₹{totalAmount}
              </span>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
              <button 
                onClick={() => setSelectedSlots([])}
                className="px-2 sm:px-4 py-2 text-xs sm:text-sm text-surface-400 hover:text-white transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => setBookingModalOpen(true)}
                className="btn-primary py-2 sm:py-3 px-4 sm:px-8 text-sm sm:text-base shadow-xl shadow-primary-500/20 whitespace-nowrap"
              >
                Book
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        selectedSlots={selectedSlots}
        turfId={selectedTurf}
        date={selectedDate}
        onBookingComplete={handleBookingComplete}
      />
    </div>
  );
};

export default DashboardPage;
