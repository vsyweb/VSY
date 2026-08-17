import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MdArrowForward } from 'react-icons/md';

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'GOOD MORNING';
  if (hour < 17) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
};

const UserGreetingBanner: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#1a2540] to-[#0f172a] border border-white/10 shadow-2xl">
      {/* Background watermark text */}
      <div
        aria-hidden
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[72px] sm:text-[96px] font-black text-white/[0.035] select-none pointer-events-none leading-none tracking-tighter"
      >
        VSY
      </div>

      <div className="relative z-10 p-4 sm:p-5">
        {/* Badge + Greeting row */}
        <div className="flex items-center gap-3 mb-2.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-500/20 border border-primary-500/30 text-[9px] font-bold text-primary-400 uppercase tracking-widest">
            Arena Member
          </span>
          <span className="text-[10px] font-bold text-surface-400 uppercase tracking-[0.18em]">
            {getGreeting()}
          </span>
        </div>

        {/* Name */}
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-1 leading-tight">
          {user?.name || 'Player'}
        </h2>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-surface-400 leading-relaxed mb-4">
          Welcome back to Nadergul's premier athletic arena. Your next victory starts here.
        </p>

        {/* Full-width CTA Button */}
        <button
          id="greeting-book-now-btn"
          onClick={() => navigate('/activities')}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-400 hover:to-accent-400 shadow-lg shadow-primary-500/30 transition-all duration-300 hover:shadow-primary-500/50 group"
        >
          Book Slots Now
          <MdArrowForward size={18} className="group-hover:translate-x-1 transition-transform duration-200" />
        </button>
      </div>
    </div>
  );
};

export default UserGreetingBanner;
