export type AppRole = 'user' | 'dentist' | 'admin';

export const ROLE_LABELS: Record<AppRole, string> = {
  user: 'Patient',
  dentist: 'Dentist',
  admin: 'Administrator',
};

export const ROLE_BADGE_CLASSES: Record<AppRole, string> = {
  user: 'bg-brand-green/15 text-brand-green border-brand-green/30',
  dentist: 'bg-brand-yellow/15 text-brand-yellow border-brand-yellow/30',
  admin: 'bg-white/10 text-white/80 border-white/20',
};

export const normaliseRole = (value?: string | null): AppRole =>
  value === 'dentist' || value === 'admin' ? value : 'user';

export const homePathForRole = (role: AppRole): string => {
  switch (role) {
    case 'admin':
      return '/aligner/admin/users';
    case 'dentist':
      return '/aligner/dentist';
    default:
      return '/aligner/timer';
  }
};
