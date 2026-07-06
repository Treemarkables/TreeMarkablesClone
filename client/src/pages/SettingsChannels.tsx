import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Trash2, Loader2, Plus, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Channel {
  id: string;
  channelType: "phone" | "email" | "fb_page";
  identifier: string;
  label: string | null;
  isActive: boolean;
}

const TYPE_META: Record<string, { label: string; placeholder: string; icon: typeof Phone }> = {
  phone: { label: "Phone / SMS number", placeholder: "e.g. 04 887 8776", icon: Phone },
  email: { label: "Email address", placeholder: "e.g. jobs@yourbusiness.co.nz", icon: Mail },
};

export default function SettingsChannels() {
  const { toast } = useToast();
  const [channelType, setChannelType] = useState<"phone" | "email">("phone");
  const [identifier, setIdentifier] = useState("");
  const [label, setLabel] = useState("");

  const { data, isLoading } = useQuery<{ success: boolean; data: Channel[] }>({
    queryKey: ["/api/channels"],
  });
  const channels = (data?.data ?? []).filter((c) => c.isActive);

  const addChannel = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/channels", { channelType, identifier, label });
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Could not add channel.");
      return j;
    },
    onSuccess: () => {
      setIdentifier("");
      setLabel("");
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Couldn't add channel", description: e.message });
    },
  });

  const removeChannel = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("DELETE", `/api/channels/${id}`, {});
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Could not remove channel.");
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Couldn't remove channel", description: e.message });
    },
  });

  const canAdd = identifier.trim().length > 0 && !addChannel.isPending;

  return (
    <div className="pt-20 px-4 md:px-8 max-w-2xl mx-auto pb-16">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/settings" className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to settings
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold mb-1">Inbound Channels</h1>
      <p className="text-muted-foreground mb-6">
        Register the phone numbers and email addresses that belong to your business, so incoming
        calls, texts and replies are routed to you automatically. Each number or email can belong
        to only one business.
      </p>

      <Card className="mb-6 border-border">
        <CardHeader>
          <CardTitle>Your channels</CardTitle>
          <CardDescription>Calls, texts and emails to these are matched to your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…
            </div>
          ) : channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No channels registered yet.</p>
          ) : (
            channels.map((c) => {
              const Icon = TYPE_META[c.channelType]?.icon ?? Phone;
              return (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.label || c.identifier}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.channelType === "phone" ? `Phone / SMS · matches last 8 digits: ${c.identifier}` : c.identifier}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Remove channel"
                    disabled={removeChannel.isPending}
                    onClick={() => removeChannel.mutate(c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Add a channel</CardTitle>
          <CardDescription>
            Phone numbers are matched on the last 8 digits, so formatting doesn't matter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canAdd) addChannel.mutate();
            }}
          >
            <div>
              <Label htmlFor="channelType">Type</Label>
              <Select value={channelType} onValueChange={(v) => setChannelType(v as "phone" | "email")}>
                <SelectTrigger id="channelType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone / SMS number</SelectItem>
                  <SelectItem value="email">Email address</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="identifier">{TYPE_META[channelType].label}</Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={TYPE_META[channelType].placeholder}
                type={channelType === "email" ? "email" : "tel"}
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Main line"
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={!canAdd}>
              {addChannel.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding…</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" /> Add channel</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
