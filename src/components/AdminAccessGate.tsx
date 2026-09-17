/**
 * Phase 15 — Admin Access Gate.
 *
 * Only ADMIN users can access the admin dashboard.
 * CUSTOMER and CONTRACTOR users are blocked with a clear message.
 */
import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface AdminAccessGateProps {
  isAdmin: boolean;
  children: React.ReactNode;
}

export const AdminAccessGate: React.FC<AdminAccessGateProps> = ({ isAdmin, children }) => {
  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="bg-white border border-red-200 rounded-3xl p-10 shadow-premium text-center max-w-lg">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-neutral-900 mb-2">Access Restricted</h2>
          <p className="text-sm text-neutral-500 leading-relaxed">
            This area is reserved for administrators only. If you believe you should have access, please contact support.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};