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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('authorName', 'User');
      formData.append('description', 'Photo added');

      const response = await fetch(`/api/jobs/${jobId}/photos`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload photo');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Photo uploaded successfully",
      });
      
      // Invalidate queries to refresh diary and job data
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'diary'] });
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-photo-capture">
        <DialogHeader>
          <DialogTitle>Capture Photo</DialogTitle>
          <DialogDescription>
            Take a photo or select an image to add to the job diary
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture={isMobile ? "environment" : undefined}
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-photo-file"
          />

          {/* Preview or upload button */}
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
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                data-testid="button-clear-photo"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg">
              <Camera className="w-12 h-12 mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                {isMobile ? "Take a photo" : "Select an image"}
              </p>
              <Button
                variant="outline"
                onClick={handleCameraClick}
                data-testid="button-select-photo"
              >
                <Upload className="w-4 h-4 mr-2" />
                {isMobile ? "Open Camera" : "Choose File"}
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
