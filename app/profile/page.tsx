// app/profile/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, Settings, LogOut, Edit } from 'lucide-react';

type UserProfile = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  name?: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
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

        const data: UserProfile = await res.json();
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
      <div className="custom-screen py-8">
        <div className="card">
          <div className="card-body text-center py-12">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const displayName =
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    'User';
  const firstInitial = displayName?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="custom-screen py-8">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">
            Manage your account settings and personal information
          </p>
        </div>
        <button
          onClick={() => {/* TODO: Add edit functionality */}}
          className="btn-secondary"
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit Profile
        </button>
      </div>

      {/* Profile Card */}
      <div className="card">
        <div className="card-body">
          {/* Profile Header */}
          <div className="flex items-center gap-6 mb-8">
            <div className="h-20 w-20 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg">
              {firstInitial}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {displayName}
              </h2>
              <div className="flex items-center gap-4 text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>{user.email}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>{user.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Profile Details</h3>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500">User ID</label>
                <p className="text-gray-900 font-mono text-sm bg-white px-3 py-2 rounded-lg border">
                  {user.id}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500">Email Address</label>
                <p className="text-gray-900 bg-white px-3 py-2 rounded-lg border">
                  {user.email}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500">First Name</label>
                <p className="text-gray-900 bg-white px-3 py-2 rounded-lg border">
                  {user.firstName || '-'}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500">Last Name</label>
                <p className="text-gray-900 bg-white px-3 py-2 rounded-lg border">
                  {user.lastName || '-'}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500">Phone Number</label>
                <p className="text-gray-900 bg-white px-3 py-2 rounded-lg border">
                  {user.phone || 'Not provided'}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500">Account Status</label>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-6 border-t border-gray-200">
            <button
              onClick={() => {/* TODO: Add settings functionality */}}
              className="btn-secondary"
            >
              <Settings className="w-4 h-4 mr-2" />
              Account Settings
            </button>
            <button
              onClick={onLogout}
              className="btn-danger"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
