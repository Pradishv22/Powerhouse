import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  apiGetCurrentUser,
  apiLogin,
  apiRegister,
  apiLogout,
  apiUpdateProfile,
  apiChangePassword,
  type User,
} from "@/services/api";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, confirm: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  updateProfile: (name: string) => Promise<User>;
  changePassword: (curr: string, next: string, confirm: string) => Promise<{ message: string }>;
  isAuthenticated: boolean;
  isHousehold: boolean;
  isAnalyst: boolean;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const curr = await apiGetCurrentUser();
      setUser(curr);
      return curr;
    } catch {
      setUser(null);
      return null;
    }
  };

  // Check current session from backend on mount
  useEffect(() => {
    let mounted = true;
    apiGetCurrentUser()
      .then((currUser) => {
        if (mounted) {
          setUser(currUser);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const loggedIn = await apiLogin(email, password);
    setUser(loggedIn);
    return loggedIn;
  };

  const register = async (name: string, email: string, password: string, confirm: string) => {
    const registered = await apiRegister(name, email, password, confirm);
    setUser(registered);
    return registered;
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  const updateProfile = async (name: string) => {
    const updated = await apiUpdateProfile(name);
    setUser(updated);
    return updated;
  };

  const changePassword = async (curr: string, next: string, confirm: string) => {
    return apiChangePassword(curr, next, confirm);
  };

  const role = user?.role || "user";
  const isAdmin = role === "admin";
  const isAnalyst = role === "analyst";
  const isHousehold = role === "user" || role === "household";

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
        updateProfile,
        changePassword,
        isAuthenticated: !!user,
        isHousehold,
        isAnalyst,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
