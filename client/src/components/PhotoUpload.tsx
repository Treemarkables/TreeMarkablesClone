import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
// Remove unused import - we'll use fetch directly for file uploads
import {
  Upload,
  Camera,
  Image,
  X,
  Eye,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface PhotoUploadProps {
  jobId: string;
  type: 'before' | 'after';
  existingPhotos?: string[];
  maxPhotos?: number;
  onPhotosChange?: (photos: string[]) => void;
}

interface UploadResponse {
  success: boolean;
  message: string;
  photos: string[];
}

interface DeleteResponse {
  success: boolean;
  message: string;
  deletedPhoto: string;
}

export default function PhotoUpload({ 
  jobId, 
  type, 
  existingPhotos = [], 
  maxPhotos = 10,
  onPhotosChange 
}: PhotoUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewPhotos, setPreviewPhotos] = useState<string[]>(existingPhotos);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Photo upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      formData.append('type', type);
      
      for (let i = 0; i < files.length; i++) {
        formData.append('photos', files[i]);
      }

      const response = await fetch(`/api/jobs/${jobId}/photos`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      return response.json() as Promise<UploadResponse>;
    },
    onSuccess: (data: UploadResponse) => {
      const newPhotos = [...previewPhotos, ...data.photos];
      setPreviewPhotos(newPhotos);
      onPhotosChange?.(newPhotos);
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Photos uploaded successfully!",
        description: `Added ${data.photos.length} ${type} photo(s)`,
      });
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Failed to upload photos. Please try again.",
      });
    },
    onSettled: () => {
      setUploading(false);
      setUploadProgress(0);
    }
  });

  // Photo delete mutation  
  const deleteMutation = useMutation({
    mutationFn: async (photoUrl: string) => {
      const response = await fetch(`/api/jobs/${jobId}/photos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl, type }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Delete failed');
      }
      
      return response.json() as Promise<DeleteResponse>;
    },
    onSuccess: (data: DeleteResponse) => {
      const newPhotos = previewPhotos.filter(photo => photo !== data.deletedPhoto);
      setPreviewPhotos(newPhotos);
      onPhotosChange?.(newPhotos);
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Photo deleted",
        description: "Photo removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message || "Failed to delete photo. Please try again.",
      });
    }
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = async (files: FileList) => {
    // Validate file count
    if (previewPhotos.length + files.length > maxPhotos) {
      toast({
        variant: "destructive",
        title: "Too many photos",
        description: `Maximum ${maxPhotos} photos allowed. Currently have ${previewPhotos.length}.`,
      });
      return;
    }

    // Validate file types
    const validFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: `${file.name} is not an image file.`,
        });
        return false;
      }
      
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: `${file.name} is larger than 5MB.`,
        });
        return false;
      }
      
      return true;
    });

    if (validFiles.length === 0) return;

    // Create FileList from valid files
    const dt = new DataTransfer();
    validFiles.forEach(file => dt.items.add(file));
    
    setUploading(true);
    setUploadProgress(10);
    
    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    uploadMutation.mutate(dt.files);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const openPhotoPreview = (photoUrl: string) => {
    window.open(photoUrl, '_blank');
  };

  const deletePhoto = (photoUrl: string) => {
    if (confirm('Are you sure you want to delete this photo?')) {
      deleteMutation.mutate(photoUrl);
    }
  };

  const canUploadMore = previewPhotos.length < maxPhotos;

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {canUploadMore && (
        <Card className={`border-dashed transition-colors ${
          dragActive ? 'border-orange-500 bg-orange-50' : 'border-gray-300'
        }`}>
          <CardContent 
            className="p-6"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
                ) : (
                  <Upload className="h-6 w-6 text-gray-400" />
                )}
              </div>
              
              {uploading ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Uploading {type} photos...</p>
                  <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                  <p className="text-xs text-gray-500">{uploadProgress}% complete</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-lg font-medium capitalize">
                    Upload {type} Photos
                  </h3>
                  <p className="text-sm text-gray-600">
                    Drag and drop photos here, or click to browse
                  </p>
                  <p className="text-xs text-gray-500">
                    Supports: JPG, PNG, GIF. Max size: 5MB each
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-center">
                <Button
                  onClick={openFileDialog}
                  disabled={uploading}
                  className="flex items-center gap-2"
                  data-testid={`button-upload-${type}-photos`}
                >
                  <Camera className="h-4 w-4" />
                  Choose Photos
                </Button>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{previewPhotos.length} / {maxPhotos} photos</span>
                <Badge variant="secondary" className="text-xs">
                  {type} photos
                </Badge>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
              data-testid={`input-upload-${type}-photos`}
            />
          </CardContent>
        </Card>
      )}

      {/* Photo Gallery */}
      {previewPhotos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium capitalize flex items-center gap-2">
              <Image className="h-4 w-4" />
              {type} Photos ({previewPhotos.length})
            </h4>
            {!canUploadMore && (
              <Badge variant="outline" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Max photos reached
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {previewPhotos.map((photoUrl, index) => (
              <Card key={`${photoUrl}-${index}`} className="overflow-hidden group hover-elevate">
                <CardContent className="p-0 relative">
                  <img
                    src={photoUrl}
                    alt={`${type} photo ${index + 1}`}
                    className="w-full h-24 sm:h-32 object-cover"
                    data-testid={`img-${type}-photo-${index}`}
                  />
                  
                  {/* Photo overlay actions */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 w-8 p-0"
                        onClick={() => openPhotoPreview(photoUrl)}
                        data-testid={`button-view-${type}-photo-${index}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 w-8 p-0"
                        onClick={() => deletePhoto(photoUrl)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${type}-photo-${index}`}
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Photo number badge */}
                  <div className="absolute top-1 left-1">
                    <Badge variant="secondary" className="text-xs h-5">
                      {index + 1}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {previewPhotos.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Image className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No {type} photos uploaded yet</p>
        </div>
      )}
    </div>
  );
}