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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const uploadPhotoMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const results = [];
      
      for (const file of files) {
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
        results.push(result);
      }
      
      return results;
    },
    onSuccess: (data) => {
      const count = data.length;
      toast({
        title: "Success",
        description: `${count} photo${count > 1 ? 's' : ''} uploaded successfully`,
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
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validFiles: File[] = [];
    const newPreviewUrls: string[] = [];

    // Validate each file
    for (const file of files) {
      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a JPEG or PNG image`,
          variant: "destructive",
        });
        continue;
      }

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
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrls(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) return;
    uploadPhotoMutation.mutate(selectedFiles);
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setPreviewUrls([]);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (libraryInputRef.current) libraryInputRef.current.value = '';
    onClose();
  };

  const removePhoto = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
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
            multiple
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-library"
          />

          {/* Preview or upload options */}
          {previewUrls.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700">
                {previewUrls.length} photo{previewUrls.length > 1 ? 's' : ''} selected
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
          {selectedFiles.length > 0 && (
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
