
import { useState, useEffect, useRef } from 'react';
import Calendar from 'react-calendar';
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Play, Pause, Settings, Plus, X, Calendar as CalendarIcon, History, BarChart2, Trash2 } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import type { TimerLog } from '../services/supabaseService';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import 'react-calendar/dist/Calendar.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [todayLogs, setTodayLogs] = useState<TimerLog[]>([]);
  const [weeklyLogs, setWeeklyLogs] = useState<TimerLog[]>([]);
  const [timerStatus, setTimerStatus] = useState<'IDLE' | 'RUNNING' | 'PAUSED'>('IDLE');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  
  const [journeyStartDate, setJourneyStartDate] = useState<string | null>(null);
  const [showStartJourneyModal, setShowStartJourneyModal] = useState(false);
  const [journeyModalDate, setJourneyModalDate] = useState('');
  const [journeyModalTime, setJourneyModalTime] = useState('');

  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  
  const [pauseReason, setPauseReason] = useState('Eating');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  const [manualReason, setManualReason] = useState(''); 

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

  const [selectedDate, setSelectedDate] = useState(new Date());

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    const midnightInterval = setInterval(() => {
        if (timerStatus === 'RUNNING' && startTime && activeLogId && user) {
            supabaseService.checkMidnightSplit(user.id, activeLogId, startTime.toISOString())
                .then(newLog => {
                    if (newLog) {
                        setStartTime(new Date(newLog.start_time));
                        setActiveLogId(newLog.id);
                        const today = new Date();
                        setSelectedDate(today);
                        fetchDailyData(today);
                    }
                })
                .catch(err => console.error("Error in midnight check:", err));
        }
    }, 10000); 
    return () => clearInterval(midnightInterval);
  }, [timerStatus, startTime, activeLogId, user]);

  useEffect(() => {
    if (user) {
      fetchDailyData(selectedDate);
      fetchWeeklyData();
    }
  }, [user, selectedDate]);

  useEffect(() => {
    if (timerStatus === 'RUNNING' && startTime) {
      timerRef.current = setInterval(() => {
        const now = new Date();
        const start = new Date(startTime);
        setElapsedSeconds(Math.floor((now.getTime() - start.getTime()) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerStatus, startTime]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/Aligner');
    } else {
      setUser(user);
      try {
        const profileData = await supabaseService.getProfile(user.id);
        setProfile(profileData);
        if (profileData?.current_aligner_date && profileData?.is_journey_active) {
            setJourneyStartDate(profileData.current_aligner_date);
        }
      } catch (err) {
        console.error('Error fetching profile', err);
      }
      
       const { data: logs } = await supabase
        .from('timer_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'RUNNING')
        .limit(1)
        .maybeSingle();
      
      if (logs) {
        const splitLog = await supabaseService.checkMidnightSplit(user.id, logs.id, logs.start_time);
        
        if (splitLog) {
            setTimerStatus('RUNNING');
            setStartTime(new Date(splitLog.start_time));
            setActiveLogId(splitLog.id);
            setElapsedSeconds(Math.floor((new Date().getTime() - new Date(splitLog.start_time).getTime()) / 1000));
        } else {
            setTimerStatus('RUNNING');
            setStartTime(new Date(logs.start_time));
            setActiveLogId(logs.id);
            const now = new Date();
            const start = new Date(logs.start_time);
            setElapsedSeconds(Math.floor((now.getTime() - start.getTime()) / 1000));
        }
      }
    }
  };

  const fetchDailyData = async (date: Date) => {
    if (!user) return;
    try {
      const logs = await supabaseService.getDailyLogs(user.id, date);
      setTodayLogs(logs);
    } catch (error) {
      console.error('Error fetching logs', error);
    }
  };

  const fetchWeeklyData = async () => {
    if (!user) return;
    try {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0,0,0,0);
      const logs = await supabaseService.getWeeklyLogs(user.id, start);
      setWeeklyLogs(logs);
    } catch (error) {
       console.error('Error fetching weekly logs', error);
    }
  };

  const handleStartTimer = async () => {
    if (!user) return;
    try {
       const log = await supabaseService.startTimer(user.id);
       setTimerStatus('RUNNING');
       setStartTime(new Date());
       setActiveLogId(log.id);
       setElapsedSeconds(0);
       fetchDailyData(selectedDate); 
    } catch (err) {
      console.error(err);
    }
  };

  const handlePauseClick = () => {
    setShowPauseModal(true);
  };

  const confirmPause = async () => {
    if (!activeLogId || !user) return;
    try {
      await supabaseService.pauseTimer(activeLogId, pauseReason);
      setTimerStatus('IDLE'); 
      setShowPauseModal(false);
      fetchDailyData(selectedDate);
      fetchWeeklyData();
      setActiveLogId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualEntry = async () => {
      if (!user) return;
      try {
          const start = new Date(`${manualDate}T${manualStartTime}`);
          const end = new Date(`${manualDate}T${manualEndTime}`);
          await supabaseService.addManualLog(user.id, start, end, manualReason);
          setShowManualEntryModal(false);
          fetchDailyData(selectedDate);
          fetchWeeklyData();
      } catch (err) {
          console.error(err);
          alert('Error adding log');
      }
  };

  const handleDeleteLog = async (logId: string) => {
      if (!confirm('Are you sure you want to delete this log?')) return;
      try {
          await supabaseService.deleteLog(logId);
          fetchDailyData(selectedDate);
          fetchWeeklyData();
      } catch (err) {
          console.error('Error deleting log', err);
      }
  };

  const handleChangePassword = async () => {
      setPasswordMessage({ type: '', text: '' });
      if (newPassword !== confirmPassword) {
          setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
          return;
      }
      try {
          await supabaseService.updateUserPassword(newPassword);
          setPasswordMessage({ type: 'success', text: 'Password updated successfully' });
          setOldPassword('');
          setNewPassword('');
          setConfirmPassword('');
      } catch (err: any) {
          setPasswordMessage({ type: 'error', text: err.message });
      }
  };


  const handleStartJourney = async () => {
      if (!user || !journeyModalDate || !journeyModalTime) return;
      try {
          const startDate = new Date(`${journeyModalDate}T${journeyModalTime}`).toISOString();
          
          await supabase
            .from('profiles')
            .update({ 
                current_aligner_date: startDate,
                is_journey_active: true
            })
            .eq('id', user.id);

          setJourneyStartDate(startDate);
          setShowStartJourneyModal(false);
      } catch (err) {
          console.error(err);
      }
  };

  const handleStopJourney = async () => {
      if (!user) return;
      if (!confirm('Are you sure you want to finish your aligner journey? This will stop all tracking.')) return;
      try {
          await supabase
            .from('profiles')
            .update({ 
                is_journey_active: false
            })
            .eq('id', user.id);
            
          setJourneyStartDate(null);
          if (timerStatus === 'RUNNING' && activeLogId) {
             await supabaseService.pauseTimer(activeLogId, 'Journey Finished');
             setTimerStatus('IDLE');
             setActiveLogId(null);
          }
      } catch (err) {
          console.error(err);
      }
  };

  const handleConfirmChange = async () => {
        if (!user) return;
        if (!confirm('Confirm that you have changed your aligners? This will reset the weekly timer.')) return;
        try {
            const now = new Date().toISOString();
            await supabaseService.updateProfile(user.id, {
                current_aligner_date: now
            });
            setJourneyStartDate(now);
        } catch (err) {
            console.error(err);
        }
    };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isSelectedDateToday = () => {
     const today = new Date();
     return selectedDate.toDateString() === today.toDateString();
  };

  const totalWearTimeToday = todayLogs.reduce((acc, log) => {
     if (log.status === 'RUNNING') return acc;
     const start = new Date(log.start_time).getTime();
     const end = log.end_time ? new Date(log.end_time).getTime() : new Date().getTime();
     return acc + (end - start);
  }, 0) + (timerStatus === 'RUNNING' && isSelectedDateToday() ? elapsedSeconds * 1000 : 0);

  const getWeeklyChartData = () => {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const last7Days = Array.from({length: 7}, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - 6 + i); 
          return d;
      });

      return last7Days.map(date => {
          const dayLogs = weeklyLogs.filter(log => {
              const logDate = new Date(log.start_time);
              return logDate.toDateString() === date.toDateString();
          });
          
          const totalMs = dayLogs.reduce((acc, log) => {
             const start = new Date(log.start_time).getTime();
             const end = log.end_time ? new Date(log.end_time).getTime() : (
                 log.status === 'RUNNING' ? new Date().getTime() : start 
             );
             return acc + (end - start);
          }, 0);

          return {
              name: days[date.getDay()],
              hours: (totalMs / (1000 * 60 * 60)).toFixed(1),
              fullDate: date.toDateString()
          };
      });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-serif-display font-bold text-white tracking-wide">
                Hello, {profile?.username || user?.email?.split('@')[0]}!
            </h1>
            <p className="text-brand-green mt-1 font-medium">Have a great day tracking your smile.</p>
          </div>
          <div className="bg-card px-6 py-3 rounded-2xl border border-white/5 shadow-lg flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse"></div>
             <span className="text-sm font-medium text-white/80">{new Date().toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric'})}</span>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-card rounded-[2.5rem] p-10 flex flex-col items-center justify-center relative overflow-hidden shadow-xl group border border-white/5">
                <div className="absolute top-0 right-0 p-6 opacity-5">
                    <Play size={200} />
                </div>
                <h2 className="text-brand-green/80 text-sm uppercase tracking-[0.3em] mb-6 font-bold text-center">
                    {isSelectedDateToday() ? "Current Session" : `Total for ${selectedDate.toLocaleDateString()}`}
                </h2>
                <div className="text-[6rem] sm:text-[8rem] leading-none font-serif-display text-white mb-10 drop-shadow-2xl">
                    {formatTime(Math.floor(totalWearTimeToday / 1000))}
                </div>
                
                <div className="flex gap-6 w-full justify-center relative z-10 h-20">
                    {isSelectedDateToday() && (
                        timerStatus === 'RUNNING' ? (
                                <button 
                                onClick={handlePauseClick}
                                className="flex items-center gap-3 px-10 py-5 bg-brand-yellow/10 hover:bg-brand-yellow/20 text-brand-yellow border border-brand-yellow/20 hover:border-brand-yellow/40 rounded-2xl transition-all w-64 justify-center active:scale-95 shadow-xl"
                            >
                                <Pause size={24} className="fill-current"/>
                                <span className="text-xl font-serif-display tracking-wide font-medium">Pause</span>
                            </button>
                        ) : (
                            <button 
                                onClick={handleStartTimer}
                                className="flex items-center gap-3 px-10 py-5 bg-primary hover:bg-primary/90 text-white rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all w-64 justify-center active:scale-95 border border-white/10"
                            >
                                <Play size={24} className="fill-current" />
                                <span className="text-xl font-serif-display tracking-wide font-medium">Resume</span>
                            </button>
                        )
                    )}
                </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
                <div className="bg-card border border-white/5 p-8 rounded-[2.5rem] shadow-xl h-auto">
                     <h3 className="font-serif-display text-lg text-white/90 flex items-center justify-between mb-6">
                        <span className="flex items-center gap-3"><CalendarIcon size={20} className="text-brand-green"/> Calendar</span>
                        <span className="text-xs font-sans text-white/30 bg-white/5 px-2 py-1 rounded-lg">Select date to view history</span>
                    </h3>
                    <div className="calendar-wrapper bg-brand-base rounded-3xl p-4 border border-white/5">
                        <Calendar 
                            className="w-full"
                            value={selectedDate} 
                            onClickDay={(value) => setSelectedDate(value)}
                        />
                    </div>
                </div>

                 <div className="bg-card border border-white/5 p-8 rounded-[2.5rem] shadow-xl">
                    <h3 className="font-serif-display text-lg text-white/90 flex items-center gap-2 mb-6">
                        <BarChart2 size={20} className="text-brand-yellow"/>
                        Weekly Trends
                    </h3>
                     <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={getWeeklyChartData()}>
                                <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748b', fontFamily: 'serif'}} axisLine={false} tickLine={false} dy={5} />
                                <Bar dataKey="hours" radius={[4, 4, 4, 4]}>
                                    <LabelList dataKey="hours" position="top" fill="rgba(255,255,255,0.5)" fontSize={10} formatter={(val: any) => Number(val) > 0 ? val : ''} />
                                    {getWeeklyChartData().map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 6 ? '#94A378' : 'rgba(255,255,255,0.1)'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-12">
                 {!journeyStartDate ? (
                     <button 
                        onClick={() => setShowStartJourneyModal(true)}
                        className="w-full bg-gradient-to-r from-brand-base to-brand-surface border border-brand-green/30 p-8 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:border-brand-green/60 transition-all shadow-xl group"
                     >
                         <div className="w-16 h-16 bg-brand-green/20 rounded-full flex items-center justify-center text-brand-green group-hover:scale-110 transition-transform">
                             <CalendarIcon size={32} />
                         </div>
                         <div className="text-center">
                             <h3 className="text-xl font-serif-display text-white">Start Aligner Journey</h3>
                             <p className="text-white/50 text-sm mt-1">Click here to set your first aligner date</p>
                         </div>
                     </button>
                 ) : (
                    <div className="bg-gradient-to-r from-brand-green/10 to-transparent border border-brand-green/20 p-8 rounded-[2.5rem] flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="w-16 h-16 bg-brand-green rounded-2xl flex items-center justify-center text-brand-base shadow-lg shadow-brand-green/20">
                                <CalendarIcon size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-serif-display text-white">Current Aligner</h3>
                                <p className="text-brand-green text-sm font-medium uppercase tracking-wider mt-1">
                                    Started {new Date(journeyStartDate).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                         <div className="text-center relative z-10">
                            {(() => {
                                const start = new Date(journeyStartDate);
                                const nextChange = new Date(start);
                                nextChange.setDate(start.getDate() + 7);
                                const now = new Date();
                                
                                const oneDay = 24 * 60 * 60 * 1000;
                                const diffDays = Math.ceil((nextChange.getTime() - now.getTime()) / oneDay);
                                
                                const isOverdue = now >= nextChange;

                                return (
                                    <div className="flex flex-col items-center">
                                        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Next Change</p>
                                        <p className={`text-3xl font-serif-display ${isOverdue ? 'text-brand-yellow animate-pulse' : 'text-white'}`}>
                                            {isOverdue ? 'Change Due!' : `${diffDays} Days`}
                                        </p>
                                        <p className="text-white/30 text-xs mt-1 mb-3">
                                            {nextChange.toLocaleTimeString([], {weekday: 'long', hour: '2-digit', minute:'2-digit'})}
                                        </p>
                                        {isOverdue && (
                                            <button 
                                                onClick={handleConfirmChange}
                                                className="mt-2 px-6 py-2 bg-brand-green text-brand-base font-bold rounded-xl shadow-lg hover:bg-white transition-colors animate-bounce"
                                            >
                                                Changed
                                            </button>
                                        )}
                                    </div>
                                )
                            })()}
                        </div>

                        <button 
                            onClick={handleStopJourney}
                            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white/40 hover:text-brand-red border border-white/5 hover:border-brand-red/30 rounded-xl transition-all text-sm font-medium relative z-10"
                        >
                            Finish Journey
                        </button>
                    </div>
                 )}
            </div>

            <div className="lg:col-span-12 bg-card border border-white/5 rounded-[2.5rem] p-8 shadow-xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-3 sm:gap-0">
                    <h3 className="font-serif-display text-xl text-white/90 flex items-center gap-3">
                        <History size={24} className="text-brand-green"/>
                        Today's Sessions
                    </h3>
                    <button 
                        onClick={() => {
                            const offset = selectedDate.getTimezoneOffset();
                            const localDate = new Date(selectedDate.getTime() - (offset*60*1000));
                            setManualDate(localDate.toISOString().split('T')[0]);
                            setShowManualEntryModal(true);
                        }}
                        className="w-full sm:w-auto text-sm bg-brand-base hover:bg-brand-base/80 text-white px-6 py-3 rounded-2xl border border-white/5 transition-colors flex items-center justify-center gap-2 active:scale-95 font-medium tracking-wide shadow-lg"
                    >
                        <Plus size={16} /> Add Log manually
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {todayLogs.length === 0 && (
                        <div className="col-span-full py-12 text-center text-white/30 italic">
                            {selectedDate.toDateString() === new Date().toDateString() 
                                ? "No sessions recorded yet today. Start your journey!" 
                                : `No activity recorded for ${selectedDate.toLocaleDateString(undefined, {weekday:'long', month:'short', day:'numeric'})}.`
                            }
                        </div>
                    )}
                    {(() => {
                        const items = [];
                        for (let i = 0; i < todayLogs.length; i++) {
                            const log = todayLogs[i];
                            items.push(
                                <div key={log.id} className="flex justify-between items-center p-6 bg-brand-base/50 hover:bg-brand-base rounded-3xl border border-white/5 transition-all group hover:scale-[1.02] cursor-default mb-4">
                                    <div className="flex flex-col">
                                        <span className="text-2xl font-serif-display text-white/90">
                                            {new Date(log.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                                        </span>
                                        <span className="text-xs text-white/40 mt-1 uppercase tracking-wider flex items-center gap-2">
                                             {log.end_time ? (
                                                 <>
                                                    to {new Date(log.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                 </>
                                             ) : <span className="text-brand-green font-bold animate-pulse">Running</span>}
                                        </span>
                                    </div>
                                    
                                    <div className="text-right flex flex-col items-end gap-2">
                                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase border inline-flex items-center gap-1.5 ${log.status === 'RUNNING' ? 'bg-brand-green/20 text-brand-green border-brand-green/30' : 'bg-white/5 text-white/30 border-white/10'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${log.status === 'RUNNING' ? 'bg-brand-green' : 'bg-white/30'}`}></div>
                                            {log.status === 'RUNNING' ? 'Active' : 'Wear Time'}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <p className="text-xs text-white/30 font-medium capitalize">{log.reason || 'Session'}</p>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteLog(log.id); }}
                                                className="p-1.5 rounded-lg text-white/20 hover:text-brand-red hover:bg-brand-red/10 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Delete Log"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );

                            if (log.end_time && i < todayLogs.length - 1) {
                                const nextLog = todayLogs[i+1];
                                const breakStart = new Date(log.end_time);
                                const breakEnd = new Date(nextLog.start_time);
                                const diffMinutes = Math.round((breakEnd.getTime() - breakStart.getTime()) / 60000);

                                if (diffMinutes > 0) {
                                    items.push(
                                        <div key={`break-${i}`} className="flex justify-between items-center px-8 py-3 bg-transparent border-l-2 border-dashed border-white/10 ml-8 my-2">
                                            <div className="flex flex-col">
                                                 <span className="text-sm font-medium text-white/50">{log.reason || 'Break'}</span>
                                                 <span className="text-xs text-brand-accent/70 mt-0.5 font-mono">
                                                     {breakStart.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {breakEnd.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                 </span>
                                            </div>
                                            <span className="text-xs font-bold text-brand-yellow/80 bg-brand-yellow/10 px-2 py-1 rounded-md border border-brand-yellow/10">
                                                {diffMinutes}m BREAK
                                            </span>
                                        </div>
                                    );
                                }
                            } else if (log.end_time && i === todayLogs.length - 1 && selectedDate.toDateString() === new Date().toDateString()) {
                                const breakStart = new Date(log.end_time);
                                const now = new Date();
                                const diffMinutes = Math.round((now.getTime() - breakStart.getTime()) / 60000);
                                if (diffMinutes > 1) {
                                     items.push(
                                        <div key={`break-now`} className="flex justify-between items-center px-8 py-3 bg-brand-accent/5 border border-brand-accent/20 rounded-2xl ml-4 my-2 animate-pulse">
                                            <div className="flex flex-col">
                                                 <span className="text-sm font-medium text-brand-accent">{log.reason || 'Current Break'}</span>
                                                 <span className="text-xs text-white/40 mt-0.5 font-mono">
                                                     {breakStart.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - Now
                                                 </span>
                                            </div>
                                            <span className="text-xs font-bold text-brand-accent bg-brand-accent/10 px-2 py-1 rounded-md">
                                                Active Break
                                            </span>
                                        </div>
                                    );
                                }
                            }
                        }
                        return items.length > 0 ? items : <p className="text-white/30 text-center py-8">No activity recorded for this da.</p>;
                    })()}
                </div>
            </div>
      </div>


      {showStartJourneyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all">
            <div className="bg-brand-base border border-white/10 w-full max-w-md p-8 rounded-[2rem] shadow-2xl animate-in fade-in zoom-in duration-300 backdrop-blur-xl">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-serif-display text-white">Start Journey</h3>
                    <button onClick={() => setShowStartJourneyModal(false)} className="text-white/60 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
                 </div>
                 <p className="text-white/60 text-sm mb-6">Enter the date and time you first put on your aligners. We'll remind you to change them every week at this time.</p>
                 
                 <div className="space-y-4">
                     <div>
                        <label className="block text-sm text-white/70 mb-2 ml-1">Date</label>
                        <input type="date" value={journeyModalDate} onChange={e => setJourneyModalDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-brand-green outline-none transition-colors" />
                     </div>
                     <div>
                        <label className="block text-sm text-white/70 mb-2 ml-1">Time</label>
                        <input type="time" value={journeyModalTime} onChange={e => setJourneyModalTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-brand-green outline-none transition-colors" />
                     </div>
                     <button onClick={handleStartJourney} className="w-full bg-brand-green hover:bg-brand-green/90 text-white font-serif-display text-lg py-4 rounded-2xl mt-4 transition-colors shadow-xl shadow-brand-green/20">
                        Start Tracking
                    </button>
                 </div>
            </div>
          </div>
      )}

      {showManualEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all">
            <div className="bg-brand-deep/90 border border-white/10 w-full max-w-md p-8 rounded-[2rem] shadow-2xl animate-in fade-in zoom-in duration-300 backdrop-blur-xl">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-serif-display text-white">Add Manual Log</h3>
                    <button onClick={() => setShowManualEntryModal(false)} className="text-white/60 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
                </div>
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm text-white/70 mb-2 ml-1">Date</label>
                        <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-brand-primary outline-none transition-colors" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm text-white/70 mb-2 ml-1">Start Time</label>
                            <input type="time" value={manualStartTime} onChange={e => setManualStartTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-brand-primary outline-none transition-colors" />
                        </div>
                         <div>
                            <label className="block text-sm text-white/70 mb-2 ml-1">End Time</label>
                            <input type="time" value={manualEndTime} onChange={e => setManualEndTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-brand-primary outline-none transition-colors" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-white/70 mb-2 ml-1">Reason (Optional)</label>
                        <input type="text" placeholder="e.g. Forgot to track" value={manualReason} onChange={e => setManualReason(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-brand-primary outline-none transition-colors placeholder-white/20" />
                    </div>
                    <button onClick={handleManualEntry} className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-serif-display text-lg py-4 rounded-2xl mt-4 transition-colors shadow-xl shadow-brand-primary/20">
                        Save Session
                    </button>
                </div>
            </div>
        </div>
      )}

      {showPauseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all">
          <div className="bg-brand-deep/90 border border-white/10 w-full max-w-sm p-8 rounded-[2rem] shadow-2xl animate-in fade-in zoom-in duration-300 backdrop-blur-xl">
            <h3 className="text-2xl font-serif-display mb-6 text-center text-white">Pause Timer</h3>
            <div className="grid grid-cols-1 gap-3 mb-8">
                {['Eating', 'Drinking', 'Brushing', 'Other'].map((r) => (
                    <button
                        key={r}
                        onClick={() => setPauseReason(r)}
                        className={`p-4 rounded-xl border text-left transition-all font-medium flex items-center justify-between group ${pauseReason === r ? 'bg-brand-accent/20 border-brand-accent/50 text-brand-accent shadow-inner' : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white'}`}
                    >
                        {r}
                        {pauseReason === r && <div className="w-2 h-2 rounded-full bg-brand-accent shadow-[0_0_10px_currentColor]"></div>}
                    </button>
                ))}
            </div>
            <div className="flex gap-3">
                 <button onClick={() => setShowPauseModal(false)} className="flex-1 py-4 text-white/60 hover:text-white transition-colors hover:bg-white/5 rounded-2xl font-medium">Cancel</button>
                 <button onClick={confirmPause} className="flex-1 py-4 bg-brand-accent hover:bg-brand-accent/90 text-white font-serif-display text-lg rounded-2xl transition-colors shadow-lg shadow-brand-accent/20">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all">
           <div className="bg-brand-base border border-white/10 w-full max-w-md p-8 rounded-[2rem] shadow-2xl animate-in fade-in zoom-in duration-300 backdrop-blur-xl">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-2xl font-serif-display text-white flex items-center gap-3"><Settings size={28} className="text-primary"/> Settings</h3>
                    <button onClick={() => setShowSettingsModal(false)} className="text-white/60 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
                </div>
                
                <div className="space-y-6">
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                        <h4 className="text-xs font-bold text-white/40 mb-5 uppercase tracking-widest ml-1">Security</h4>
                        <div className="space-y-4">
                             <input type="password" placeholder="Current Password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="w-full bg-brand-base/40 border border-white/10 rounded-2xl p-4 text-white text-sm focus:border-primary outline-none transition-colors placeholder-white/20" />
                             <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-brand-base/40 border border-white/10 rounded-2xl p-4 text-white text-sm focus:border-primary outline-none transition-colors placeholder-white/20" />
                             <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-brand-base/40 border border-white/10 rounded-2xl p-4 text-white text-sm focus:border-primary outline-none transition-colors placeholder-white/20" />
                        </div>
                        {passwordMessage.text && (
                            <div className={`mt-4 text-sm p-3 rounded-xl text-center font-medium ${passwordMessage.type === 'error' ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'}`}>
                                {passwordMessage.text}
                            </div>
                        )}
                        <button onClick={handleChangePassword} className="w-full bg-primary/80 hover:bg-primary text-white font-medium py-3 rounded-xl mt-6 text-sm transition-colors shadow-lg shadow-primary/20 tracking-wide">
                            Update Password
                        </button>
                    </div>
                </div>
           </div>
        </div>
      )}
    </div>
  );
}
