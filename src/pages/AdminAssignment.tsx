
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Users, ArrowRight, Check} from 'lucide-react';

export default function AdminAssignment() {
    const [users, setUsers] = useState<any[]>([]);
    const [dentists, setDentists] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [selectedDentist, setSelectedDentist] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{type: string, text: string} | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('*');
        
        if (profiles) {
            setUsers(profiles.filter((p: any) => p.role === 'user'));
            setDentists(profiles.filter((p: any) => p.role === 'dentist'));
        }
    };

    const handleAssign = async () => {
        if (!selectedUser || !selectedDentist) return;
        setLoading(true);
        setMessage(null);
        try {
            const { error } = await supabase
                .from('assignments')
                .insert({
                    patient_id: selectedUser,
                    dentist_id: selectedDentist
                });

            if (error) {
                if (error.code === '23505') { 
                    setMessage({ type: 'error', text: 'This patient is already assigned to this dentist.' });
                } else {
                    throw error;
                }
            } else {
                setMessage({ type: 'success', text: 'Patient assigned successfully.' });
                setSelectedUser(null);
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
             <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-brand-surface rounded-2xl flex items-center justify-center border border-white/5">
                    <Users size={32} className="text-white"/>
                </div>
                <div>
                    <h1 className="text-3xl font-serif-display text-white">Patient Assignment</h1>
                    <p className="text-white/50 text-sm">Link patients to dentists for monitoring.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                
                <div className="bg-card border border-white/5 rounded-[2.5rem] p-8 shadow-xl">
                    <h3 className="text-xl font-serif-display text-white mb-6">Select Patient</h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {users.map(u => (
                            <button
                                key={u.id}
                                onClick={() => setSelectedUser(u.id)}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedUser === u.id ? 'bg-primary/20 border-primary text-primary' : 'bg-brand-base border-white/5 text-white/70 hover:bg-brand-base/80 hover:text-white'}`}
                            >
                                <div className="flex flex-col text-left">
                                    <span className="font-medium">{u.username || u.email}</span>
                                    <span className="text-xs opacity-50">{u.email}</span>
                                </div>
                                {selectedUser === u.id && <Check size={18} />}
                            </button>
                        ))}
                    </div>
                </div>

                 <div className="bg-card border border-white/5 rounded-[2.5rem] p-8 shadow-xl">
                    <h3 className="text-xl font-serif-display text-white mb-6">Select Dentist</h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {dentists.map(d => (
                            <button
                                key={d.id}
                                onClick={() => setSelectedDentist(d.id)}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedDentist === d.id ? 'bg-brand-accent/20 border-brand-accent text-brand-accent' : 'bg-brand-base border-white/5 text-white/70 hover:bg-brand-base/80 hover:text-white'}`}
                            >
                                <div className="flex flex-col text-left">
                                    <span className="font-medium">{d.username || d.email}</span>
                                    <span className="text-xs opacity-50">{d.email}</span>
                                </div>
                                {selectedDentist === d.id && <Check size={18} />}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-center">
                <button
                    onClick={handleAssign}
                    disabled={!selectedUser || !selectedDentist || loading}
                    className="flex items-center gap-3 px-10 py-4 bg-brand-green hover:bg-brand-green/90 text-white rounded-2xl font-serif-display text-lg shadow-xl shadow-brand-green/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {loading ? 'Assigning...' : 'Assign Patient'} <ArrowRight size={20} />
                </button>
            </div>

            {message && (
                <div className={`p-4 rounded-2xl text-center font-medium max-w-md mx-auto ${message.type === 'error' ? 'bg-brand-red/20 text-brand-red' : 'bg-brand-green/20 text-brand-green'}`}>
                    {message.text}
                </div>
            )}
        </div>
    );
}
