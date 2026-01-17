

export const CookieStorage = {
  getItem: (key: string): string | null => {
    const name = `${key}=`;
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) === 0) {
            return c.substring(name.length, c.length);
        }
    }
    return null;
  },
  setItem: (key: string, value: string) => {
    // Default to 1 year expiry for persisted sessions, or let Supabase handle expiry if it passes options? 
    // Supabase client doesn't pass options to setItem in the Storage interface usually.
    // We'll set a reasonable default.
    const d = new Date();
    d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000));
    const expires = `expires=${d.toUTCString()}`;
    // Use Lax for security, path / for global access
    document.cookie = `${key}=${value};${expires};path=/;SameSite=Lax;Secure`; 
  },
  removeItem: (key: string) => {
    document.cookie = `${key}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax;Secure`;
  }
};
