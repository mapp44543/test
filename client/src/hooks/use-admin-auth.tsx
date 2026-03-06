import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Admin {
  id: string;
  username: string;
  role?: 'admin' | 'hr';
}

export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already authenticated on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("/api/admin/me", {
        credentials: "include",
      });
      if (response.ok) {
        const body = await response.json();
        // server responds { admin: null } for unauthenticated users
        if (body && body.admin) {
          setAdmin(body.admin as Admin);
          setIsAuthenticated(true);
        } else {
          setAdmin(null);
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
        setAdmin(null);
      }
    } catch (error) {
      setIsAuthenticated(false);
      setAdmin(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const response = await apiRequest("POST", "/api/admin/login", { username, password });
      return response.json();
    },
    onSuccess: (data) => {
      setAdmin(data.admin);
      setIsAuthenticated(true);
    },
    onError: (error) => {
      setIsAuthenticated(false);
      setAdmin(null);
      throw error;
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/logout");
    },
    onSuccess: () => {
      setIsAuthenticated(false);
      setAdmin(null);
    },
  });

  const login = async (username: string, password: string) => {
    return loginMutation.mutateAsync({ username, password });
  };

  const logout = async () => {
    return logoutMutation.mutateAsync();
  };

  return {
    isAuthenticated,
    admin,
    isLoading,
    login,
    logout,
    isLoginPending: loginMutation.isPending,
    isLogoutPending: logoutMutation.isPending,
    isHr: admin?.role === 'hr',
    isAdmin: !admin?.role || admin?.role === 'admin',
  };
}
