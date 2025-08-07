// app/components/AuthGuard.tsx
'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = { children: ReactNode };

export default function AuthGuard({ children }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading) {
    return (
      <>
        <div className="flex items-center justify-center h-screen">
          <div
            className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"
            role="status"
            aria-label="Loading"
          />
        </div>
      </>
    );
  }

  return <>{children}</>;
}
