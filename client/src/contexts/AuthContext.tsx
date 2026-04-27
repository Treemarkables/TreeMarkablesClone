import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
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
  isLoading: boolean;
  login: (credentials: { employeeId?: string; email?: string; password?: string }) => Promise<any>;
  loginPending: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Dev mode auto-login - automatically log in as admin when running locally
const DEV_AUTO_LOGIN = import.meta.env.DEV; // Only true in development mode
const DEV_ADMIN_ID = 'admin-test-001';

const STORAGE_KEY = 'treemarkables_user';

function loadStoredUser(): Employee | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Employee) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const storedUser = loadStoredUser();
  const [currentUser, setCurrentUserState] = useState<Employee | null>(storedUser);
  // If we already have a cached user, skip the loading gate so the app shows immediately
  const [initialAuthCheckComplete, setInitialAuthCheckComplete] = useState(!!storedUser);
  const [devAutoLoginAttempted, setDevAutoLoginAttempted] = useState(false);
  const [, setLocation] = useLocation();
  const consecutive401sRef = useRef<number>(0);

  const setCurrentUser = (user: Employee | null) => {
    setCurrentUserState(user);
    if (user) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(user)); } catch {}
    } else {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  };

  const { data: meResponse, isError: authQueryError } = useQuery<{ success: boolean; data: Employee | null }>({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      // Custom query function that handles 401 gracefully
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      
      // If not authenticated, return null instead of throwing
      if (res.status === 401) {
        return { success: false, data: null };
      }
      
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      
      return await res.json();
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 5 * 60 * 1000,   // treat auth as fresh for 5 min — no background churn
    gcTime: 10 * 60 * 1000,      // keep in cache 10 min so re-navigation is instant
    refetchInterval: false,
    refetchOnMount: true,         // only refetch if stale (not 'always')
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,    // don't thrash the 401 counter on overnight sleep/wake cycles
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { employeeId?: string; email?: string; password?: string }) => {
      // CRITICAL: Cancel any in-flight /api/auth/me requests before login
      // This prevents stale unauthenticated responses from overwriting the new session
      await queryClient.cancelQueries({ queryKey: ['/api/auth/me'] });
      
      const res = await apiRequest('POST', '/api/auth/login', credentials);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && data.data) {
        console.log('Login Success - User Data:', data.data);
        console.log('Login Success - Role:', data.data.role, typeof data.data.role);
        setCurrentUser(data.data);
        // Set the query data directly instead of invalidating to prevent race condition
        queryClient.setQueryData(['/api/auth/me'], { success: true, data: data.data });
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
      setCurrentUser(null);
      
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

  // Track last successful login to prevent race condition logout
  const lastLoginTimeRef = useRef<number>(0);

  const login = async (credentials: { employeeId?: string; email?: string; password?: string }) => {
    const result = await loginMutation.mutateAsync(credentials);
    lastLoginTimeRef.current = Date.now();
    return result;
  };

  const logout = () => {
    logoutMutation.mutate();
  };

  // Dev mode auto-login: automatically log in as admin when not authenticated
  useEffect(() => {
    if (DEV_AUTO_LOGIN && !devAutoLoginAttempted && initialAuthCheckComplete && !currentUser && !loginMutation.isPending) {
      console.log('🔧 Dev mode: Auto-logging in as admin...');
      setDevAutoLoginAttempted(true);
      login({ employeeId: DEV_ADMIN_ID }).catch((err) => {
        console.error('Dev auto-login failed:', err);
      });
    }
  }, [DEV_AUTO_LOGIN, devAutoLoginAttempted, initialAuthCheckComplete, currentUser, loginMutation.isPending]);

  // Bookkeeping-only effect: mark the initial auth check complete once the
  // query has produced a result (success, 401, or network error). Kept
  // separate so its deps don't retrigger the auth-reactor effect below.
  useEffect(() => {
    if ((meResponse !== undefined || authQueryError) && !initialAuthCheckComplete) {
      if (authQueryError) {
        console.error('[Auth] Auth query failed with network error — treating as unauthenticated');
      }
      setInitialAuthCheckComplete(true);
    }
  }, [meResponse, authQueryError, initialAuthCheckComplete]);

  // Read currentUser via a ref inside the reactor effect so we don't need it
  // as a dep — otherwise setting currentUser from inside the effect would
  // retrigger the effect and re-increment the 401 counter on the same response.
  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // Auth reactor: depends ONLY on meResponse so it runs exactly once per new
  // /api/auth/me response. Previous version also depended on isFetching /
  // currentUser / initialAuthCheckComplete, which caused the 401 counter to
  // tick up on unrelated re-renders (e.g. background refetches on network
  // reconnect), producing overnight-logout and log-in-twice symptoms.
  useEffect(() => {
    if (meResponse === undefined) return;
    const user = currentUserRef.current;

    if (meResponse.success === false) {
      // Don't clear user state if they just logged in (within last 10 seconds)
      // to tolerate a stale 401 arriving after a successful login.
      const timeSinceLogin = Date.now() - lastLoginTimeRef.current;
      if (timeSinceLogin < 10000) {
        console.log('🛡️ Ignoring 401 response - user just logged in', timeSinceLogin + 'ms ago');
        consecutive401sRef.current = 0;
        return;
      }

      consecutive401sRef.current += 1;

      if (user) {
        if (consecutive401sRef.current >= 3) {
          console.warn('⚠️ Multiple consecutive 401s detected - session expired');
          // Clear state but NOT localStorage — preserve stored user so next login is instant
          setCurrentUserState(null);
          consecutive401sRef.current = 0;
        } else {
          console.log(`🔄 Transient 401 detected (${consecutive401sRef.current}/3) - not logging out yet`);
        }
      }
    } else if (meResponse.success === true && meResponse.data) {
      consecutive401sRef.current = 0;
      if (!user || user.id !== meResponse.data.id) {
        console.log('✅ Setting authenticated user:', meResponse.data.role);
        setCurrentUser(meResponse.data);
      }
    }
  }, [meResponse]);

  const isAuthenticated = !!currentUser;
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
        isAuthenticated,
        isLoading: !initialAuthCheckComplete,
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
