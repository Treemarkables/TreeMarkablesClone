import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Employee } from '@shared/schema';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, LogOut } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';

interface AuthContextType {
  currentUser: Employee | null;
  userRole: 'admin' | 'crew' | null;
  isAdmin: boolean;
  isCrew: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<Employee | null>(null);

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
      setCurrentUserState(null);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const logout = () => {
    logoutMutation.mutate();
  };

  useEffect(() => {
    if (meResponse?.data && !currentUser) {
      setCurrentUserState(meResponse.data);
    }
  }, [meResponse, currentUser]);

  const userRole = currentUser?.role as 'admin' | 'crew' | null;
  const isAdmin = userRole === 'admin';
  const isCrew = userRole === 'crew';
  const isDev = import.meta.env.DEV;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userRole,
        isAdmin,
        isCrew,
        logout,
      }}
    >
      <div className="flex flex-col h-screen">
        {isDev && (
          <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between">
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
                <span className="px-2 py-0.5 bg-white/20 rounded text-xs" data-testid="text-user-role">
                  {currentUser.role.toUpperCase()}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={logout}
                  className="ml-2 h-7 bg-white/10 hover:bg-white/20 text-white"
                  data-testid="button-logout"
                >
                  <LogOut className="w-3 h-3 mr-1" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        )}
        <div className="flex-1 overflow-hidden">
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
