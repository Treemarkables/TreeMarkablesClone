import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

import { useAuth, type AuthUser } from '@/contexts/AuthContext';
import { peekNotificationNav } from '@/lib/notificationNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { apiRequest } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';

type LoginStep = 'password' | 'totp' | 'enroll' | 'recovery';

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, loginPending, isAuthenticated, completeMfa, mfaPending, adoptSession } = useAuth();
  const [error, setError] = useState('');
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const [step, setStep] = useState<LoginStep>('password');
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [enrollSecret, setEnrollSecret] = useState('');
  const [enrollUri, setEnrollUri] = useState('');
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (justLoggedIn && isAuthenticated) {
      const pending = peekNotificationNav();
      setLocation(pending || '/dispatch');
    }
  }, [justLoggedIn, isAuthenticated, setLocation]);

  const finishWithUser = (user: AuthUser) => {
    adoptSession(user);
    setJustLoggedIn(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const form = e.currentTarget;
    const readField = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';

    let email = readField('email').trim();
    let password = readField('password');

    if (!email || !password) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      email = readField('email').trim();
      password = readField('password');
    }

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      const result = await login({ email, password });
      if (result?.mfaRequired) {
        setStep('totp');
        return;
      }
      if (result?.mfaEnrollmentRequired) {
        setStep('enroll');
        await startEnroll();
        return;
      }
      if (result?.success && result?.data) {
        setJustLoggedIn(true);
      } else if (result?.success) {
        console.error('[Login] success=true but missing data:', result);
        setError('Login succeeded but no user data returned. Please try again.');
      } else {
        setError(result?.message || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    }
  };

  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const code = useRecovery ? recoveryCode.trim() : totpCode.trim();
    if (!code) {
      setError(useRecovery ? 'Enter a recovery code' : 'Enter the 6-digit code');
      return;
    }
    try {
      const result = await completeMfa({ code, recovery: useRecovery });
      if (result?.success && result?.data) {
        setJustLoggedIn(true);
      } else {
        setError(result?.message || 'That code is not valid');
      }
    } catch (err: any) {
      setError(err.message || 'That code is not valid');
    }
  };

  const startEnroll = async () => {
    setEnrollBusy(true);
    setError('');
    try {
      const res = await apiRequest('POST', '/api/auth/mfa/setup');
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Could not start authenticator setup');
      setEnrollSecret(json.data.secretGrouped || json.data.secret);
      setEnrollUri(json.data.otpauthUri);
    } catch (err: any) {
      setError(err.message || 'Could not start authenticator setup');
    } finally {
      setEnrollBusy(false);
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (totpCode.trim().length !== 6) {
      setError('Enter the 6-digit code from your authenticator app');
      return;
    }
    setEnrollBusy(true);
    try {
      const res = await apiRequest('POST', '/api/auth/mfa/enable', { code: totpCode.trim() });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Could not enable authenticator');
      const codes: string[] | undefined = json.data?.recoveryCodes;
      const { recoveryCodes: _ignored, ...user } = json.data as AuthUser & { recoveryCodes?: string[] };
      if (codes && codes.length > 0) {
        setRecoveryCodes(codes);
        setPendingUser(user);
        setStep('recovery');
      } else {
        finishWithUser(user);
      }
    } catch (err: any) {
      setError(err.message || 'Could not enable authenticator');
    } finally {
      setEnrollBusy(false);
    }
  };

  const busy = loginPending || mfaPending || enrollBusy;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img
              src="/inflow-icon-192.png"
              alt="Inflow"
              className="w-16 h-16 rounded-full"
            />
          </div>
          <CardTitle className="text-2xl font-bold">
            {step === 'password' && 'Welcome Back'}
            {step === 'totp' && 'Authenticator code'}
            {step === 'enroll' && 'Set up authenticator'}
            {step === 'recovery' && 'Save your recovery codes'}
          </CardTitle>
          <CardDescription>
            {step === 'password' && 'Sign in to access your Inflow dashboard'}
            {step === 'totp' && (useRecovery
              ? 'Enter one of the recovery codes you saved when you turned this on'
              : 'Open your authenticator app and enter the 6-digit code')}
            {step === 'enroll' && 'Your organisation requires an authenticator app before you can continue'}
            {step === 'recovery' && 'Store these somewhere safe. They will not be shown again.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'password' && (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email" data-testid="label-email">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  disabled={busy}
                  data-testid="input-email"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" data-testid="label-password">
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  disabled={busy}
                  data-testid="input-password"
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <Alert variant="destructive" data-testid="alert-error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={busy}
                data-testid="button-login"
              >
                {loginPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Login'
                )}
              </Button>
            </form>
          )}

          {step === 'totp' && (
            <form onSubmit={handleTotp} className="space-y-4">
              {useRecovery ? (
                <div className="space-y-2">
                  <Label htmlFor="recovery-code">Recovery code</Label>
                  <Input
                    id="recovery-code"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    placeholder="ABCD-EFGH"
                    autoComplete="one-time-code"
                    disabled={busy}
                    data-testid="input-mfa-recovery"
                  />
                </div>
              ) : (
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={totpCode}
                    onChange={setTotpCode}
                    disabled={busy}
                    data-testid="input-mfa-totp"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              )}

              {error && (
                <Alert variant="destructive" data-testid="alert-error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={busy} data-testid="button-mfa-verify">
                {mfaPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={busy}
                onClick={() => {
                  setUseRecovery(!useRecovery);
                  setError('');
                }}
              >
                {useRecovery ? 'Use authenticator code' : 'Use a recovery code'}
              </Button>
            </form>
          )}

          {step === 'enroll' && (
            <form onSubmit={handleEnroll} className="space-y-4">
              {enrollSecret ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Add this account in Google Authenticator, 1Password, or Authy, then enter the code it shows.
                  </p>
                  <div className="rounded-md border border-border bg-muted/40 p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Setup key</p>
                    <p className="font-mono text-sm tracking-wider break-all" data-testid="text-mfa-secret">
                      {enrollSecret}
                    </p>
                  </div>
                  {enrollUri && (
                    <Button type="button" variant="outline" className="w-full" asChild>
                      <a href={enrollUri}>Open in authenticator app</a>
                    </Button>
                  )}
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={totpCode}
                      onChange={setTotpCode}
                      disabled={busy}
                      data-testid="input-mfa-enroll-code"
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center">Preparing authenticator setup...</p>
              )}

              {error && (
                <Alert variant="destructive" data-testid="alert-error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={busy || !enrollSecret} data-testid="button-mfa-enroll">
                {enrollBusy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'Verify and continue'
                )}
              </Button>
            </form>
          )}

          {step === 'recovery' && recoveryCodes && (
            <div className="space-y-4">
              <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
                {recoveryCodes.map((code) => (
                  <li key={code} className="rounded-md border border-border px-2 py-1 text-center">
                    {code}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                data-testid="button-mfa-recovery-continue"
                onClick={() => {
                  if (pendingUser) finishWithUser(pendingUser);
                }}
              >
                I have saved these codes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
