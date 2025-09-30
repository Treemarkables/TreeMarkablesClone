import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Employee } from '@shared/schema';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User } from 'lucide-react';

interface AuthContextType {
  currentUser: Employee | null;
  userRole: 'admin' | 'crew' | null;
  isAdmin: boolean;
  isCrew: boolean;
  setCurrentUser: (user: Employee | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'auth_current_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<Employee | null>(null);

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['/api/employees/active'],
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const user = JSON.parse(stored);
        setCurrentUserState(user);
      } catch (e) {
        console.error('Failed to parse stored user:', e);
      }
    }
  }, []);

  const setCurrentUser = (user: Employee | null) => {
    setCurrentUserState(user);
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const userRole = currentUser?.role as 'admin' | 'crew' | null;
  const isAdmin = userRole === 'admin';
  const isCrew = userRole === 'crew';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userRole,
        isAdmin,
        isCrew,
        setCurrentUser,
      }}
    >
      <div className="flex flex-col h-screen">
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span className="text-sm font-medium">Dev Mode - Login As:</span>
          </div>
          <Select
            value={currentUser?.id || ''}
            onValueChange={(value) => {
              const employee = employees.find((e) => e.id === value);
              setCurrentUser(employee || null);
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
            </div>
          )}
        </div>
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
