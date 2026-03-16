// Theme initializer: applies `dark` class based on user preference or system setting
export function initTheme(): void {
  try {
    const root = document.documentElement;
    const stored = localStorage.getItem('theme'); // optional: 'light' | 'dark' | 'system' | null

    const apply = (isDark: boolean) => {
      if (isDark) root.classList.add('dark');
      else root.classList.remove('dark');
    };

    if (stored === 'dark') {
      apply(true);
      return;
    }

    if (stored === 'light') {
      apply(false);
      return;
    }

    // Default behavior: follow OS/browser preference
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mql.matches);

    const listener = (e: MediaQueryListEvent | MediaQueryList) => {
      // MediaQueryList may be passed (older browsers) or MediaQueryListEvent
      // @ts-ignore
      const matches = typeof (e as any).matches === 'boolean' ? (e as any).matches : mql.matches;
      apply(matches);
    };

    // Use modern API if available
    if (typeof mql.addEventListener === 'function') {
      // @ts-ignore
      mql.addEventListener('change', listener);
    } else if (typeof mql.addListener === 'function') {
      // @ts-ignore
      mql.addListener(listener);
    }
  } catch (e) {
    // Fail silently — theme is non-critical
  }
}

export function setThemePreference(pref: 'light' | 'dark' | 'system') {
  try {
    if (pref === 'system') {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', pref);
    }
    // Re-init to apply immediately
    initTheme();
  } catch (e) {
    // ignore
  }
}
