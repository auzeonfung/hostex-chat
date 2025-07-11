'use client';
import '@/styles/globals.css';
import { ReactNode, useEffect, useState } from 'react';
import { useTheme, type Theme } from '@/lib/useTheme';

export default function RootLayout({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    const settings = JSON.parse(localStorage.getItem('settings') || '{}')
    setTheme(settings.theme || 'system')
  }, [])

  useTheme(theme)

  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col h-full">
        <Toaster />
        {children}
      </body>
    </html>
  );
}
