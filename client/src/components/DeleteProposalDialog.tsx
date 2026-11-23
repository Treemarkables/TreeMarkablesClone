import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PROPOSAL_DELETE_ACCEPTED_MESSAGE,
  PROPOSAL_DELETE_CONFIRM_MESSAGE,
  proposalDeletionDecision,
} from "@shared/proposalDelete";

interface DeleteProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalNumber?: string;
  status?: string | null;
  pending?: boolean;
  onConfirm: () => void;
}

/**
 * Confirm before a proposal is removed. An accepted proposal explains why
 * it stays, and does not offer a delete button — the server refuses those
 * as well.
 */
export function DeleteProposalDialog({
  open,
  onOpenChange,
  proposalNumber,
  status,
  pending,
  onConfirm,
}: DeleteProposalDialogProps) {
  const blocked = !proposalDeletionDecision({ status }).allowed;
  const label = proposalNumber ? `proposal ${proposalNumber}` : "this proposal";

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {blocked ? "This proposal can't be deleted" : `Delete ${label}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {blocked ? PROPOSAL_DELETE_ACCEPTED_MESSAGE : PROPOSAL_DELETE_CONFIRM_MESSAGE}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {blocked ? (
            <AlertDialogCancel data-testid="button-proposal-delete-close">Close</AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel disabled={pending} data-testid="button-proposal-delete-cancel">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={pending}
                data-testid="button-proposal-delete-confirm"
                onClick={(event) => {
                  event.preventDefault();
                  onConfirm();
                }}
              >
                {pending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  "Delete proposal"
                )}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
