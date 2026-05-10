import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginWithPhone, getPublicPricing } from '../services/api';
import toast from 'react-hot-toast';
import {
  MdSportsCricket, MdPhone, MdArrowForward, MdLocationOn,
  MdAccessTime, MdStar, MdSecurity, MdPayment,
  MdGroups, MdHistory, MdKeyboardArrowDown
} from 'react-icons/md';
import { FaInstagram, FaYoutube, FaWhatsapp } from 'react-icons/fa';
import { PricingRule } from '../types';
import ProfessionalLoginAnimation from '../components/ProfessionalLoginAnimation';

const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showName, setShowName] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mainImageIdx, setMainImageIdx] = useState(0);
  const [randomSideImages, setRandomSideImages] = useState<string[]>([]);

  const ALL_GALLERY_IMAGES = [
    '1.jpg.jpg', '2.jpg.jpg', '3.jpg.jpg', '4.jpg.jpg', '5.jpg.jpg',
    '6.jpg.PNG', '7.jpg.PNG', '8.jpg.PNG', '9.jpg.PNG', '10.jpg.PNG',
    '11.jpg.PNG', '12.jpg.PNG', '13.jpg.PNG', '14.jpg.PNG'
  ];

  useEffect(() => {
    // Pick 3 random images for the side boxes on refresh
    const shuffled = [...ALL_GALLERY_IMAGES].sort(() => 0.5 - Math.random());
    setRandomSideImages(shuffled.slice(0, 3));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setMainImageIdx((prev) => (prev + 1) % ALL_GALLERY_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleMainImageClick = () => {
    setMainImageIdx((prev) => (prev + 1) % ALL_GALLERY_IMAGES.length);
  };

  const { loginUser, token, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);

    // Fetch pricing
    const fetchPricing = async () => {
      try {
        const res = await getPublicPricing();
        if (res.success && res.data) {
          setPricingRules(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch pricing', err);
      } finally {
        setPricingLoading(false);
      }
    };
    fetchPricing();

    // Re-fetch when tab is focused
    window.addEventListener('focus', fetchPricing);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('focus', fetchPricing);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error('Enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    try {
      const res = await loginWithPhone(phone, name || undefined);
      if (res.success && res.data) {
        loginUser(res.data.token, res.data.user);
        setIsAnimating(true);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBooking = () => {
    setMobileMenuOpen(false);
    document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-surface-950 text-white selection:bg-primary-500/30">
      {isAnimating && (
        <ProfessionalLoginAnimation onComplete={() => navigate('/dashboard')} />
      )}

      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-surface-950/80 backdrop-blur-xl border-b border-white/5 py-3 sm:py-4' : 'bg-transparent py-4 sm:py-6'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-4 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="h-14 sm:h-20 w-24 sm:w-32 rounded-xl overflow-hidden bg-white/5 p-1 group-hover:scale-105 transition-all duration-500">
              <img src="/images/logo.png" alt="VSY Logo" className="w-full h-full object-contain" />
            </div>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-bold text-surface-400 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-sm font-bold text-surface-400 hover:text-white transition-colors">Pricing</a>
            <a href="#gallery" className="text-sm font-bold text-surface-400 hover:text-white transition-colors">Gallery</a>
            <a
              href="https://www.google.com/maps/search/VSY+Box+Cricket+Nadergul"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-white text-sm font-black hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <MdLocationOn className="text-primary-400" /> Locate
            </a>
            <button
              onClick={scrollToBooking}
              className="px-6 py-2.5 rounded-full bg-white text-surface-950 text-sm font-black hover:bg-primary-400 hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-white/10"
            >
              Book Now
            </button>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg bg-white/5 text-surface-400">
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-surface-950/95 backdrop-blur-xl border-t border-white/5 animate-slide-down">
            <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-2">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-lg text-sm font-bold text-surface-300 hover:bg-white/5">Features</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-lg text-sm font-bold text-surface-300 hover:bg-white/5">Pricing</a>
              <a href="#gallery" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-lg text-sm font-bold text-surface-300 hover:bg-white/5">Gallery</a>
              <a
                href="https://www.google.com/maps/search/VSY+Box+Cricket+Nadergul"
                target="_blank"
                rel="noopener noreferrer"
                className="mx-4 mt-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <MdLocationOn className="text-primary-400" /> Locate Us
              </a>
              <button onClick={scrollToBooking} className="mx-4 mt-1 btn-primary py-3 rounded-xl text-sm font-black text-center">Book Now</button>
            </div>
          </div>
        )}
      </nav>

      {/* ═══ HERO SECTION ═══ */}
      <section className="relative min-h-screen flex items-center justify-center pt-8 sm:pt-12 px-4 sm:px-6 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <img src="/images/hero_turf.png" alt="VSY Arena" className="w-full h-full object-cover scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/70 to-surface-950/40" />
        </div>

        <div className="relative z-10 max-w-7xl w-full grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
          {/* Left: Text */}
          <div className="space-y-5 sm:space-y-8 animate-fade-in text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary-500/10 border border-primary-500/20 backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-primary-400">Now Open in Nadergul</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-display font-black leading-[0.9] tracking-tighter">
              PLAY LIKE A <br />
              <span className="gradient-text">CHAMPION.</span>
            </h1>

            <p className="text-sm sm:text-lg text-surface-300 max-w-lg mx-auto lg:mx-0 leading-relaxed font-medium">
              Hyderabad's most premium 360° Box Cricket experience. Two high-intensity floodlit turfs, 24/7 availability, and professional-grade artificial grass.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              {token && (
                <Link
                  to={role === 'admin' ? '/admin' : '/dashboard'}
                  className="btn-primary px-8 sm:px-10 py-4 sm:py-5 rounded-2xl flex items-center gap-3 group w-full sm:w-auto justify-center"
                >
                  {role === 'admin' ? 'Admin Dashboard' : 'Go to Dashboard'} <MdArrowForward className="group-hover:translate-x-1 transition-transform" size={20} />
                </Link>
              )}
            </div>
          </div>

          {/* Right: Booking Card */}
          <div id="booking-section" className="animate-slide-up">
            <div className="glass-card p-6 sm:p-10 max-w-md mx-auto relative group">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary-500/20 rounded-full blur-2xl group-hover:bg-primary-500/30 transition-all duration-700" />
              <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-accent-500/20 rounded-full blur-2xl group-hover:bg-accent-500/30 transition-all duration-700" />

              <div className="relative text-center mb-6 sm:mb-8">
                <h2 className="text-2xl sm:text-3xl font-display font-black">Book a Slot</h2>
                <p className="text-surface-400 text-xs sm:text-sm mt-2">
                  {token ? 'You are currently logged in' : 'Enter your phone to see availability'}
                </p>
              </div>

              {token ? (
                <div className="space-y-4 relative">
                  <Link
                    to={role === 'admin' ? '/admin' : '/dashboard'}
                    className="w-full btn-primary py-4 sm:py-5 rounded-2xl flex items-center justify-center gap-3 text-base sm:text-lg"
                  >
                    {role === 'admin' ? 'Open Admin Panel' : 'Continue to Booking'} <MdArrowForward size={22} />
                  </Link>
                  <p className="text-center text-xs text-surface-500">
                    Not you? <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-primary-500 font-bold">Switch Account</button>
                  </p>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5 relative">
                  <div className="relative group">
                    <MdPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 group-focus-within:text-primary-400 transition-colors" size={20} />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setPhone(val);
                        if (val.length === 10 && !showName) setShowName(true);
                      }}
                      placeholder="Phone Number"
                      className="w-full bg-white/5 border-2 border-white/5 rounded-2xl pl-12 pr-4 py-3.5 sm:py-4 text-white font-bold placeholder-surface-600 focus:outline-none focus:border-primary-500/50 focus:bg-white/10 transition-all text-sm sm:text-base"
                      maxLength={10}
                      required
                    />
                  </div>

                  {showName && (
                    <div className="animate-slide-down">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your Name (Optional)"
                        className="w-full bg-white/5 border-2 border-white/5 rounded-2xl px-4 py-3.5 sm:py-4 text-white font-bold placeholder-surface-600 focus:outline-none focus:border-primary-500/50 focus:bg-white/10 transition-all text-sm sm:text-base"
                        maxLength={50}
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={phone.length !== 10 || loading}
                    className="w-full btn-primary py-4 sm:py-5 rounded-2xl flex items-center justify-center gap-3 text-base sm:text-lg"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Check Availability <MdArrowForward size={22} /></>
                    )}
                  </button>
                </form>
              )}

              <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-white/5 flex items-center justify-between relative">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[9px] sm:text-[10px] font-black uppercase text-surface-400">Instant Confirmation</span>
                </div>
                <Link to="/admin/login" className="text-[9px] sm:text-[10px] font-black uppercase text-primary-500 hover:text-primary-400 transition-colors">Admin Login</Link>
              </div>

              {/* Locate Us Button Below Card */}
              <div className="mt-4">
                <a
                  href="https://www.google.com/maps/search/VSY+Box+Cricket+Nadergul"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  <MdLocationOn className="text-primary-400" size={18} /> Locate Arena
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 animate-bounce cursor-pointer opacity-50 hover:opacity-100 transition-opacity hidden sm:block">
          <MdKeyboardArrowDown size={32} />
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <div className="relative py-8 sm:py-12 border-y border-white/5 bg-surface-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
          {[
            { label: 'Arenas', value: '02', icon: MdSportsCricket },
            { label: 'Rating', value: '4.8', icon: MdStar },
            { label: 'Hours Played', value: '10K+', icon: MdAccessTime },
            { label: 'Athletes', value: '5K+', icon: MdGroups },
          ].map((stat, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <stat.icon className="text-primary-500 mb-1.5 sm:mb-2" size={20} />
              <p className="text-2xl sm:text-3xl font-display font-black text-white">{stat.value}</p>
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-surface-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="py-16 sm:py-32 px-4 sm:px-6 relative bg-white/[0.01]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-display font-black mb-4 sm:mb-6">DYNAMIC <span className="gradient-text">PRICING</span></h2>
            <p className="text-surface-400 max-w-2xl mx-auto font-medium text-sm sm:text-base">Get the best rates for your game. Prices vary based on time slots and days to ensure maximum value.</p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center max-w-7xl mx-auto">
            {/* Pricing left image */}
            <div className="hidden lg:block lg:col-span-5 relative h-full min-h-[500px] rounded-3xl overflow-hidden shadow-2xl">
              <img src="/images/box_9.jpg.PNG" alt="Pricing Box Photo" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/20 to-transparent flex items-bottom p-8 flex-col justify-end">
                <h3 className="text-3xl font-display font-black text-white">PLAY ANYTIME</h3>
                <p className="text-primary-400 font-bold uppercase tracking-widest text-sm">24/7 SLOTS AVAILABLE</p>
              </div>
            </div>

            <div className="lg:col-span-7 grid sm:grid-cols-2 gap-8">
              {/* Helper to get price */}
              {(() => {
                const getPriceOrDefault = (turf: string, dayType: string, isNight: boolean) => {
                  const hour = isNight ? 20 : 10;
                  const rule = pricingRules.find(r =>
                    r.turfId === turf &&
                    r.dayType === dayType &&
                    (r.startHour <= r.endHour ? (hour >= r.startHour && hour < r.endHour) : (hour >= r.startHour || hour < r.endHour))
                  );
                  if (rule) return rule.price;

                  // Fallback same as server
                  if (turf === 'A') {
                    if (dayType === 'weekend') return isNight ? 1000 : 900;
                    return isNight ? 800 : 700;
                  } else {
                    if (dayType === 'weekend') return isNight ? 1200 : 1000;
                    return isNight ? 900 : 800;
                  }
                };

                return (
                  <>
                    {/* Weekdays */}
                    <div className="glass-card p-6 sm:p-8 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <MdAccessTime size={100} />
                      </div>
                      <h3 className="text-lg sm:text-xl font-display font-black mb-6 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-primary-500/20 flex items-center justify-center text-primary-400">
                          <MdAccessTime size={20} />
                        </span>
                        WEEKDAYS
                      </h3>

                      <div className="grid grid-cols-2 gap-4 relative z-10">
                        <div className="space-y-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary-500">Arena 1</p>
                          <div className="space-y-1">
                            <p className="text-[10px] text-surface-400 font-bold uppercase tracking-tighter">Day</p>
                            <p className="text-xl font-display font-black text-white">₹{pricingLoading ? '...' : getPriceOrDefault('A', 'weekday', false)}<span className="text-[9px] font-medium text-surface-500">/hr</span></p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-surface-400 font-bold uppercase tracking-tighter">Night</p>
                            <p className="text-xl font-display font-black text-white">₹{pricingLoading ? '...' : getPriceOrDefault('A', 'weekday', true)}<span className="text-[9px] font-medium text-surface-500">/hr</span></p>
                          </div>
                        </div>

                        <div className="space-y-4 border-l border-white/5 pl-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-accent-500">Arena 2</p>
                          <div className="space-y-1">
                            <p className="text-[10px] text-surface-400 font-bold uppercase tracking-tighter">Day</p>
                            <p className="text-xl font-display font-black text-white">₹{pricingLoading ? '...' : getPriceOrDefault('B', 'weekday', false)}<span className="text-[9px] font-medium text-surface-500">/hr</span></p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-surface-400 font-bold uppercase tracking-tighter">Night</p>
                            <p className="text-xl font-display font-black text-white">₹{pricingLoading ? '...' : getPriceOrDefault('B', 'weekday', true)}<span className="text-[9px] font-medium text-surface-500">/hr</span></p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Weekends */}
                    <div className="glass-card p-6 sm:p-8 relative overflow-hidden group border-primary-500/30">
                      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <MdStar size={100} />
                      </div>
                      <div className="absolute top-4 right-4">
                        <span className="px-3 py-1 rounded-full bg-primary-500 text-[9px] font-black uppercase tracking-widest text-white">Peak</span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-display font-black mb-6 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-accent-500/20 flex items-center justify-center text-accent-400">
                          <MdStar size={20} />
                        </span>
                        WEEKENDS
                      </h3>

                      <div className="grid grid-cols-2 gap-4 relative z-10">
                        <div className="space-y-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary-500">Arena 1</p>
                          <div className="space-y-1">
                            <p className="text-[10px] text-surface-400 font-bold uppercase tracking-tighter">Day</p>
                            <p className="text-xl font-display font-black text-white">₹{pricingLoading ? '...' : getPriceOrDefault('A', 'weekend', false)}<span className="text-[9px] font-medium text-surface-500">/hr</span></p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-surface-400 font-bold uppercase tracking-tighter">Night</p>
                            <p className="text-xl font-display font-black text-white">₹{pricingLoading ? '...' : getPriceOrDefault('A', 'weekend', true)}<span className="text-[9px] font-medium text-surface-500">/hr</span></p>
                          </div>
                        </div>

                        <div className="space-y-4 border-l border-white/5 pl-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-accent-500">Arena 2</p>
                          <div className="space-y-1">
                            <p className="text-[10px] text-surface-400 font-bold uppercase tracking-tighter">Day</p>
                            <p className="text-xl font-display font-black text-white">₹{pricingLoading ? '...' : getPriceOrDefault('B', 'weekend', false)}<span className="text-[9px] font-medium text-surface-500">/hr</span></p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-surface-400 font-bold uppercase tracking-tighter">Night</p>
                            <p className="text-xl font-display font-black text-white">₹{pricingLoading ? '...' : getPriceOrDefault('B', 'weekend', true)}<span className="text-[9px] font-medium text-surface-500">/hr</span></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-surface-500 text-sm font-medium flex items-center justify-center gap-2">
              <MdSecurity className="text-primary-500" /> GST included. Advance booking of ₹400 required to lock slot.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="py-16 sm:py-32 px-4 sm:px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-display font-black mb-4 sm:mb-6">WHY PLAY AT <span className="gradient-text">VSY PRO?</span></h2>
            <p className="text-surface-400 max-w-2xl mx-auto font-medium text-sm sm:text-base">Built by cricket lovers for cricket lovers. Our facilities are designed to provide the highest quality gameplay experience.</p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Features list */}
            <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4 sm:gap-6">
              {[
                { title: 'High-Density Arena', desc: 'Premium artificial grass designed for box cricket offering true bounce.', icon: MdStar, color: 'text-amber-500' },
                { title: '24/7 Availability', desc: 'Book your favorite slot anytime, day or night.', icon: MdAccessTime, color: 'text-primary-500' },
                { title: 'Secure Environment', desc: 'Fully fenced box architecture ensures safety.', icon: MdSecurity, color: 'text-green-500' },
                { title: 'Instant Payments', desc: 'Hassle-free online booking with Razorpay.', icon: MdPayment, color: 'text-accent-500' },
                { title: 'Match History', desc: 'View all your past bookings in your dashboard.', icon: MdHistory, color: 'text-pink-500' },
                { title: 'Central Location', desc: 'Located in Nadergul with ample parking space in Hyderabad.', icon: MdLocationOn, color: 'text-red-500' },
              ].map((f, i) => (
                <div key={i} className="glass-card-hover p-6 border-none bg-white/[0.03]">
                  <f.icon className={`${f.color} mb-4`} size={28} />
                  <h3 className="text-lg font-display font-bold mb-2">{f.title}</h3>
                  <p className="text-surface-400 text-xs sm:text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Features image */}
            <div className="hidden lg:block lg:col-span-5 relative h-full min-h-[600px] rounded-3xl overflow-hidden shadow-2xl">
              <img src="/images/box_6.jpg.PNG" alt="Features Box Photo" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/20 to-transparent flex items-bottom p-8 flex-col justify-end">
                <h3 className="text-3xl font-display font-black text-white">THE CHAMPION'S <br />CHOICE</h3>
                <p className="text-accent-400 font-bold uppercase tracking-widest text-sm mt-2">Elite Box Cricket Experience</p>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* ═══ GALLERY ═══ */}
      <section id="gallery" className="pb-16 sm:pb-32 pt-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-display font-black mb-4"><span className="text-white">TURF</span> <span className="gradient-text">GALLERY</span></h2>
            <p className="text-surface-400 max-w-2xl mx-auto font-medium text-sm sm:text-base">Take a look at Hyderabad's premier box cricket facility.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:h-[600px]">
            {/* Image 1: Main large image */}
            <div
              onClick={handleMainImageClick}
              className="col-span-2 row-span-2 relative rounded-2xl sm:rounded-3xl overflow-hidden group cursor-pointer"
            >
              <img
                src={`/images/box_${ALL_GALLERY_IMAGES[mainImageIdx]}`}
                alt="Box Main"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-transparent to-transparent flex items-end p-5 sm:p-8">
                <div>
                  <h4 className="text-lg sm:text-2xl font-display font-black text-white">PRO GRADE PERFORMANCE</h4>
                  <p className="text-surface-300 text-xs sm:text-sm mt-1">Tested by local league players. (Tap to change)</p>
                </div>
              </div>
            </div>

            {/* Image 2 */}
            <div className="col-span-1 row-span-1 relative rounded-2xl sm:rounded-3xl overflow-hidden group">
              <img src={`/images/box_${randomSideImages[0] || '2.jpg.jpg'}`} alt="Box Photo 2" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>

            {/* Image 3 */}
            <div className="col-span-1 row-span-1 relative rounded-2xl sm:rounded-3xl overflow-hidden group">
              <img src={`/images/box_${randomSideImages[1] || '3.jpg.jpg'}`} alt="Box Photo 3" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>

            {/* CTA info block */}
            <div className="col-span-2 md:col-span-1 row-span-1 relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-primary-600 to-accent-600 p-5 sm:p-6 flex flex-col justify-center group h-[200px] md:h-auto">
              <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-125 transition-transform duration-700">
                <MdSportsCricket size={60} />
              </div>
              <h4 className="text-base sm:text-xl font-display font-black text-white leading-tight">BIGGEST 360° BOX IN HYD.</h4>
              <button onClick={scrollToBooking} className="mt-3 w-fit px-4 sm:px-6 py-2 rounded-full bg-white text-surface-950 text-xs font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all">Join The Game</button>
            </div>

            {/* Final tall grid item */}
            <div className="col-span-2 md:col-span-1 row-span-1 relative rounded-2xl sm:rounded-3xl overflow-hidden group h-[200px] md:h-auto">
              <img src={`/images/box_${randomSideImages[2] || '4.jpg.jpg'}`} alt="Box Photo 4" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ LOCATION / CONTACT ═══ */}
      <section id="location" className="py-16 sm:py-32 border-t border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-10 sm:gap-16 items-center">
            <div className="space-y-8 sm:space-y-12">
              <div>
                <h2 className="text-3xl sm:text-4xl font-display font-black mb-6 uppercase tracking-tighter">Visit the <span className="text-primary-400">Arena.</span></h2>
                <div className="space-y-5 sm:space-y-6">
                  <div className="flex gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0">
                      <MdLocationOn className="text-primary-400" size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm sm:text-base mb-1">Nadergul, Hyderabad</p>
                      <p className="text-xs sm:text-sm text-surface-400 leading-relaxed">VSY Box Cricket, Village Road,<br />Besides Sanjeevani Park, Hyderabad 501510</p>
                      <a
                        href="https://maps.app.goo.gl/LM4hCLcgC6bb4EcC8"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-primary-400 text-[10px] sm:text-xs font-black uppercase tracking-widest mt-3 sm:mt-4 hover:gap-3 transition-all"
                      >
                        Get Directions <MdArrowForward />
                      </a>
                    </div>
                  </div>

                  <div className="flex gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0">
                      <MdPhone className="text-accent-400" size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm sm:text-base mb-1">Direct Bookings</p>
                      <div className="space-y-0.5">
                        <p className="text-xs sm:text-sm text-surface-400">
                          <a href="tel:+919502154297" className="hover:text-primary-400 transition-colors">+91 95021 54297</a>
                        </p>
                        <p className="text-xs sm:text-sm text-surface-400">
                          <a href="tel:+916305277053" className="hover:text-primary-400 transition-colors">+91 6305-277053</a>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4">
                <a href="https://www.instagram.com/vsyboxcricketpro/" target="_blank" rel="noopener noreferrer" className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/5 flex items-center justify-center hover:bg-pink-500/20 hover:text-pink-400 transition-all">
                  <FaInstagram size={22} />
                </a>
                <a href="https://www.youtube.com/@vsysportsarena" target="_blank" rel="noopener noreferrer" className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/5 flex items-center justify-center hover:bg-red-500/20 hover:text-red-500 transition-all">
                  <FaYoutube size={22} />
                </a>
                <a href="https://wa.me/919502154297" target="_blank" rel="noopener noreferrer" className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/5 flex items-center justify-center hover:bg-green-500/20 hover:text-green-500 transition-all">
                  <FaWhatsapp size={22} />
                </a>
              </div>
            </div>

            <div className="relative aspect-video lg:aspect-square rounded-2xl sm:rounded-3xl overflow-hidden grayscale contrast-125 opacity-70 border border-white/10 shadow-2xl">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3809.5855260172607!2d78.5414633749445!3d17.28741348358485!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcba33c566df96f%3A0x63925de9bcc65057!2sVSY%20BOX%20CRICKET!5e0!3m2!1sen!2sin!4v1712745321345!5m2!1sen!2sin"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="py-12 sm:py-20 px-4 sm:px-6 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 sm:gap-12 text-center md:text-left">
          <div>
            <div className="flex flex-col items-center md:items-start gap-3 mb-4 sm:mb-6">
              <div className="h-14 sm:h-20 w-24 sm:w-32 rounded-xl overflow-hidden bg-white/5 p-1">
                <img src="/images/logo.png" alt="VSY Logo" className="w-full h-full object-contain" />
              </div>
            </div>
            <p className="text-surface-500 text-xs sm:text-sm max-w-xs mx-auto md:mx-0 font-medium">Providing the best athletic experience in Hyderabad since 2024.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-8 sm:gap-12">
            <div className="space-y-3 sm:space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-white">Navigation</p>
              <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-surface-500 font-bold uppercase tracking-tighter">
                <li><a href="#" className="hover:text-primary-400">Home</a></li>
                <li><a href="#features" className="hover:text-primary-400">Features</a></li>
                <li><a href="#pricing" className="hover:text-primary-400">Pricing</a></li>
                <li><a href="#gallery" className="hover:text-primary-400">Gallery</a></li>
              </ul>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-white">Support</p>
              <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-surface-500 font-bold uppercase tracking-tighter">
                <li><a href="#" className="hover:text-primary-400">Terms</a></li>
                <li><a href="#" className="hover:text-primary-400">Privacy</a></li>
                <li><a href="mailto:vsysportsarena@gmail.com" className="hover:text-primary-400">Email Us</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-10 sm:mt-20 pt-6 sm:pt-8 border-t border-white/5 flex flex-col items-center gap-4">
          <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] text-surface-600">© 2024 VSY SPORTS ARENA • HYDERABAD</p>
        </div>
      </footer>
    </div>
  );
};

export default LoginPage;
