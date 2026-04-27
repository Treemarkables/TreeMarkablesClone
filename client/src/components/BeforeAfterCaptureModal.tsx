import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/imageCompression";

interface BeforeAfterCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
}

type Slot = "photo1" | "photo2";

export function BeforeAfterCaptureModal({
  isOpen,
  onClose,
  jobId,
}: BeforeAfterCaptureModalProps) {
  const [photo1, setPhoto1] = useState<File | null>(null);
  const [photo2, setPhoto2] = useState<File | null>(null);
  const [preview1, setPreview1] = useState<string | null>(null);
  const [preview2, setPreview2] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!photo1 || !photo2) {
        throw new Error("Please select two photos");
      }

      const compress = async (file: File) => {
        if (!file.type.startsWith("image/")) return file;
        try {
          return await compressImage(file);
        } catch {
          return file;
        }
      };

      const [p1, p2] = await Promise.all([compress(photo1), compress(photo2)]);

      const formData = new FormData();
      formData.append("photo1", p1);
      formData.append("photo2", p2);
      formData.append("authorName", "User");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);
      try {
        const response = await fetch(`/api/jobs/${jobId}/diary/before-after`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
          credentials: "include",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || "Failed to generate before/after");
        }
        return response.json();
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          throw new Error("Request timed out. Please try again.");
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "diary-timeline"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Could not generate before/after",
        description:
          error.message || "Please try again with two photos of the job.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (slot: Slot) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `${file.name} is larger than 100MB`,
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const url = reader.result as string;
      if (slot === "photo1") {
        setPhoto1(file);
        setPreview1(url);
      } else {
        setPhoto2(file);
        setPreview2(url);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearSlot = (slot: Slot) => {
    if (slot === "photo1") {
      setPhoto1(null);
      setPreview1(null);
    } else {
      setPhoto2(null);
      setPreview2(null);
    }
  };

  const handleClose = () => {
    setPhoto1(null);
    setPhoto2(null);
    setPreview1(null);
    setPreview2(null);
    onClose();
  };

  const renderSlot = (slot: Slot, preview: string | null, label: string) => {
    const inputId = `before-after-${slot}`;
    return (
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {label}
        </div>
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt={label}
              className="w-full h-40 object-cover rounded-lg"
              data-testid={`img-${slot}-preview`}
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 opacity-90 hover:opacity-100"
              onClick={() => clearSlot(slot)}
              data-testid={`button-clear-${slot}`}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              {...(isMobile ? { capture: "environment" as const } : {})}
              onChange={handleFileSelect(slot)}
              className="sr-only"
              data-testid={`input-${slot}`}
            />
            <label
              htmlFor={inputId}
              className="w-full h-40 flex flex-col gap-2 items-center justify-center border-2 border-dashed border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
            >
              <Camera className="w-7 h-7" />
              <span className="text-xs font-medium">
                {isMobile ? "Take or choose" : "Choose photo"}
              </span>
            </label>
          </>
        )}
      </div>
    );
  };

  const ready = !!photo1 && !!photo2;
  const pending = generateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !pending && handleClose()}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-before-after">
        <DialogHeader>
          <DialogTitle>Before / After</DialogTitle>
          <DialogDescription>
            Add two photos of the job. AI will work out which is the before and
            which is the after, then label them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {renderSlot("photo1", preview1, "Photo 1")}
            {renderSlot("photo2", preview2, "Photo 2")}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={pending}
              data-testid="button-cancel-before-after"
            >
              Cancel
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!ready || pending}
              data-testid="button-generate-before-after"
            >
              {pending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analysing...
                </>
              ) : (
                "Generate"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
