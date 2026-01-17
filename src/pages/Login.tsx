
import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { User, Stethoscope } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'dentist'>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      navigate('/aligner/timer');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-aesthetic p-4">
      <div className="bg-brand-surface/90 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] w-full max-w-screen-lg animate-in fade-in zoom-in duration-700 overflow-hidden flex flex-col md:flex-row">
        
        <div className="w-full md:w-5/12 p-8 md:p-12 flex flex-col justify-center items-start bg-brand-base/50 relative">
           <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-green/10 to-transparent pointer-events-none"></div>
           
           <div className="bg-brand-base w-80 h-20 flex items-center justify-center rounded-[2rem] shadow-[0_0_30px_rgba(148,163,120,0.1)] border border-brand-green/20 mb-8 relative z-10">
             <h1 className="font-serif-display text-3xl font-bold text-brand-green tracking-widest">InVilign</h1>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-serif-display font-medium text-left mb-4 text-white tracking-tight leading-tight relative z-10">
            Welcome Back
          </h2>
          <p className="text-white/60 text-left font-light text-lg relative z-10">
            Sign in to track your aligner journey.
          </p>
        </div>

        <div className="w-full md:w-7/12 p-8 md:p-12 bg-transparent">
          <div className="flex bg-brand-base p-1.5 rounded-2xl mb-8 border border-white/5">
            <button
              onClick={() => setRole('user')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 ${
                role === 'user' ? 'bg-brand-green text-white shadow-lg shadow-brand-green/20' : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <User size={18} />
              <span className="font-medium tracking-wide">User</span>
            </button>
            <button
              onClick={() => setRole('dentist')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 ${
                role === 'dentist' ? 'bg-brand-yellow text-brand-base shadow-lg shadow-brand-yellow/20' : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <Stethoscope size={18} />
              <span className="font-medium tracking-wide">Dentist</span>
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2 ml-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 bg-brand-base border border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green/50 outline-none text-white placeholder-white/20 transition-all hover:bg-brand-base/80"
                placeholder="name@example.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2 ml-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 bg-brand-base border border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green/50 outline-none text-white placeholder-white/20 transition-all hover:bg-brand-base/80"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-4 bg-brand-red/20 border border-brand-red/30 rounded-2xl text-brand-red text-sm font-medium text-center backdrop-blur-md">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 bg-brand-green hover:bg-brand-green/90 text-white font-serif-display text-lg tracking-wide rounded-2xl shadow-xl shadow-brand-green/20 transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-8 text-center text-white/40 text-sm font-light">
            Don't have an account? <span className="text-brand-green hover:text-white cursor-pointer transition-colors border-b border-transparent hover:border-brand-green">Contact your {role === 'user' ? 'Dentist' : 'Administrator'}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
