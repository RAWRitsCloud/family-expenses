import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/auth';

export const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-600">Checking permissions...</p>
      </div>
    );
  }

  // If not logged in, go to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If logged in, but lacks the "family" role, block access or show unauthorized
  if (!user.roles.includes('family')) {
    return <Navigate to="/access-denied" replace />;
  }

  return <Outlet />;
};