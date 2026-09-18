import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  KeyRound,
  Loader2,
  Monitor,
  Shield,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatNZTime } from "@shared/dateUtils";

type MfaStatus = {
  enabled: boolean;
  enrolledAt: string | null;
  lastVerifiedAt: string | null;
  remainingRecoveryCodes: number;
  enforcement: "optional" | "required";
};

type SessionRow = {
  sid: string;
  current: boolean;
  createdAt: string | null;
  expiresAt: string;
  lastActiveAt: string | null;
  ip: string | null;
  deviceLabel: string;
  mfaVerified: boolean;
};

function TotpBoxes({
  value,
  onChange,
  disabled,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <InputOTP maxLength={6} value={value} onChange={onChange} disabled={disabled} data-testid={testId}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  );
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  try {
    return formatNZTime(iso, "datetime");
  } catch {
    return iso;
  }
}

export default function SettingsSecurity() {
  const { toast } = useToast();
  const { logout } = useAuth();
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupUri, setSetupUri] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [regenCode, setRegenCode] = useState("");
  const [freshRecovery, setFreshRecovery] = useState<string[] | null>(null);

  const statusQuery = useQuery<{ success: boolean; data: MfaStatus }>({
    queryKey: ["/api/auth/mfa/status"],
  });
  const sessionsQuery = useQuery<{ success: boolean; data: SessionRow[] }>({
    queryKey: ["/api/auth/sessions"],
  });

  const status = statusQuery.data?.data;
  const sessions = sessionsQuery.data?.data ?? [];

  const invalidateAuth = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/mfa/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/sessions"] });
  };

  const onError = (e: Error) => {
    toast({ variant: "destructive", title: "Could not update security", description: e.message });
  };

  const startSetup = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/auth/mfa/setup");
      return r.json();
    },
    onSuccess: (json) => {
      if (!json.success) {
        onError(new Error(json.message || "Could not start authenticator setup"));
        return;
      }
      setFreshRecovery(null);
      setSetupSecret(json.data.secretGrouped || json.data.secret);
      setSetupUri(json.data.otpauthUri);
      setSetupCode("");
    },
    onError,
  });

  const enableMfa = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/auth/mfa/enable", { code: setupCode });
      return r.json();
    },
    onSuccess: (json) => {
      if (!json.success) {
        onError(new Error(json.message || "That code is not valid"));
        return;
      }
      setSetupSecret(null);
      setSetupUri(null);
      setSetupCode("");
      setFreshRecovery(json.data?.recoveryCodes ?? []);
      invalidateAuth();
    },
    onError,
  });

  const disableMfa = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/auth/mfa/disable", { code: disableCode });
      return r.json();
    },
    onSuccess: (json) => {
      if (!json.success) {
        onError(new Error(json.message || "Could not turn off authenticator"));
        return;
      }
      setDisableCode("");
      setFreshRecovery(null);
      invalidateAuth();
    },
    onError,
  });

  const regenCodes = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/auth/mfa/recovery-codes", { code: regenCode });
      return r.json();
    },
    onSuccess: (json) => {
      if (!json.success) {
        onError(new Error(json.message || "Could not generate new recovery codes"));
        return;
      }
      setRegenCode("");
      setFreshRecovery(json.data?.recoveryCodes ?? []);
      invalidateAuth();
    },
    onError,
  });

  const revokeOne = useMutation({
    mutationFn: async (sid: string) => {
      const r = await apiRequest("DELETE", `/api/auth/sessions/${encodeURIComponent(sid)}`);
      return r.json();
    },
    onSuccess: (json) => {
      if (json?.data?.current) {
        logout();
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/sessions"] });
    },
    onError,
  });

  const revokeOthers = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/auth/sessions/revoke-others");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/sessions"] });
    },
    onError,
  });

  const revokeAll = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/auth/sessions/revoke-all");
      return r.json();
    },
    onSuccess: () => {
      logout();
    },
    onError,
  });

  return (
    <div className="pt-20 px-4 md:px-8 max-w-2xl mx-auto pb-16">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/settings" className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to settings
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold mb-1">Security</h1>
      <p className="text-muted-foreground mb-6">
        Authenticator app (optional) and devices that are signed in. Sessions stay active for 30 days of use.
      </p>

      <Card className="mb-6 border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Authenticator app
          </CardTitle>
          <CardDescription>
            Optional extra step at sign-in. Crew who have not turned this on keep logging in with email and password.
            {status?.enforcement === "required"
              ? " Your organisation currently requires it."
              : " Your organisation can require it later without a rebuild."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}

          {status?.enabled && !setupSecret && (
            <div className="space-y-3">
              <p className="text-sm">
                Authenticator is on
                {status.enrolledAt ? ` · set up ${formatWhen(status.enrolledAt)}` : ""}.
                {` ${status.remainingRecoveryCodes} recovery code${status.remainingRecoveryCodes === 1 ? "" : "s"} left.`}
              </p>
              <div className="space-y-2">
                <Label htmlFor="disable-code">Authenticator or recovery code</Label>
                <Input
                  id="disable-code"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder="123456 or ABCD-EFGH"
                  autoComplete="one-time-code"
                  data-testid="input-mfa-disable"
                />
              </div>
              <Button
                variant="destructive"
                disabled={disableMfa.isPending || disableCode.trim().length < 6}
                onClick={() => disableMfa.mutate()}
                data-testid="button-mfa-disable"
              >
                {disableMfa.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Turn off authenticator
              </Button>

              <div className="pt-4 border-t border-border space-y-2">
                <Label>Replace recovery codes</Label>
                <TotpBoxes value={regenCode} onChange={setRegenCode} testId="input-mfa-regen" />
                <Button
                  variant="outline"
                  disabled={regenCodes.isPending || regenCode.length !== 6}
                  onClick={() => regenCodes.mutate()}
                >
                  {regenCodes.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                  Generate new recovery codes
                </Button>
              </div>
            </div>
          )}

          {!status?.enabled && !setupSecret && (
            <Button
              onClick={() => startSetup.mutate()}
              disabled={startSetup.isPending}
              data-testid="button-mfa-start"
            >
              {startSetup.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Smartphone className="h-4 w-4 mr-2" />}
              Set up authenticator
            </Button>
          )}

          {setupSecret && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Add this account in Google Authenticator, 1Password, or Authy, then enter the 6-digit code.
              </p>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Setup key</p>
                <p className="font-mono text-sm tracking-wider break-all">{setupSecret}</p>
              </div>
              {setupUri && (
                <Button variant="outline" asChild>
                  <a href={setupUri}>Open in authenticator app</a>
                </Button>
              )}
              <TotpBoxes value={setupCode} onChange={setSetupCode} testId="input-mfa-enable" />
              <div className="flex gap-2">
                <Button
                  disabled={enableMfa.isPending || setupCode.length !== 6}
                  onClick={() => enableMfa.mutate()}
                  data-testid="button-mfa-enable"
                >
                  {enableMfa.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Verify and turn on
                </Button>
                <Button variant="ghost" onClick={() => { setSetupSecret(null); setSetupUri(null); setSetupCode(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {freshRecovery && freshRecovery.length > 0 && (
            <Alert>
              <AlertDescription>
                <p className="font-medium mb-2">Save these recovery codes now. They will not be shown again.</p>
                <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {freshRecovery.map((code) => (
                    <li key={code}>{code}</li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setFreshRecovery(null)}
                >
                  I have saved these codes
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Signed-in devices
          </CardTitle>
          <CardDescription>
            Each device keeps a 30-day rolling session for field use. Sign out a lost phone here without changing the password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessionsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
          {sessions.length === 0 && !sessionsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          )}
          <ul className="space-y-3">
            {sessions.map((s) => (
              <li
                key={s.sid}
                className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{s.deviceLabel}</p>
                    {s.current && <Badge variant="secondary">This device</Badge>}
                    {s.mfaVerified && <Badge variant="outline">Authenticator</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last active {formatWhen(s.lastActiveAt)}
                    {s.ip ? ` · ${s.ip}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expires {formatWhen(s.expiresAt)}
                  </p>
                </div>
                {!s.current && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={revokeOne.isPending}
                    onClick={() => revokeOne.mutate(s.sid)}
                  >
                    Sign out
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              disabled={revokeOthers.isPending || sessions.filter((s) => !s.current).length === 0}
              onClick={() => revokeOthers.mutate()}
              data-testid="button-revoke-others"
            >
              {revokeOthers.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Sign out other devices
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" data-testid="button-revoke-all">
                  Sign out everywhere
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign out everywhere?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This signs you out on this device and every other phone or browser. You will need to log in again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      revokeAll.mutate();
                    }}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Sign out everywhere
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
