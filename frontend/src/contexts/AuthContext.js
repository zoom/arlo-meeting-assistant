import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [wsToken, setWsToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setIsAuthenticated(true);
        return data.user;
      }
    } catch {
      // Not authenticated
    }
    setIsAuthenticated(false);
    setUser(null);
    return null;
  }, []);

  // Restore session from cookie on mount
  useEffect(() => {
    checkAuth().finally(() => setIsLoading(false));
  }, [checkAuth]);

  const login = useCallback((userData, token) => {
    setUser(userData);
    setIsAuthenticated(true);
    if (token) setWsToken(token);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    setWsToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, wsToken, isLoading, checkAuth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
