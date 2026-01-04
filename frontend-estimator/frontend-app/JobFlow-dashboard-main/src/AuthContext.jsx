// ============================================================================
// AuthContext – Correctly Maps company_id → companyId
// Version: v3.4 – Added name, phone, and meta fields to normalizeUser
// ============================================================================

import { createContext, useContext, useState, useEffect } from "react";
import { AuthAPI } from "./api";

const AuthContext = createContext();
export { AuthContext };

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

// Normalize backend user → frontend shape
const normalizeUser = (u) => {
  if (!u) return null;

  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    isActive: u.is_active ?? true,

    // Company fields (critical)
    companyId: u.company_id ?? u.companyId ?? null,
    companyName: u.company_name ?? u.companyName ?? null,
    ghlLocationId: u.ghl_location_id ?? null,
    
    // Meta fields
    created_at: u.created_at,
    updated_at: u.updated_at,
    last_login: u.last_login,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // ------------------------------------------------------------
  // NORMAL AUTH FLOW - Load user from token
  // ------------------------------------------------------------
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    const loadUser = async () => {
      try {
        const me = await AuthAPI.me();
        const normalized = normalizeUser(me.user);
        setUser(normalized);
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem("authToken");
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  // ------------------------------------------------------------
  // Login
  // ------------------------------------------------------------
  const login = async (email, password) => {
    try {
      setError(null);
      setIsLoading(true);

      const res = await AuthAPI.login(email, password);

      localStorage.setItem("authToken", res.token);

      const normalized = normalizeUser(res.user);
      setUser(normalized);
      setIsAuthenticated(true);

      return { success: true };
    } catch (err) {
      const message = err.message || "Login failed";
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------
  // Logout
  // ------------------------------------------------------------
  const logout = () => {
    localStorage.removeItem("authToken");
    setUser(null);
    setIsAuthenticated(false);
  };

  // Helper: is this user the master account?
  const isMaster = () => {
    return user?.role === "master";
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    isMaster,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};