import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
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

export default function SettingsAccount() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [confirmText, setConfirmText] = useState("");

  const fullName = [currentUser?.firstName, currentUser?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const deleteAccount = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("DELETE", "/api/auth/account", {});
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Could not delete account.");
      return j;
    },
    onSuccess: () => {
      // The server already destroyed the session. Wipe client state and hard-
      // navigate to login so nothing stale survives (incl. the iOS webview).
      try {
        localStorage.removeItem("treemarkables_user");
      } catch {}
      queryClient.clear();
      window.location.href = "/login";
    },
    onError: (e: Error) => {
      toast({
        variant: "destructive",
        title: "Couldn't delete account",
        description: e.message,
      });
    },
  });

  const confirmed = confirmText.trim().toUpperCase() === "DELETE";

  return (
    <div className="pt-20 px-4 md:px-8 max-w-2xl mx-auto pb-16">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/settings" className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to settings
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold mb-1">Account</h1>
      <p className="text-muted-foreground mb-6">
        Your sign-in details and account actions.
      </p>

      <Card className="mb-6 border-border">
        <CardHeader>
          <CardTitle>Signed in as</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="font-medium">{fullName || "—"}</p>
          {currentUser?.email && (
            <p className="text-sm text-muted-foreground">{currentUser.email}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Delete account</CardTitle>
          <CardDescription>
            Permanently deletes your account and removes your personal details
            (name, email, phone) from {`Inflow`}. This cannot be undone, and you
            will be signed out immediately. To manage your business
            subscription or billing, sign in at inflowapp.co.nz from a web
            browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog
            onOpenChange={(open) => {
              if (!open) setConfirmText("");
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Delete my account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes your account and personal data. This
                  action cannot be undone. Type <strong>DELETE</strong> to
                  confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <Label htmlFor="confirm-delete" className="sr-only">
                  Type DELETE to confirm
                </Label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteAccount.isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={!confirmed || deleteAccount.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    deleteAccount.mutate();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteAccount.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting…
                    </>
                  ) : (
                    "Delete account"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
