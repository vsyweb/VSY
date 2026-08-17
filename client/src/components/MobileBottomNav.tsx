import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MdHome, MdSportsBaseball, MdCalendarToday, MdPerson } from 'react-icons/md';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  to: string;
}

const MobileBottomNav: React.FC = () => {
  const location = useLocation();

  const navItems: NavItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: <MdHome size={24} />,
      to: '/dashboard',
    },
    {
      id: 'activities',
      label: 'Activities',
      icon: <MdSportsBaseball size={24} />,
      to: '/activities',
    },
    {
      id: 'bookings',
      label: 'Bookings',
      icon: <MdCalendarToday size={22} />,
      to: '/bookings',
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <MdPerson size={24} />,
      to: '/profile',
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      id="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-950/90 backdrop-blur-xl border-t border-white/10 safe-area-bottom"
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.id}
              id={`mobile-nav-${item.id}`}
              to={item.to}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all duration-200 min-w-[60px] ${
                active
                  ? 'text-primary-400'
                  : 'text-surface-500 hover:text-surface-300'
              }`}
            >
              {/* Active indicator dot */}
              <div className="relative">
                {active && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-400" />
                )}
                <span className={`transition-transform duration-200 ${active ? 'scale-110' : ''}`}>
                  {item.icon}
                </span>
              </div>
              <span
                className={`text-[10px] font-semibold tracking-wide transition-all duration-200 ${
                  active ? 'text-primary-400' : 'text-surface-500'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
