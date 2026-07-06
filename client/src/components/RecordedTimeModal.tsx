import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { RecordedTimeEntries } from "./RecordedTimeEntries";

interface RecordedTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobNumber: string;
}

// Thin Dialog wrapper around the shared RecordedTimeEntries surface. The
// time-entry UI itself now lives in RecordedTimeEntries so it can also be
// embedded inline inside the Back Costing tab — this modal is the legacy
// GlobalJobCard entry point that still opens it as a dialog.
export function RecordedTimeModal({
  isOpen,
  onClose,
  jobId,
  jobNumber,
}: RecordedTimeModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="w-full h-[100dvh] overflow-y-auto sm:max-w-4xl sm:max-h-[90vh] sm:h-auto p-4 pt-safe"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute left-2 top-14 sm:top-2 h-10 w-10 z-10"
          data-testid="button-close-modal"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>

        <RecordedTimeEntries
          jobId={jobId}
          jobNumber={jobNumber}
          enabled={isOpen}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
