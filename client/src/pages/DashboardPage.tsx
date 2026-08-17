import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import MobileBottomNav from '../components/MobileBottomNav';
import UserGreetingBanner from '../components/UserGreetingBanner';
import { getUserBookings } from '../services/api';
import { formatHour } from '../utils/helpers';
import type { Booking } from '../types';
import {
  MdLocationOn,
  MdArrowForward,
  MdWhatsapp,
  MdPhone,
  MdSportsCricket,
  MdAccessTime,
  MdCalendarToday,
} from 'react-icons/md';

// ─── Quick Arena cards ───────────────────────────────────────────────
interface ArenaCard {
  id: 'A' | 'B';
  name: string;
  tag: string;
  tagColor: string;
  image: string;
  description: string;
}

const arenaCards: ArenaCard[] = [
  {
    id: 'A',
    name: 'Arena 1',
    tag: 'BOX CRICKET',
    tagColor: 'bg-green-500',
    image: '/images/arena1.jpg',
    description: '360° Floodlit Turf',
  },
  {
    id: 'B',
    name: 'Arena 2',
    tag: 'BOX CRICKET',
    tagColor: 'bg-purple-500',
    image: '/images/arena2.jpg',
    description: 'Blue LED Premium',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────
function getNextMatch(bookings: Booking[]): Booking | null {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentHour = now.getHours();

  const upcoming = bookings.filter((b) => {
    if (b.status !== 'confirmed') return false;
    if (b.date > todayStr) return true;
    if (b.date === todayStr && b.startHour >= currentHour) return true;
    return false;
  });

  if (upcoming.length === 0) return null;

  upcoming.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startHour - b.startHour;
  });

  return upcoming[0];
}

// ─── Component ───────────────────────────────────────────────────────
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [nextMatch, setNextMatch] = useState<Booking | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(true);

  useEffect(() => {
    const fetchNextMatch = async () => {
      setLoadingMatch(true);
      try {
        const res = await getUserBookings();
        if (res.success && res.data) {
          setNextMatch(getNextMatch(res.data));
        }
      } catch {
        // silently fail
      } finally {
        setLoadingMatch(false);
      }
    };
    fetchNextMatch();
  }, []);

  const handleBookArena = (arenaId: 'A' | 'B') => {
    navigate(`/book-slots?turf=${arenaId}`);
  };

  return (
    <div className="min-h-screen bg-[#0c1220] pb-24 md:pb-12">
      <Navbar />

      <main className="pt-20 px-4 sm:px-5 max-w-lg mx-auto md:max-w-2xl">

        {/* ── Greeting Banner ── */}
        <div className="mt-4 animate-fade-in">
          <UserGreetingBanner />
        </div>

        {/* ── Quick Arena Booking ── */}
        <section className="mt-6 animate-slide-up" id="quick-arena-booking">
          <h2 className="text-xs font-bold text-surface-400 uppercase tracking-[0.18em] mb-3">
            Quick Arena Booking
          </h2>

          {/* Horizontal scroll container */}
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-1 px-1">
            {arenaCards.map((arena) => (
              <button
                key={arena.id}
                id={`quick-book-arena-${arena.id.toLowerCase()}`}
                onClick={() => handleBookArena(arena.id)}
                className="relative flex-shrink-0 w-44 sm:w-52 rounded-2xl overflow-hidden snap-start group cursor-pointer"
              >
                {/* Image */}
                <div className="relative h-32 sm:h-36 w-full overflow-hidden">
                  <img
                    src={arena.image}
                    alt={arena.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                  {/* Tag badge */}
                  <span
                    className={`absolute top-2.5 left-2.5 ${arena.tagColor} text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full`}
                  >
                    {arena.tag}
                  </span>
                </div>

                {/* Label */}
                <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
                  <p className="text-white font-bold text-sm leading-tight">{arena.name}</p>
                  <p className="text-white/60 text-[11px] mt-0.5">{arena.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── Your Next Match ── */}
        <section className="mt-7 animate-slide-up" id="your-next-match">
          <h2 className="text-xs font-bold text-surface-400 uppercase tracking-[0.18em] mb-3">
            Your Next Match
          </h2>

          <div className="rounded-2xl overflow-hidden bg-surface-900/70 border border-white/5">
            {loadingMatch ? (
              <div className="h-28 flex flex-col items-center justify-center gap-2 text-surface-500">
                <div className="w-4 h-4 border-2 border-surface-600 border-t-primary-400 rounded-full animate-spin" />
                <span className="text-xs tracking-widest uppercase">Loading matches...</span>
              </div>
            ) : nextMatch ? (
              <div className="p-4 flex items-start gap-4">
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center flex-shrink-0">
                  <MdSportsCricket className="text-primary-400" size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">
                    Arena {nextMatch.turfId === 'A' ? '1' : '2'} — Box Cricket
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 text-surface-400 text-xs">
                    <MdCalendarToday size={12} />
                    <span>{nextMatch.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-surface-400 text-xs">
                    <MdAccessTime size={12} />
                    <span>
                      {formatHour(nextMatch.startHour)} – {formatHour(nextMatch.startHour + 1)}
                    </span>
                  </div>
                  <span
                    className={`inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      nextMatch.status === 'confirmed'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-surface-700 text-surface-400'
                    }`}
                  >
                    {nextMatch.status}
                  </span>
                </div>
                <button
                  onClick={() => navigate('/bookings')}
                  className="flex-shrink-0 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-surface-400 hover:text-white transition-all"
                >
                  <MdArrowForward size={18} />
                </button>
              </div>
            ) : (
              <div className="h-28 flex flex-col items-center justify-center gap-2 text-surface-500">
                <MdSportsCricket size={28} className="text-surface-700" />
                <p className="text-xs tracking-widest uppercase">No upcoming matches</p>
                <button
                  onClick={() => navigate('/activities')}
                  className="mt-1 text-primary-400 text-xs font-semibold hover:text-primary-300 transition-colors"
                >
                  Book a slot →
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Location Card ── */}
        <section className="mt-5 animate-slide-up" id="arena-location">
          <div className="rounded-2xl bg-surface-900/70 border border-white/5 p-4 flex items-start gap-4">
            {/* Icon */}
            <div className="w-11 h-11 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center flex-shrink-0">
              <MdLocationOn className="text-primary-400" size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm mb-0.5">VSY Box Cricket Nadergul</p>
              <p className="text-surface-400 text-xs leading-relaxed">
                Near Nadergul X Roads, Hyderabad, Telangana — 501510
              </p>
              <a
                href="https://www.google.com/maps/search/VSY+Box+Cricket+Nadergul"
                target="_blank"
                rel="noopener noreferrer"
                id="get-arena-directions-btn"
                className="inline-block mt-3 w-full text-center py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-primary-400 text-xs font-bold uppercase tracking-widest transition-all"
              >
                Get Arena Directions
              </a>
            </div>
          </div>
        </section>

        {/* ── Direct Support Channels ── */}
        <section className="mt-5 mb-6 animate-slide-up" id="support-channels">
          <div className="rounded-2xl bg-surface-900/70 border border-white/5 p-4 flex items-start gap-4">
            {/* WhatsApp icon */}
            <div className="w-11 h-11 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0">
              <MdWhatsapp className="text-green-400" size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm mb-0.5">Direct Support Channels</p>
              <p className="text-surface-400 text-xs leading-relaxed">
                Have questions or need manual booking adjustments? Call or chat instantly.
              </p>
              <div className="flex gap-2 mt-3">
                <a
                  href="https://wa.me/919999999999"
                  target="_blank"
                  rel="noopener noreferrer"
                  id="whatsapp-support-btn"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-white text-xs font-black uppercase tracking-wider transition-all"
                >
                  <MdWhatsapp size={15} /> WhatsApp
                </a>
                <a
                  href="tel:+919999999999"
                  id="call-support-btn"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider transition-all"
                >
                  <MdPhone size={14} /> Call Support
                </a>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
};

export default DashboardPage;
