// app/profile/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  name?: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load current user
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/user/me', {
          cache: 'no-store',
          credentials: 'include',
        });

        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        if (!res.ok) throw new Error('Failed to load user');

        const data: User = await res.json();
        if (!cancelled) setUser(data);
      } catch {
        router.replace('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const onLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } finally {
      router.replace('/login');
    }
  };

  if (loading) {
    return (
      <section>
        <div className="custom-screen pt-10 text-gray-800">
          <p>Loading profile…</p>
        </div>
      </section>
    );
  }

  if (!user) return null;

  const displayName =
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    'User';
  const firstInitial = displayName?.[0]?.toUpperCase() ?? '?';

  return (
    <section>
      <div className="custom-screen pt-10 text-gray-800">
        <div className="max-w-3xl">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full border flex items-center justify-center text-2xl font-bold">
              {firstInitial}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold leading-tight">
                {displayName}
              </h1>
              <p className="text-sm text-gray-600">{user.email}</p>
              {user.phone ? (
                <p className="text-sm text-gray-600">{user.phone}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-8 border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Profile Details</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">User ID</p>
                <p className="font-medium break-all">{user.id}</p>
              </div>
              <div>
                <p className="text-gray-500">Email</p>
                <p className="font-medium break-all">{user.email}</p>
              </div>
              <div>
                <p className="text-gray-500">First Name</p>
                <p className="font-medium">{user.firstName ?? '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Last Name</p>
                <p className="font-medium">{user.lastName ?? '-'}</p>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="mt-6 px-4 py-2 rounded-lg border hover:bg-gray-50 text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
