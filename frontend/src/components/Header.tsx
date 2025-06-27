'use client';
import Link from 'next/link';

export default function Header({ backHref }: { backHref?: string }) {
  return (
    <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur p-4 flex justify-between items-center sticky top-0 z-10">
      <div className="flex items-center space-x-4">
        {backHref && (
          <Link href={backHref} className="text-blue-600 hover:underline">
            Back
          </Link>
        )}
        <h1 className="text-xl font-bold">Hostex Chat</h1>
      </div>
      <Link href="/settings" className="text-blue-600 hover:underline">
        Settings
      </Link>
    </header>
  );
}
