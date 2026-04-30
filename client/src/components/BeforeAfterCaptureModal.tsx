import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Camera, ImageIcon, Loader2, X } from "lucide-react";
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
  const [showDiary, setShowDiary] = useState(false);
  const [pickingFromDiary, setPickingFromDiary] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: diaryData } = useQuery({
    queryKey: ["/api/jobs", jobId, "diary"],
    enabled: !!jobId && isOpen,
  });
  const { data: jobPhotosData } = useQuery({
    queryKey: ["/api/jobs", jobId, "photos"],
    enabled: !!jobId && isOpen,
  });

  const diaryPhotos: string[] = (() => {
    const all: string[] = [];
    const dd = diaryData as
      | { success?: boolean; data?: Array<{ photos?: string[]; photoUrl?: string; tags?: string[] }> }
      | undefined;
    if (dd?.success && dd.data) {
      dd.data.forEach((e) => {
        // Skip composites - the existing before/after pair would just be re-paired
        if (e.tags?.includes("composite")) return;
        if (e.photos) all.push(...e.photos);
        if (e.photoUrl && !e.photos?.includes(e.photoUrl)) all.push(e.photoUrl);
      });
    }
    const jpd = jobPhotosData as { beforePhotos?: string[]; afterPhotos?: string[] } | null;
    if (jpd?.beforePhotos) all.push(...jpd.beforePhotos);
    if (jpd?.afterPhotos) all.push(...jpd.afterPhotos);
    return Array.from(new Set(all.filter(Boolean)));
  })();

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

  const handlePickFromDiary = async (url: string) => {
    if (preview1 === url || preview2 === url) return;
    setPickingFromDiary(true);
    try {
      const res = await fetch(url, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error("Could not load photo");
      const blob = await res.blob();
      const filename = url.split("/").pop() || "diary-photo.jpg";
      const file = new File([blob], filename, {
        type: blob.type || "image/jpeg",
      });
      if (!photo1) {
        setPhoto1(file);
        setPreview1(url);
      } else if (!photo2) {
        setPhoto2(file);
        setPreview2(url);
        setShowDiary(false);
      }
    } catch (err) {
      toast({
        title: "Could not load diary photo",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPickingFromDiary(false);
    }
  };

  const handleClose = () => {
    setPhoto1(null);
    setPhoto2(null);
    setPreview1(null);
    setPreview2(null);
    setShowDiary(false);
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
              onChange={handleFileSelect(slot)}
              className="sr-only"
              data-testid={`input-${slot}`}
            />
            <label
              htmlFor={inputId}
              className="w-full h-40 flex flex-col gap-2 items-center justify-center border-2 border-dashed border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
            >
              <Camera className="w-7 h-7" />
              <span className="text-xs font-medium">Choose photo</span>
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

          {diaryPhotos.length > 0 && (
            <Popover open={showDiary} onOpenChange={setShowDiary}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  disabled={pending || (!!photo1 && !!photo2)}
                  data-testid="button-from-diary"
                >
                  <ImageIcon className="w-4 h-4" />
                  Pick from job diary
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3" align="center">
                <p className="text-sm font-medium mb-2">
                  {!photo1
                    ? "Tap a photo to use as Photo 1"
                    : "Tap a photo to use as Photo 2"}
                </p>
                <div className="grid grid-cols-3 gap-1 max-h-64 overflow-y-auto">
                  {diaryPhotos.map((url) => {
                    const used = preview1 === url || preview2 === url;
                    return (
                      <button
                        type="button"
                        key={url}
                        onClick={() => handlePickFromDiary(url)}
                        disabled={used || pickingFromDiary}
                        className={`relative rounded overflow-hidden border-2 ${
                          used
                            ? "border-blue-500 opacity-50 cursor-not-allowed"
                            : "border-transparent hover:border-blue-400"
                        }`}
                        style={{ paddingBottom: "100%" }}
                        data-testid={`button-diary-photo-${url}`}
                      >
                        <img
                          src={url}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}

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
