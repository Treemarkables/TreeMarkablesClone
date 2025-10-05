import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Employee } from '@shared/schema';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, LogOut } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
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

  const { data: employeesResponse } = useQuery<{ success: boolean; data: Employee[] }>({
    queryKey: ['/api/employees/active'],
  });
  
  const employees = employeesResponse?.data || [];

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
      const wasCrewUser = currentUser?.role === 'crew';
      setCurrentUserState(null);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      // Crew users go to login page, others go to home
      setLocation(wasCrewUser ? '/login' : '/');
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

  const isDev = import.meta.env.DEV;
  const isAuthenticated = !!currentUser;
  const userRole = currentUser?.role as 'admin' | 'crew' | null;
  
  // In dev mode with no authenticated user, grant admin access
  const isAdmin = isDev && !isAuthenticated ? true : userRole === 'admin';
  const isCrew = userRole === 'crew';
  
  // Debug RBAC
  if (isDev && isAuthenticated) {
    console.log('RBAC Debug:', { 
      currentUser: currentUser?.firstName + ' ' + currentUser?.lastName, 
      userRole, 
      isAdmin, 
      isCrew, 
      isAuthenticated 
    });
  }
  
  const [location] = useLocation();

  // Extract just the pathname without query params or hash
  const pathname = location.split('?')[0].split('#')[0];

  // List of public pages where dev banner should NOT show
  const publicPages = [
    '/',
    '/login',
    '/home',
    '/tree-removal',
    '/tree-pruning',
    '/stump-grinding',
    '/hedge-trimming',
    '/blog',
    '/summer-offer',
    '/customer-portal',
  ];
  
  // Check if current page is public or a viewer page (proposal, quote, invoice)
  const isPublicPage = publicPages.includes(pathname) || 
                      pathname.startsWith('/blog/') ||
                      pathname.startsWith('/proposal/') ||
                      pathname.startsWith('/quote/') ||
                      pathname.startsWith('/invoice/');
  
  // Only show dev banner in dev mode AND on internal dashboard pages
  const showDevBanner = isDev && !isPublicPage;
  
  // Debug logging
  if (isDev) {
    console.log('Auth Debug:', { location, pathname, isPublicPage, showDevBanner });
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
        {showDevBanner && (
          <div className="bg-white text-gray-800 px-4 py-2 flex items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="text-sm font-medium">Dev Mode - Login As:</span>
            </div>
            <Select
              value={currentUser?.id || ''}
              onValueChange={(value) => {
                loginMutation.mutate({ employeeId: value });
              }}
            >
              <SelectTrigger 
                className="w-64 bg-white text-black" 
                data-testid="select-employee-auth"
              >
                <SelectValue placeholder="Select employee..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem 
                    key={employee.id} 
                    value={employee.id}
                    data-testid={`select-employee-${employee.id}`}
                  >
                    {employee.firstName} {employee.lastName} ({employee.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentUser && (
              <div className="flex items-center gap-2 text-sm">
                <span>Logged in as:</span>
                <span className="font-semibold" data-testid="text-current-user">
                  {currentUser.firstName} {currentUser.lastName}
                </span>
                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs" data-testid="text-user-role">
                  {currentUser.role.toUpperCase()}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={logout}
                  className="ml-2 h-7"
                  data-testid="button-logout"
                >
                  <LogOut className="w-3 h-3 mr-1" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        )}
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
