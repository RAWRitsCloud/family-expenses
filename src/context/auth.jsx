import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserInfo() {
      try {
        const response = await fetch('/.auth/me');
        const data = await response.json();
        
        if (data.clientPrincipal) {
          setUser({
            ...data.clientPrincipal,
            roles: data.clientPrincipal.userRoles || []
          });
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUserInfo();
  }, []);

  const login = (provider = 'github') => {
    window.location.href = `/.auth/login/${provider}`;
  };

  const logout = () => {
    window.location.href = '/.auth/logout';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);