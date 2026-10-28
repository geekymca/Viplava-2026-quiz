'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Quiz App Error Boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0b0713] text-[#fef9ee] flex flex-col items-center justify-center p-6 text-center">
      <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 max-w-md w-full mb-6 text-center">
        <h1 className="text-3xl font-bold font-serif text-rose-400 mb-2">Something went wrong</h1>
        <p className="text-xs text-rose-200/80 mb-4 font-mono break-words">
          {error.message || 'An unexpected rendering error occurred'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-all cursor-pointer"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all"
          >
            Reload Arena
          </Link>
        </div>
      </div>
    </div>
  );
}
