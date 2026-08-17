import React from 'react';
import { MdClose, MdDashboard, MdHistory, MdLogout, MdMenu, MdLocationOn } from 'react-icons/md';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar: React.FC = () => {
  const { user, admin, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface-950/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to={role === 'admin' ? '/admin' : role === 'worker' ? '/worker' : '/dashboard'} className="flex items-center gap-3 group">
            <div className="h-12 w-16 rounded-lg overflow-hidden bg-white/5 p-1
              group-hover:shadow-lg group-hover:shadow-primary-500/25 transition-all duration-300">
              <img src="/images/logo.png" alt="VSY Logo" className="w-full h-full object-contain scale-110" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-display font-bold text-lg text-white">VSY BOX CRICKET</span>
              <span className="text-[10px] uppercase tracking-widest text-primary-400 font-black">Premium Arena</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {role === 'user' && (
              <>
                <Link
                  to="/dashboard"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${isActive('/dashboard')
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-surface-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <MdDashboard /> Book Slots
                  </div>
                </Link>
                <Link
                  to="/bookings"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${isActive('/bookings')
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-surface-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <MdHistory /> My Bookings
                  </div>
                </Link>
                <a
                  href="https://www.google.com/maps/search/VSY+Box+Cricket+Nadergul"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-surface-400 hover:text-primary-400 hover:bg-white/5 transition-all duration-300"
                >
                  <div className="flex items-center gap-2">
                    <MdLocationOn /> Locate Area
                  </div>
                </a>
              </>
            )}

            <div className="ml-4 flex items-center gap-3">
              {role === 'user' ? (
                <Link to="/profile" className="text-right hover:opacity-80 transition-opacity">
                  <p className="text-sm font-medium text-white">{user?.name}</p>
                  <p className="text-xs text-surface-400">{user?.phone}</p>
                </Link>
              ) : (
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{admin?.name}</p>
                  <p className="text-xs text-surface-400">{admin?.email}</p>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-surface-400 hover:text-red-400 transition-all duration-300"
                title="Logout"
              >
                <MdLogout size={18} />
              </button>
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg bg-white/5 text-surface-400"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <MdClose size={20} /> : <MdMenu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 animate-slide-down">
            <div className="flex flex-col gap-1">
              <div className="px-4 py-4 mb-2 flex flex-col items-center bg-white/5 rounded-xl border border-white/5">
                <img src="/images/logo.png" alt="VSY Logo" className="h-16 w-24 object-contain" />
              </div>
              {role === 'user' && (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className={`px-4 py-3 rounded-lg text-sm font-medium ${isActive('/dashboard')
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-surface-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <MdDashboard /> Book Slots
                    </div>
                  </Link>
                  <Link
                    to="/bookings"
                    onClick={() => setMenuOpen(false)}
                    className={`px-4 py-3 rounded-lg text-sm font-medium ${isActive('/bookings')
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-surface-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <MdHistory /> My Bookings
                    </div>
                  </Link>
                  <a
                    href="https://www.google.com/maps/search/VSY+Box+Cricket+Nadergul"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3 rounded-lg text-sm font-medium text-surface-400 hover:text-primary-400 hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <MdLocationOn /> Locate Area
                    </div>
                  </a>
                </>
              )}
              <div className="border-t border-white/5 mt-2 pt-2">
                {role === 'user' ? (
                  <Link to="/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-2 hover:bg-white/5 rounded-lg">
                    <p className="text-sm text-white font-medium">{user?.name}</p>
                    <p className="text-xs text-surface-400">{user?.phone}</p>
                  </Link>
                ) : (
                  <div className="px-4 py-2">
                    <p className="text-sm text-white font-medium">{admin?.name}</p>
                    <p className="text-xs text-surface-400">{admin?.email}</p>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                >
                  <MdLogout /> Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
