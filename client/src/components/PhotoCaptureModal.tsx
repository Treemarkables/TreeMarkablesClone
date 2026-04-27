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
import { Input } from "@/components/ui/input";
import { Camera, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { compressImage } from "@/lib/imageCompression";

interface PhotoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId?: string;
  onPendingPhotos?: (files: File[], previewUrls: string[]) => void;
}

export function PhotoCaptureModal({
  isOpen,
  onClose,
  jobId,
  onPendingPhotos,
}: PhotoCaptureModalProps) {
  const isPendingMode = !jobId && !!onPendingPhotos;
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const uploadPhotoMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const results = [];

      for (const file of files) {
        // Compress image before upload for 5-10x faster uploads
        let fileToUpload = file;
        if (file.type.startsWith("image/")) {
          try {
            fileToUpload = await compressImage(file);
            console.log(
              "📸 Compressed:",
              file.name,
              "from",
              (file.size / 1024).toFixed(0),
              "KB to",
              (fileToUpload.size / 1024).toFixed(0),
              "KB",
            );
          } catch (error) {
            console.warn("📸 Compression failed, using original:", error);
          }
        }

        const formData = new FormData();
        formData.append("photo", fileToUpload);
        formData.append("authorName", "User");
        formData.append("description", "Photo added");

        // CRITICAL: Add timestamp to bypass ALL caching layers (service worker, browser, iOS)
        const timestamp = Date.now();
        const url = `/api/jobs/${jobId}/photos?_bypass=${timestamp}`;

        console.log("📸 Uploading photo with cache bypass:", url);

        // Use AbortController with timeout to prevent hung uploads
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        try {
          const response = await fetch(url, {
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

          console.log("📸 Upload response status:", response.status);

          if (!response.ok) {
            const error = await response.json();
            console.error("📸 Upload failed:", error);
            throw new Error(error.message || "Failed to upload photo");
          }

          const result = await response.json();
          console.log("📸 Upload success:", result);
          results.push(result);
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name === "AbortError") {
            throw new Error(
              "Upload timed out. Please check your connection and try again.",
            );
          }
          throw err;
        }
      }

      return results;
    },
    onSuccess: (data) => {
      // Invalidate ALL diary queries for this job (including all filter types)
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "diary-timeline"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });

      // Reset and close
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description:
          error.message || "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const maxSize = 100 * 1024 * 1024; // 100MB
    const validFiles: File[] = [];
    const newPreviewUrls: string[] = [];

    // Validate each file
    for (const file of files) {
      // No file type restrictions - accept all file types

      // Validate file size
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 10MB`,
          variant: "destructive",
        });
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setSelectedFiles(validFiles);

    // Create previews for all valid files
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrls((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) return;

    // If in pending mode (no jobId), pass files back to parent instead of uploading
    if (isPendingMode && onPendingPhotos) {
      onPendingPhotos(selectedFiles, previewUrls);
      handleClose();
      return;
    }

    uploadPhotoMutation.mutate(selectedFiles);
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setPreviewUrls([]);
    onClose();
  };

  const removePhoto = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-photo-capture">
        <DialogHeader>
          <DialogTitle>Add Photo</DialogTitle>
          <DialogDescription>
            Take a new photo or choose from your library
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview or upload options */}
          {previewUrls.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700">
                {previewUrls.length} photo{previewUrls.length > 1 ? "s" : ""}{" "}
                selected
              </div>
              <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {previewUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Photo preview ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                      data-testid={`img-photo-preview-${index}`}
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-90 hover:opacity-100"
                      onClick={() => removePhoto(index)}
                      data-testid={`button-remove-photo-${index}`}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Take Photo - on mobile opens camera, on desktop opens file picker */}
              <div>
                <input
                  id="camera-input"
                  type="file"
                  accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                  {...(isMobile ? { capture: "environment" } : {})}
                  onChange={handleFileSelect}
                  className="sr-only"
                  data-testid="input-camera"
                />
                <label
                  htmlFor="camera-input"
                  className="w-full h-20 flex flex-col gap-2 items-center justify-center border-2 border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                >
                  <Camera className="w-8 h-8" />
                  <span className="text-base font-medium">
                    {isMobile ? "Take Photo" : "Select File"}
                  </span>
                </label>
              </div>

              {/* Choose from Library - allows multiple selection */}
              <div>
                <input
                  id="library-input"
                  type="file"
                  accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                  multiple
                  onChange={handleFileSelect}
                  className="sr-only"
                  data-testid="input-library"
                />
                <label
                  htmlFor="library-input"
                  className="w-full h-20 flex flex-col gap-2 items-center justify-center border-2 border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                >
                  <Upload className="w-8 h-8" />
                  <span className="text-base font-medium">
                    {isMobile ? "Choose from Library" : "Choose Multiple Files"}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {selectedFiles.length > 0 && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                data-testid="button-cancel-upload"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploadPhotoMutation.isPending}
                data-testid="button-upload-photo"
              >
                {uploadPhotoMutation.isPending
                  ? "Uploading..."
                  : isPendingMode
                    ? "Queue Photo"
                    : "Upload Photo"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
