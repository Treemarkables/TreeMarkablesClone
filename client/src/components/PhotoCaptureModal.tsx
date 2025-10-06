import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PhotoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
}

export function PhotoCaptureModal({ isOpen, onClose, jobId }: PhotoCaptureModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('authorName', 'User');
      formData.append('description', 'Photo added');

      // CRITICAL: Add timestamp to bypass ALL caching layers (service worker, browser, iOS)
      const timestamp = Date.now();
      const url = `/api/jobs/${jobId}/photos?_bypass=${timestamp}`;
      
      console.log('📸 Uploading photo with cache bypass:', url);

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        // Force no caching at any level
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      console.log('📸 Upload response status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error('📸 Upload failed:', error);
        throw new Error(error.message || 'Failed to upload photo');
      }

      const result = await response.json();
      console.log('📸 Upload success:', result);
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Photo uploaded successfully",
      });
      
      // Invalidate ALL diary queries for this job (including all filter types)
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'diary-timeline'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      
      // Reset and close
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload photo",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please select a JPEG or PNG image",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    uploadPhotoMutation.mutate(selectedFile);
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (libraryInputRef.current) libraryInputRef.current.value = '';
    onClose();
  };

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleLibraryClick = () => {
    libraryInputRef.current?.click();
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
          {/* Hidden file inputs - separate for camera and library */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-camera"
          />
          <input
            ref={libraryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-library"
          />

          {/* Preview or upload options */}
          {previewUrl ? (
            <div className="relative">
              <img
                src={previewUrl}
                alt="Photo preview"
                className="w-full h-auto max-h-96 object-contain rounded-lg"
                data-testid="img-photo-preview"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  if (cameraInputRef.current) cameraInputRef.current.value = '';
                  if (libraryInputRef.current) libraryInputRef.current.value = '';
                }}
                data-testid="button-clear-photo"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Take Photo Button */}
              <Button
                variant="outline"
                onClick={handleCameraClick}
                className="w-full h-20 flex flex-col gap-2"
                data-testid="button-take-photo"
              >
                <Camera className="w-8 h-8" />
                <span className="text-base font-medium">Take Photo</span>
              </Button>

              {/* Choose from Library Button */}
              <Button
                variant="outline"
                onClick={handleLibraryClick}
                className="w-full h-20 flex flex-col gap-2"
                data-testid="button-choose-library"
              >
                <Upload className="w-8 h-8" />
                <span className="text-base font-medium">Choose from Library</span>
              </Button>
            </div>
          )}

          {/* Action buttons */}
          {selectedFile && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={uploadPhotoMutation.isPending}
                data-testid="button-cancel-upload"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploadPhotoMutation.isPending}
                data-testid="button-upload-photo"
              >
                {uploadPhotoMutation.isPending ? "Uploading..." : "Upload Photo"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
