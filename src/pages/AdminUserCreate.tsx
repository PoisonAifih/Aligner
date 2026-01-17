
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { UserPlus, Check, X, Lock, Mail, User } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const tempClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false, 
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});


export default function AdminUserCreate() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [role, setRole] = useState('user');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const { data, error } = await tempClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username,
                        role
                    }
                }
            });

            if (error) throw error;

            if (data.user) {
                setMessage({ type: 'success', text: `User ${username} created successfully!` });
                setEmail('');
                setPassword('');
                setUsername('');
                setRole('user');
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
             <div className="flex items-center gap-4 mb-2">
                <div className="w-14 h-14 bg-brand-surface rounded-2xl flex items-center justify-center border border-white/5">
                    <UserPlus size={32} className="text-white"/>
                </div>
                <div>
                    <h1 className="text-3xl font-serif-display text-white">Create New User</h1>
                    <p className="text-white/50 text-sm">Add a patient or dentist to the system</p>
                </div>
            </div>

            <div className="max-w-2xl">
                <div className="bg-card border border-white/5 rounded-[2.5rem] p-8 sm:p-10 shadow-xl">
                    <form onSubmit={handleCreate} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/70 ml-1">Role</label>
                            <div className="grid grid-cols-2 gap-3 p-1 bg-brand-base rounded-2xl border border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setRole('user')}
                                    className={`py-3 rounded-xl text-sm font-medium transition-all ${role === 'user' ? 'bg-brand-green text-white shadow-lg shadow-brand-green/20' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                                >
                                    Patient
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole('dentist')}
                                    className={`py-3 rounded-xl text-sm font-medium transition-all ${role === 'dentist' ? 'bg-brand-yellow text-brand-base shadow-lg shadow-brand-yellow/20' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                                >
                                    Dentist
                                </button>
                            </div>
                        </div>

                         <div className="space-y-2">
                            <label className="text-sm font-medium text-white/70 ml-1">Username</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18}/>
                                <input 
                                    type="text" 
                                    required
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="ivy"
                                    className="w-full bg-brand-base border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-brand-green outline-none transition-colors placeholder:text-white/20"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/70 ml-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18}/>
                                <input 
                                    type="email" 
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="ivy@example.com"
                                    className="w-full bg-brand-base border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-brand-green outline-none transition-colors placeholder:text-white/20"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/70 ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18}/>
                                <input 
                                    type="password" 
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-brand-base border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-brand-green outline-none transition-colors placeholder:text-white/20"
                                />
                            </div>
                        </div>

                        {message && (
                            <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${message.type === 'success' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'bg-brand-red/20 text-brand-red border border-brand-red/30'}`}>
                                {message.type === 'success' ? <Check size={18} /> : <X size={18} />}
                                {message.text}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-brand-green hover:bg-brand-green/90 text-white font-serif-display text-lg py-4 rounded-2xl mt-2 transition-all shadow-xl shadow-brand-green/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? 'Creating...' : 'Create User'}
                        </button>
                    </form>
                </div>
                
                <p className="text-center text-white/30 text-xs mt-6">
                    Note: If any error occurs, contact the admin.
                </p>
            </div>
        </div>
    );
}
