
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Users, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { BarChart, Bar, Cell, ResponsiveContainer, XAxis, Tooltip } from 'recharts';

interface PatientData {
    id: string;
    username: string;
    email: string;
    logs: any[];
    compliance: 'green' | 'yellow' | 'red';
    avgHours: number;
    chartData?: { day: string; hours: number }[];
}

export default function DentistDashboard() {
    const [patients, setPatients] = useState<PatientData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: assignments } = await supabase
            .from('assignments')
            .select('patient_id')
            .eq('dentist_id', user.id);

        if (!assignments || assignments.length === 0) {
            setLoading(false);
            return;
        }

        const patientIds = assignments.map(a => a.patient_id);

        const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', patientIds);

        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - 7);
        
        const { data: logs } = await supabase
            .from('timer_logs')
            .select('*')
            .in('user_id', patientIds)
            .gte('start_time', startOfWeek.toISOString());

        const processed = (profiles || []).map(profile => {
            const patientLogs = (logs || []).filter(l => l.user_id === profile.id);
            
            let totalHours = 0;
            const dailyHours: Record<string, number> = {};
            
            for(let i=0; i<7; i++) {
                 const d = new Date();
                 d.setDate(d.getDate() - i);
                 dailyHours[d.toDateString()] = 0;
            }

            patientLogs.forEach(log => {
                const dateKey = new Date(log.start_time).toDateString();
                const start = new Date(log.start_time).getTime();
                const end = log.end_time ? new Date(log.end_time).getTime() : new Date().getTime();
                const hours = (end - start) / (1000 * 60 * 60);
                
                if (dailyHours[dateKey] !== undefined) {
                    dailyHours[dateKey] += hours;
                    totalHours += hours;
                }
            });

            const daysValues = Object.values(dailyHours);
            const avgHours = daysValues.reduce((a, b) => a + b, 0) / 7;
            
            const hasSkippedDay = daysValues.some(h => h < 0.1); 
            const isLowUsage = avgHours < 20;

            let compliance: 'green' | 'yellow' | 'red' = 'green';
            if (hasSkippedDay) compliance = 'red';
            else if (isLowUsage) compliance = 'yellow';

            const chartData = Object.entries(dailyHours).map(([date, hours]) => ({
                day: new Date(date).toLocaleDateString(undefined, {weekday: 'narrow'}),
                hours: hours
            })).reverse();

            return {
                id: profile.id,
                username: profile.username || profile.email?.split('@')[0],
                email: profile.email,
                logs: patientLogs,
                compliance,
                avgHours,
                chartData
            };
        });

        setPatients(processed);
        setLoading(false);
    };

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'green': return 'text-brand-green border-brand-green/30 bg-brand-green/10';
            case 'yellow': return 'text-brand-yellow border-brand-yellow/30 bg-brand-yellow/10';
            case 'red': return 'text-brand-red border-brand-red/30 bg-brand-red/10';
            default: return 'text-white border-white/10';
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
             <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-brand-surface rounded-2xl flex items-center justify-center border border-white/5">
                    <Users size={32} className="text-white"/>
                </div>
                <div>
                    <h1 className="text-3xl font-serif-display text-white">My Patients</h1>
                    <p className="text-white/50 text-sm">Monitor compliance and weekly progress.</p>
                </div>
            </div>

            {loading ? (
                <div className="text-white/50 text-center py-20">Loading patients...</div>
            ) : patients.length === 0 ? (
                <div className="bg-card border border-white/5 rounded-[2.5rem] p-12 text-center text-white/50">
                    No patients assigned yet. Ask an admin to link patients to your profile.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {patients.map(patient => (
                        <div key={patient.id} className="bg-card border border-white/5 rounded-[2.5rem] p-8 shadow-xl flex flex-col hover:border-white/10 transition-all">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-serif-display text-white">{patient.username}</h3>
                                    <p className="text-xs text-white/40">{patient.email}</p>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border flex items-center gap-2 ${getStatusColor(patient.compliance)}`}>
                                    {patient.compliance === 'green' && <CheckCircle size={14} />}
                                    {patient.compliance === 'yellow' && <Clock size={14} />}
                                    {patient.compliance === 'red' && <AlertCircle size={14} />}
                                    {patient.compliance.toUpperCase()}
                                </div>
                            </div>

                            <div className="flex-1 mb-6">
                                <div className="flex justify-between items-end mb-2">
                                     <span className="text-xs text-white/50 uppercase tracking-widest">Weekly Avg</span>
                                     <span className="text-2xl font-serif-display text-white">{patient.avgHours.toFixed(1)} <span className="text-sm text-white/40">hrs</span></span>
                                </div>
                                <div className="h-32 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={patient.chartData || []}>
                                            <XAxis dataKey="day" tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                                             <Tooltip 
                                                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                                contentStyle={{backgroundColor: '#1f2937', borderColor: 'transparent', borderRadius: '8px', color: '#fff'}}
                                             />
                                            <Bar dataKey="hours" radius={[3, 3, 3, 3]}>
                                                {(patient.chartData || []).map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={patient.compliance === 'red' && entry.hours < 0.1 ? '#A72703' : profileColor(patient.compliance)} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            
                            <button className="w-full py-3 rounded-xl bg-brand-base hover:bg-brand-base/80 text-white/60 hover:text-white transition-colors text-sm font-medium">
                                View Full Records
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const profileColor = (status: string) => {
    switch(status) {
        case 'green': return '#94A378';
        case 'yellow': return '#E5BA41';
        case 'red': return '#A72703';
        default: return '#94A378';
    }
};
