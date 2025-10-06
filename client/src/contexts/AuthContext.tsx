import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Employee } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useLocation } from 'wouter';

interface AuthContextType {
  currentUser: Employee | null;
  userRole: 'admin' | 'crew' | null;
  isAdmin: boolean;
  isCrew: boolean;
  isAuthenticated: boolean;
  login: (credentials: { employeeId?: string; email?: string; password?: string }) => Promise<any>;
  loginPending: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<Employee | null>(null);
  const [, setLocation] = useLocation();

  const { data: meResponse } = useQuery<{ success: boolean; data: Employee | null }>({
    queryKey: ['/api/auth/me'],
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { employeeId?: string; email?: string; password?: string }) => {
      const res = await apiRequest('POST', '/api/auth/login', credentials);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && data.data) {
        console.log('Login Success - User Data:', data.data);
        console.log('Login Success - Role:', data.data.role, typeof data.data.role);
        setCurrentUserState(data.data);
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/auth/logout');
      return res.json();
    },
    onSuccess: () => {
      // Clear all user state
      setCurrentUserState(null);
      
      // Clear ALL query cache to prevent stale data
      queryClient.clear();
      
      // Clear any localStorage items that might cache user data
      try {
        // Keep only essential items like lastViewedJobId, remove any auth-related data
        const essentialKeys = ['lastViewedJobId'];
        const itemsToKeep: Record<string, string> = {};
        
        essentialKeys.forEach(key => {
          const value = localStorage.getItem(key);
          if (value) itemsToKeep[key] = value;
        });
        
        localStorage.clear();
        
        // Restore essential items
        Object.entries(itemsToKeep).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
      } catch (e) {
        console.error('Error clearing localStorage:', e);
      }
      
      // Redirect all users to login page after logout
      setLocation('/login');
    },
  });

  const login = async (credentials: { employeeId?: string; email?: string; password?: string }) => {
    return loginMutation.mutateAsync(credentials);
  };

  const logout = () => {
    logoutMutation.mutate();
  };

  useEffect(() => {
    if (meResponse?.data && !currentUser) {
      setCurrentUserState(meResponse.data);
    }
  }, [meResponse, currentUser]);

  const isAuthenticated = !!currentUser;
  const userRole = currentUser?.role as 'admin' | 'crew' | null;
  
  // No dev mode backdoor - must be logged in with admin role
  const isAdmin = userRole === 'admin';
  const isCrew = userRole === 'crew';
  
  // Debug RBAC
  if (isAuthenticated) {
    console.log('RBAC Debug:', { 
      currentUser: currentUser?.firstName + ' ' + currentUser?.lastName, 
      userRole, 
      isAdmin, 
      isCrew, 
      isAuthenticated 
    });
  }
  
  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userRole,
        isAdmin,
        isCrew,
        isAuthenticated,
        login,
        loginPending: loginMutation.isPending,
        logout,
      }}
    >
      <div className="flex flex-col min-h-screen">
        <div className="flex-1">
          {children}
        </div>
      </div>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
