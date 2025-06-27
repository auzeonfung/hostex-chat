'use client';
import '@/styles/globals.css';
import { ReactNode, useEffect } from 'react';

function applyTheme(theme: string) {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (theme === 'dark' || (theme === 'system' && systemDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    const theme = settings.theme || 'system';
    applyTheme(theme);
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, []);
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
        {children}
      </body>
    </html>
  );
}
