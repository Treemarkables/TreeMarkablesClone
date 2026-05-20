import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Phone,
  RefreshCw,
} from "lucide-react";

interface EnvField {
  set: boolean;
  masked?: string | null;
  value?: string | null;
}

interface DiagnosticResponse {
  success: boolean;
  observedBaseUrl: string;
  expectedBaseUrl: string;
  expectedWebhooks: {
    answer: string;
    statusCallback: string;
    sms: string;
  };
  env: Record<string, EnvField>;
  twilioAccount: { friendlyName: string; status: string; type: string } | null;
  twilioPhoneNumber: {
    sid: string;
    friendlyName: string;
    voiceUrl: string;
    voiceMethod: string;
    smsUrl: string;
    voiceUrlMatchesExpected: boolean;
    smsUrlMatchesExpected: boolean;
  } | null;
  twilioFetchError: string | null;
  recentCalls: Array<{
    id: string;
    phoneNumber: string;
    direction: string;
    status: string | null;
    duration: number | null;
    hasRecording: boolean;
    hasTranscript: boolean;
    createdAt: string;
  }>;
  recommendations: string[];
}

export function TwilioStatusCard() {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, isFetching, refetch, error } =
    useQuery<DiagnosticResponse>({
      queryKey: ["/api/twilio/admin/diagnostic"],
      queryFn: async () => {
        const res = await fetch("/api/twilio/admin/diagnostic", {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`Diagnostic failed: ${res.status}`);
        }
        return res.json();
      },
      staleTime: 60_000,
    });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Checking Twilio status…</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            Twilio status unavailable
          </CardTitle>
          <CardDescription>
            {error instanceof Error
              ? error.message
              : "Could not load diagnostic"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const allGreen = data.recommendations.length === 0 && !data.twilioFetchError;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Call recording — Twilio status
              {allGreen ? (
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Ready
                </Badge>
              ) : (
                <Badge variant="destructive">
                  {data.recommendations.length} issue
                  {data.recommendations.length === 1 ? "" : "s"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {data.twilioAccount
                ? `Connected to Twilio account: ${data.twilioAccount.friendlyName} (${data.twilioAccount.status})`
                : "Not yet connected to Twilio"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-twilio-refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              data-testid="button-twilio-expand"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {(!allGreen || expanded) && (
        <CardContent className="space-y-4">
          {data.recommendations.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
              <p className="text-sm font-medium">To start recording calls:</p>
              <ul className="text-sm space-y-1 list-disc pl-5">
                {data.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {data.twilioFetchError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <span className="font-medium">Twilio API error: </span>
              {data.twilioFetchError}
            </div>
          )}

          {expanded && (
            <>
              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Environment variables</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {Object.entries(data.env).map(([key, field]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-2 border rounded px-2 py-1"
                    >
                      <code className="text-xs">{key}</code>
                      {field.set ? (
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300"
                        >
                          {field.value ?? field.masked ?? "set"}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">missing</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {data.twilioPhoneNumber && (
                <section className="space-y-2">
                  <h4 className="text-sm font-semibold">
                    Twilio number webhooks
                  </h4>
                  <div className="text-sm border rounded p-3 space-y-2">
                    <div>
                      <span className="text-muted-foreground">Number: </span>
                      <code className="text-xs">
                        {data.twilioPhoneNumber.friendlyName}
                      </code>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">Voice URL:</span>
                      <code className="text-xs break-all">
                        {data.twilioPhoneNumber.voiceUrl || "(not set)"}
                      </code>
                      {!data.twilioPhoneNumber.voiceUrlMatchesExpected && (
                        <span className="text-xs text-destructive">
                          Expected: {data.expectedWebhooks.answer}
                        </span>
                      )}
                    </div>
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Recent calls</h4>
                {data.recentCalls.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No calls recorded yet.
                  </p>
                ) : (
                  <div className="text-sm space-y-1">
                    {data.recentCalls.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 border rounded px-2 py-1"
                      >
                        <span>
                          {c.direction} · {c.phoneNumber} · {c.duration ?? 0}s
                        </span>
                        <div className="flex gap-1">
                          {c.hasRecording && (
                            <Badge variant="outline" className="text-xs">
                              rec
                            </Badge>
                          )}
                          {c.hasTranscript && (
                            <Badge variant="outline" className="text-xs">
                              transcript
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
