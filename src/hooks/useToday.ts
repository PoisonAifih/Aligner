import { useEffect, useState } from 'react';
import { startOfDay } from '../lib/time';

const CHECK_INTERVAL_MS = 15_000;

export function useToday(): Date {
  const [today, setToday] = useState(() => startOfDay(new Date()));

  useEffect(() => {
    const check = () => {
      const current = startOfDay(new Date());
      setToday((previous) => (previous.getTime() === current.getTime() ? previous : current));
    };

    const interval = setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    check();

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  return today;
}
