import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Link2, LogOut, User, UserPlus, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { ROLE_LABELS } from '../lib/roles';

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, role, signOut } = useAuth();

  const navItems: NavItem[] = [];

  if (role === 'user') {
    navItems.push({ icon: LayoutDashboard, label: 'Timer', path: '/aligner/timer' });
  }

  if (role === 'dentist') {
    navItems.push({ icon: Users, label: 'Monitor Patients', path: '/aligner/dentist' });
  }

  if (role === 'admin') {
    navItems.push({ icon: Users, label: 'Manage Users', path: '/aligner/admin/users' });
    navItems.push({ icon: Link2, label: 'Assignments', path: '/aligner/admin/assign' });
    navItems.push({ icon: UserPlus, label: 'Register User', path: '/aligner/admin/create-user' });
  }

  navItems.push({ icon: User, label: 'Edit Profile', path: '/aligner/profile' });

  const handleLogout = async () => {
    await signOut();
    navigate('/aligner');
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <aside className="w-64 bg-card border-r border-border h-screen flex flex-col fixed left-0 top-0 shadow-2xl z-50">
      <div className="p-8 pb-4">
        <div className="bg-brand-base flex items-center gap-4 p-4 rounded-2xl border border-white/5 shadow-inner mb-6">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-xl font-serif-display text-white shadow-lg">
            {(profile?.username?.[0] || user?.email?.[0] || 'U').toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <h3 className="font-serif-display text-white truncate text-lg">
              {profile?.username || user?.email?.split('@')[0] || 'User'}
            </h3>
            <p className="text-xs text-white/50 truncate">{ROLE_LABELS[role]}</p>
          </div>
        </div>
      </div>

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
            <item.icon
              size={22}
              className={isActive(item.path) ? 'text-primary' : 'text-white/40 group-hover:text-white/80'}
            />
            <span className="font-medium tracking-wide">{item.label}</span>
          </button>
        ))}
      </nav>

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
