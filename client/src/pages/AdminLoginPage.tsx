import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminLogin } from '../services/api';
import toast from 'react-hot-toast';
import { MdEmail, MdLock, MdArrowForward, MdArrowBack } from 'react-icons/md';

const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginAdmin } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const res = await adminLogin(email, password);
      if (res.success && res.data) {
        loginAdmin(res.data.token, res.data.admin);
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        toast.error(axiosError.response?.data?.message || 'Login failed');
      } else {
        toast.error('Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="glass-card p-8 animate-scale-in">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="h-20 sm:h-24 w-32 sm:w-40 rounded-2xl overflow-hidden bg-white/5 p-2 mx-auto mb-4 border border-white/5">
              <img src="/images/logo.png" alt="VSY Logo" className="w-full h-full object-contain" />
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Email</label>
              <div className="relative">
                <MdEmail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter admin email"
                  className="input-field pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Password</label>
              <div className="relative">
                <MdLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="input-field pl-10"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Login <MdArrowForward size={18} />
                </>
              )}
            </button>
          </form>

          <div className="border-t border-white/5 mt-6 pt-4">
            <Link
              to="/"
              className="flex items-center justify-center gap-2 text-sm text-surface-400 hover:text-primary-400 transition-colors"
            >
              <MdArrowBack size={16} /> Back to User Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
