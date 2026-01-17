import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, User, UserPlus } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
        fetchUser();
    }, []);

    const fetchUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUser(user);
            try {
                const profileData = await supabaseService.getProfile(user.id);
                setProfile(profileData);
            } catch (e) {
                console.error(e);
            }
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/aligner');
    };

    const navItems = [];

    // Role-based Navigation
    if (profile?.role === 'user' || (!profile?.role && user)) {
        // Patient views
        navItems.push({ icon: LayoutDashboard, label: 'Timer', path: '/aligner/timer' });
        navItems.push({ icon: User, label: 'Edit Profile', path: '/aligner/profile' });
    }

    if (profile?.role === 'dentist') {
        // Dentist views
        navItems.push({ icon: Users, label: 'Monitor Patients', path: '/aligner/dentist' });
        navItems.push({ icon: User, label: 'Edit Profile', path: '/aligner/profile' });
    }
    
    // Check for admin (based on email for now as per previous logic, or role if you add 'admin' role)
    // The previous code had a temporary check: user?.email?.includes('admin') || true
    // I will try to be more specific if possible, but keeping the "true" for demo if that was the intent.
    // However, the user said "Admin bas register user...", implying a distinct role.
    // I'll stick to the existing loose check for "admin" privileges or if the role explicitly says so.
    // AND I will prevent duplication if someone is both (though usually they are unique).
    
    // For this implementation, I will treat them as mutually exclusive blocks if possible, 
    // or just append Admin items if the user is an admin.
    const isAdmin = user?.email?.includes('admin') || profile?.role === 'admin';
    
    if (isAdmin) {
         navItems.push({ icon: UserPlus, label: 'Register User', path: '/aligner/admin/create-user' });
         navItems.push({ icon: Users, label: 'Manage Users', path: '/aligner/admin/assign' });
    }

    const isActive = (path: string) => location.pathname === path;

    return (
        <aside className="w-64 bg-card border-r border-border h-screen flex flex-col fixed left-0 top-0 shadow-2xl z-50">
            {/* Profile Section - Top Left */}
            <div className="p-8 pb-4">
                <div className="bg-brand-base flex items-center gap-4 p-4 rounded-2xl border border-white/5 shadow-inner mb-6">
                    <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-xl font-serif-display text-white shadow-lg">
                        {profile?.username?.[0].toUpperCase() || user?.email?.[0].toUpperCase() || 'U'}
                    </div>
                    <div className="overflow-hidden">
                        <h3 className="font-serif-display text-white truncate text-lg">
                            {profile?.username || 'User'}
                        </h3>
                        <p className="text-xs text-white/50 truncate capitalize">
                            {isAdmin ? 'Administrator' : (profile?.role || 'Patient')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-200 group ${
                            isActive(item.path) 
                                ? 'bg-brand-base text-primary shadow-lg border border-primary/10' 
                                : 'text-white/60 hover:text-white hover:bg-brand-base/50'
                        }`}
                    >
                        <item.icon size={22} className={`${isActive(item.path) ? 'text-primary' : 'text-white/40 group-hover:text-white/80'}`}/>
                        <span className="font-medium tracking-wide">{item.label}</span>
                    </button>
                ))}
            </nav>

            {/* Logout - Bottom Left */}
            <div className="p-6 mt-auto">
                 <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-4 px-6 py-4 rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
                >
                    <LogOut size={22} />
                    <span className="font-medium tracking-wide">Log out</span>
                </button>
            </div>
        </aside>
    );
}
