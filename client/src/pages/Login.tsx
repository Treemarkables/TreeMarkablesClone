import { useState } from 'react';
import { useLocation } from 'wouter';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TreePine } from 'lucide-react';

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, loginPending } = useAuth();
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    // Read from the form directly so browser-autofilled values are picked up
    // even when the React onChange never fired (Chrome/Safari autofill quirk).
    const form = e.currentTarget;
    const readField = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';

    let email = readField('email').trim();
    let password = readField('password');

    // Password managers (Google PW Manager / Touch-ID flow) sometimes fire the
    // form's submit a tick before the autofilled values have propagated to
    // the input's .value. If we read empty fields right now, wait a beat and
    // try again instead of bouncing the user with "please enter both".
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
      if (result.success) {
        setLocation('/dispatch');
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center">
              <TreePine className="w-10 h-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to access your Treemarkables dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                disabled={loginPending}
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
                disabled={loginPending}
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
              disabled={loginPending}
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
        </CardContent>
      </Card>
    </div>
  );
}
