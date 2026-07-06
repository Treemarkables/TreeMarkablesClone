import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import InquiryForm from "@/components/InquiryForm";

interface ContactFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ContactFormModal({
  open,
  onOpenChange,
}: ContactFormModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none"
        data-testid="modal-contact-form"
      >
        {/* Accessible name/description for screen readers (Radix requires a
            DialogTitle; visually hidden so the form's own heading stays the
            visible title). */}
        <DialogTitle className="sr-only">Request a free quote</DialogTitle>
        <DialogDescription className="sr-only">
          Fill in your details and we'll get back to you within 24 hours.
        </DialogDescription>
        <InquiryForm
          onCancel={() => onOpenChange(false)}
          onSuccess={() => {
            setTimeout(() => onOpenChange(false), 2000);
          }}
          showCloseIcon
        />
      </DialogContent>
    </Dialog>
  );
}
