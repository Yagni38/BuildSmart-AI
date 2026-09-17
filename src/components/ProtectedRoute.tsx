import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  fallback?: React.ReactNode;
}

/**
 * ProtectedRoute — gates access to views based on authentication and role.
 *
 * - If still loading the session, shows a loading state.
 * - If unauthenticated, shows the fallback (default: login page).
 * - If authenticated but role not allowed, shows the fallback.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  fallback,
}) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warmbeige-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-terracotta/20 border-t-terracotta animate-spin" />
          <p className="text-sm font-semibold text-neutral-500">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <>{fallback}</>;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};