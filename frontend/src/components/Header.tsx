'use client';
import Link from 'next/link';
import { Button } from './ui/button';
import { Settings, ArrowLeft } from 'lucide-react';

export default function Header({ backHref }: { backHref?: string }) {
  return (
    <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur p-2 flex justify-between items-center sticky top-0 z-10">
      <div className="flex items-center space-x-2">
        {backHref && (
          <Button asChild variant="ghost" size="icon">
            <Link href={backHref} aria-label="Back">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
        )}
        <h1 className="text-xl font-bold">Hostex Chat</h1>
      </div>
      <Button asChild variant="ghost" size="icon" aria-label="Settings">
        <Link href="/settings">
          <Settings className="w-5 h-5" />
        </Link>
      </Button>
    </header>
  );
}
