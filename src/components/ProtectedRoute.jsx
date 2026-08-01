import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { isDemoMode } from '../config/appMode';
import LoadingSpinner from './LoadingSpinner';

export const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  // Public demo deployment: everything is open, no sign-in required.
  if (isDemoMode()) {
    return <Outlet />;
  }

  if (loading) {
    return <LoadingSpinner fullScreen />;
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