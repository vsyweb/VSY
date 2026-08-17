import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import MobileBottomNav from '../components/MobileBottomNav';
import { MdArrowForward, MdSportsCricket } from 'react-icons/md';

interface ActivityCard {
  id: 'A' | 'B';
  title: string;
  tag: string;
  tagColor: string;
  image: string;
  priceText: string;
  icon: React.ReactNode;
}

const activities: ActivityCard[] = [
  {
    id: 'A',
    title: 'Arena 1',
    tag: 'BOX CRICKET',
    tagColor: 'bg-[#10b981]', // emerald/green matching screenshot
    image: '/images/arena1.jpg',
    priceText: 'STARTS AT ₹800/HR',
    icon: <MdSportsCricket size={18} className="text-[#10b981]" />,
  },
  {
    id: 'B',
    title: 'Arena 2',
    tag: 'BOX CRICKET',
    tagColor: 'bg-[#a855f7]', // purple matching screenshot
    image: '/images/arena2.jpg',
    priceText: 'STARTS AT ₹800/HR',
    icon: <MdSportsCricket size={18} className="text-[#a855f7]" />, // Using Cricket icon for Arena 2
  }
];

const ActivitiesPage: React.FC = () => {
  const navigate = useNavigate();

  const handleBookArena = (arenaId: 'A' | 'B') => {
    navigate(`/book-slots?turf=${arenaId}`);
  };

  return (
    <div className="min-h-screen bg-[#090d16] pb-24 md:pb-12 font-sans">
      <Navbar />

      <main className="pt-24 pb-12 max-w-lg mx-auto md:max-w-4xl">
        {/* Page Header */}
        <div className="text-center mb-8 px-4 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-3 tracking-tight">
            Select <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-[#10b981]">Activity</span>
          </h1>
          <p className="text-sm sm:text-base text-surface-400 max-w-[280px] sm:max-w-md mx-auto leading-relaxed font-medium">
            Choose an activity turf below to view available times and book slots
          </p>
        </div>

        {/* Activity Cards Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6 px-4 animate-slide-up">
          {activities.map((activity) => (
            <div
              key={activity.id}
              id={`activity-card-${activity.id.toLowerCase()}`}
              className="bg-[#121929] border border-white/5 rounded-[20px] p-2.5 sm:p-4 flex flex-col transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
            >
              {/* Image Container */}
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden mb-3">
                <img
                  src={activity.image}
                  alt={activity.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                
                {/* Top Left Badge */}
                <span className={`absolute top-2 left-2 ${activity.tagColor} text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full z-10`}>
                  {activity.tag}
                </span>
              </div>

              {/* Content */}
              <div className="px-1 flex-1 flex flex-col">
                <div className="flex items-center gap-1.5 mb-1">
                  {activity.icon}
                  <h2 className="text-sm sm:text-lg font-black text-white truncate">
                    {activity.title}
                  </h2>
                </div>
                
                <p className="text-[9px] sm:text-xs font-bold text-surface-400 uppercase tracking-widest mb-4">
                  {activity.priceText}
                </p>

                {/* Book Now Button */}
                <button
                  onClick={() => handleBookArena(activity.id)}
                  className={`mt-auto w-full py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-1.5 text-white font-black text-[11px] sm:text-sm uppercase tracking-wide transition-transform active:scale-95 ${activity.tagColor} hover:opacity-90 shadow-lg shadow-black/20`}
                >
                  Book Now
                  <MdArrowForward size={14} className="sm:hidden" />
                  <MdArrowForward size={18} className="hidden sm:block" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default ActivitiesPage;
