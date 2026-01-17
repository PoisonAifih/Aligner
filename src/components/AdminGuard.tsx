
import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Shield, Lock, ArrowRight, AlertTriangle } from 'lucide-react';
import { CookieStorage } from '../lib/storage';

export default function AdminGuard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    useEffect(() => {
        const storedAuth = CookieStorage.getItem('admin_authenticated');
        if (storedAuth === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'INVILIGN') {
            CookieStorage.setItem('admin_authenticated', 'true');
            setIsAuthenticated(true);
            setError(false);
        } else {
            setError(true);
            setPassword('');
        }
    };

    if (isAuthenticated) {
        return <Outlet />;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-aesthetic p-4">
            <div className="bg-brand-surface/90 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-brand-base rounded-2xl flex items-center justify-center border border-white/5 shadow-inner">
                        <Shield className="text-brand-accent" size={32} />
                    </div>
                </div>
                
                <h2 className="text-2xl font-serif-display text-white text-center mb-2">Admin Access</h2>
                <p className="text-white/50 text-center text-sm mb-8">
                    This area is restricted. Please enter the administrator password to continue.
                </p>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (error) setError(false);
                            }}
                            placeholder="Enter Password"
                            className={`w-full bg-brand-base border ${error ? 'border-brand-red/50 focus:border-brand-red' : 'border-white/10 focus:border-brand-accent'} rounded-2xl py-4 pl-12 pr-4 text-white outline-none transition-all placeholder:text-white/20`}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-brand-red text-xs justify-center animate-in fade-in slide-in-from-top-1">
                            <AlertTriangle size={14} />
                            <span>Incorrect password. Please try again.</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white font-serif-display text-lg py-4 rounded-2xl shadow-xl shadow-brand-accent/20 transition-all flex items-center justify-center gap-2 mt-4"
                    >
                        Access Dashboard <ArrowRight size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}
