import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import MobileBottomNav from '../components/MobileBottomNav';
import { MdPerson, MdPhone, MdEmail, MdLogout, MdHistory } from 'react-icons/md';
import toast from 'react-hot-toast';

// Optional: you could export an update profile method in authStore, but a simple API fetch works
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const ProfilePage = () => {
  const { user, token, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Component State
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState((user as any)?.email || ''); // In case email is in user model later
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name cannot be empty');
    
    setIsUpdating(true);
    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, email })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success(data.message || 'Profile updated');
        await refreshProfile(); // refresh auth state in store
      } else {
        toast.error(data.message || 'Failed to update profile');
      }
    } catch (error) {
      toast.error('An error occurred while updating profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogoutClick = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <Navbar />
      
      <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 flex items-start justify-center max-w-7xl mx-auto w-full animate-fade-in">
        <div className="w-full max-w-2xl">
          
          <div className="mb-6">
            <h1 className="text-3xl font-display font-black text-white">Your Account</h1>
            <p className="text-surface-400 mt-1">Manage your personal details and app settings</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left side settings Form */}
            <div className="md:col-span-2 glass-card p-5 sm:p-6 border-white/5 order-2 md:order-1">
              <h2 className="text-xl font-display font-bold text-white mb-6">Profile Details</h2>
              <form onSubmit={handleUpdate} className="space-y-4">
                
                {/* Phone - Read only */}
                <div>
                  <label className="block text-xs font-bold tracking-wider text-surface-400 uppercase mb-2">Phone Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-500">
                      <MdPhone size={20} />
                    </div>
                    <input
                      type="text"
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-surface-400 cursor-not-allowed"
                      value={user?.phone || ''}
                      disabled
                    />
                  </div>
                  <p className="text-[10px] text-surface-500 mt-1">Phone number cannot be changed.</p>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-bold tracking-wider text-surface-400 uppercase mb-2">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-500">
                      <MdPerson size={20} />
                    </div>
                    <input
                      type="text"
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all"
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold tracking-wider text-surface-400 uppercase mb-2">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-500">
                      <MdEmail size={20} />
                    </div>
                    <input
                      type="email"
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all"
                      placeholder="Enter your email (optional)"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="btn-primary w-full sm:w-auto"
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>

            {/* Right side actions */}
            <div className="space-y-4 order-1 md:order-2">
              <div className="glass-card p-5 sm:p-6 border-white/5 flex flex-col items-center text-center">
                 <div className="w-20 h-20 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center mb-4">
                   <MdPerson size={36} />
                 </div>
                 <h3 className="text-xl font-bold text-white max-w-full truncate">{user?.name}</h3>
                 <p className="text-xs text-primary-400 font-medium px-3 py-1.5 bg-primary-500/10 rounded-md mt-2">Verified Customer</p>
              </div>

              <div className="glass-card p-3 border-white/5 flex flex-col gap-2">
                <button
                  onClick={() => navigate('/bookings')}
                  className="flex items-center gap-3 w-full p-3 text-left rounded-lg hover:bg-white/5 transition-colors text-surface-200"
                >
                  <div className="w-8 h-8 rounded-md bg-surface-800 flex items-center justify-center text-surface-400">
                    <MdHistory size={18} />
                  </div>
                  <span className="font-medium text-sm text-white">View Bookings</span>
                </button>
                
                <button
                  onClick={handleLogoutClick}
                  className="flex items-center gap-3 w-full p-3 text-left rounded-lg hover:bg-red-500/10 transition-colors text-red-500 group"
                >
                  <div className="w-8 h-8 rounded-md bg-red-500/10 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
                    <MdLogout size={18} />
                  </div>
                  <span className="font-medium text-sm">Sign Out</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
};

export default ProfilePage;
