import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Camera, 
  Image, 
  Upload, 
  Eye,
  Download,
  Trash2,
  Calendar,
  MapPin,
  User,
  FileImage,
  Grid,
  List,
  ArrowLeft
} from 'lucide-react';
import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { format } from 'date-fns';
import { Link } from 'wouter';

interface Photo {
  id: string;
  jobId: string;
  jobTitle: string;
  customerName: string;
  url: string;
  thumbnail: string;
  type: 'before' | 'during' | 'after' | 'damage' | 'safety' | 'equipment';
  capturedAt: string;
  location: string;
  notes?: string;
  capturedBy: string;
  fileSize: number;
  dimensions: { width: number; height: number };
}

interface PhotoDocumentationProps {
  compact?: boolean;
  jobId?: string;
}

const mockPhotoData: Photo[] = [
  {
    id: '1',
    jobId: '1',
    jobTitle: 'Large Oak Tree Removal',
    customerName: 'Sarah Williams',
    url: '/photos/before-oak-tree-1.jpg',
    thumbnail: '/photos/thumbs/before-oak-tree-1.jpg',
    type: 'before',
    capturedAt: '2024-12-15T08:30:00Z',
    location: '123 Main Street, Auckland',
    notes: 'Large oak tree showing signs of disease, poses risk to property',
    capturedBy: 'Mike Johnson',
    fileSize: 2.4 * 1024 * 1024, // 2.4MB
    dimensions: { width: 1920, height: 1080 }
  },
  {
    id: '2',
    jobId: '1',
    jobTitle: 'Large Oak Tree Removal',
    customerName: 'Sarah Williams',
    url: '/photos/during-oak-tree-1.jpg',
    thumbnail: '/photos/thumbs/during-oak-tree-1.jpg',
    type: 'during',
    capturedAt: '2024-12-15T10:15:00Z',
    location: '123 Main Street, Auckland',
    notes: 'Tree being sectioned safely with crane assistance',
    capturedBy: 'David Wilson',
    fileSize: 3.1 * 1024 * 1024,
    dimensions: { width: 1920, height: 1080 }
  },
  {
    id: '3',
    jobId: '1',
    jobTitle: 'Large Oak Tree Removal',
    customerName: 'Sarah Williams',
    url: '/photos/after-oak-tree-1.jpg',
    thumbnail: '/photos/thumbs/after-oak-tree-1.jpg',
    type: 'after',
    capturedAt: '2024-12-15T14:30:00Z',
    location: '123 Main Street, Auckland',
    notes: 'Site cleaned up, stump ground down, grass seed applied',
    capturedBy: 'Mike Johnson',
    fileSize: 2.8 * 1024 * 1024,
    dimensions: { width: 1920, height: 1080 }
  },
  {
    id: '4',
    jobId: '2',
    jobTitle: 'Emergency Storm Cleanup',
    customerName: 'Auckland Council',
    url: '/photos/damage-storm-1.jpg',
    thumbnail: '/photos/thumbs/damage-storm-1.jpg',
    type: 'damage',
    capturedAt: '2024-12-12T06:45:00Z',
    location: 'Albert Park, Auckland CBD',
    notes: 'Storm damaged tree blocking road, priority removal required',
    capturedBy: 'Sarah Chen',
    fileSize: 4.2 * 1024 * 1024,
    dimensions: { width: 2048, height: 1536 }
  },
  {
    id: '5',
    jobId: '3',
    jobTitle: 'Hedge Trimming - Commercial',
    customerName: 'Mike Chen',
    url: '/photos/equipment-safety-1.jpg',
    thumbnail: '/photos/thumbs/equipment-safety-1.jpg',
    type: 'safety',
    capturedAt: '2024-12-18T09:00:00Z',
    location: 'Commercial Complex, North Shore',
    notes: 'Team safety briefing, all PPE checked and confirmed',
    capturedBy: 'Emma Thompson',
    fileSize: 1.9 * 1024 * 1024,
    dimensions: { width: 1600, height: 1200 }
  }
];

export function PhotoDocumentation({ compact = false, jobId }: PhotoDocumentationProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<Photo['type'] | 'all'>('all');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Replace mock data with real API calls
  const photosQuery = useQuery({
    queryKey: jobId ? ['job-photos', jobId, filterType] : ['all-photos', filterType],
    queryFn: async () => {
      let url: string;
      if (jobId) {
        // Get photos for specific job
        url = `/api/jobs/${jobId}/photos/enhanced`;
        if (filterType !== 'all') {
          url += `?type=${filterType}`;
        }
      } else {
        // Get all public photos
        url = '/api/photos/public?limit=50';
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch photos');
      }
      
      return data.photos as Photo[];
    }
  });

  // Apply filtering to the fetched photos
  const allPhotos = photosQuery.data || [];
  const filteredPhotos = filterType === 'all' 
    ? allPhotos 
    : allPhotos.filter(photo => photo.type === filterType);
  
  const finalPhotos = filteredPhotos;

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getTypeColor = (type: Photo['type']) => {
    switch (type) {
      case 'before': return 'bg-blue-500';
      case 'during': return 'bg-yellow-500';
      case 'after': return 'bg-green-500';
      case 'damage': return 'bg-red-500';
      case 'safety': return 'bg-purple-500';
      case 'equipment': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeText = (type: Photo['type']) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('photos', file);
      });
      
      formData.append('type', filterType === 'all' ? 'before' : filterType);
      formData.append('capturedBy', 'Current User');
      
      if (jobId) {
        formData.append('jobId', jobId);
      }

      // Use the enhanced photo upload API
      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Upload Successful",
          description: `Successfully uploaded ${result.photos.length} photos`,
        });
        
        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Invalidate and refetch photos instead of page reload
        queryClient.invalidateQueries({ 
          queryKey: jobId ? ['job-photos', jobId] : ['all-photos'] 
        });
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : 'An error occurred during upload',
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (compact) {
    const totalPhotos = finalPhotos.length;
    const recentPhotos = [...finalPhotos]
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())
      .slice(0, 3);

    return (
      <Card data-testid="photo-summary-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Photo Documentation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Total Photos</span>
              <Badge variant="secondary" data-testid="total-photos">
                {totalPhotos}
              </Badge>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Recent Photos</h4>
              <div className="grid grid-cols-3 gap-2">
                {recentPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative aspect-square bg-gray-100 rounded-md overflow-hidden cursor-pointer hover:opacity-75"
                    onClick={() => setSelectedPhoto(photo)}
                    data-testid={`photo-thumb-${photo.id}`}
                  >
                    <img
                      src={photo.url}
                      alt={`${getTypeText(photo.type)} photo for ${photo.jobTitle}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to placeholder if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const placeholder = target.nextElementSibling as HTMLElement;
                        if (placeholder) placeholder.style.display = 'flex';
                      }}
                    />
                    <div className="w-full h-full bg-gradient-to-br from-green-200 to-blue-200 flex items-center justify-center" style={{ display: 'none' }}>
                      <FileImage className="h-8 w-8 text-white" />
                    </div>
                    <Badge className={`${getTypeColor(photo.type)} text-white absolute top-1 left-1 text-xs`}>
                      {getTypeText(photo.type)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <Button variant="outline" size="sm" className="w-full" data-testid="view-all-photos">
              <Eye className="h-4 w-4 mr-2" />
              View All Photos
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" asChild data-testid="back-to-dashboard">
                <Link href="/job-dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Photo Documentation {jobId && `- Job ${jobId}`}
              </CardTitle>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleUploadClick}
                disabled={isUploading}
                data-testid="upload-photos"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Uploading...' : 'Upload Photos'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} data-testid="toggle-view">
                {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          {/* Filter Controls */}
          <div className="flex gap-2 mt-4">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('all')}
              data-testid="filter-all"
            >
              All ({filteredPhotos.length})
            </Button>
            {['before', 'during', 'after', 'damage', 'safety', 'equipment'].map(type => {
              const count = filteredPhotos.filter(p => p.type === type).length;
              if (count === 0) return null;
              
              return (
                <Button
                  key={type}
                  variant={filterType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType(type as Photo['type'])}
                  data-testid={`filter-${type}`}
                >
                  {getTypeText(type as Photo['type'])} ({count})
                </Button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {finalPhotos.map((photo) => (
                <Card
                  key={photo.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => setSelectedPhoto(photo)}
                  data-testid={`photo-card-${photo.id}`}
                >
                  <CardContent className="p-3">
                    <div className="relative aspect-square bg-gray-100 rounded-md overflow-hidden mb-2">
                      <img
                        src={photo.url}
                        alt={`${getTypeText(photo.type)} photo for ${photo.jobTitle}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to placeholder if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const placeholder = target.nextElementSibling as HTMLElement;
                          if (placeholder) placeholder.style.display = 'flex';
                        }}
                      />
                      <div className="w-full h-full bg-gradient-to-br from-green-200 to-blue-200 flex items-center justify-center" style={{ display: 'none' }}>
                        <FileImage className="h-12 w-12 text-white" />
                      </div>
                      <Badge className={`${getTypeColor(photo.type)} text-white absolute top-1 left-1 text-xs`}>
                        {getTypeText(photo.type)}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium truncate" data-testid={`job-title-${photo.id}`}>
                        {photo.jobTitle}
                      </h4>
                      <p className="text-xs text-muted-foreground" data-testid={`customer-${photo.id}`}>
                        {photo.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid={`date-${photo.id}`}>
                        {format(new Date(photo.capturedAt), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {finalPhotos.map((photo) => (
                <Card
                  key={photo.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => setSelectedPhoto(photo)}
                  data-testid={`photo-list-${photo.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="relative w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                        <img
                          src={photo.url}
                          alt={`${getTypeText(photo.type)} photo for ${photo.jobTitle}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to placeholder if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const placeholder = target.nextElementSibling as HTMLElement;
                            if (placeholder) placeholder.style.display = 'flex';
                          }}
                        />
                        <div className="w-full h-full bg-gradient-to-br from-green-200 to-blue-200 flex items-center justify-center" style={{ display: 'none' }}>
                          <FileImage className="h-8 w-8 text-white" />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate" data-testid={`list-job-${photo.id}`}>
                            {photo.jobTitle}
                          </h4>
                          <Badge className={`${getTypeColor(photo.type)} text-white`}>
                            {getTypeText(photo.type)}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{photo.customerName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(photo.capturedAt), 'MMM dd, yyyy HH:mm')}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{photo.location}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <FileImage className="h-3 w-3" />
                              <span>{formatFileSize(photo.fileSize)}</span>
                            </div>
                          </div>
                          
                          {photo.notes && (
                            <p className="text-xs truncate">{photo.notes}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" data-testid={`view-${photo.id}`}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" data-testid={`download-${photo.id}`}>
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {finalPhotos.length === 0 && (
            <div className="text-center py-12">
              <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-2">No photos found</h3>
              <p className="text-muted-foreground mb-4">
                {filterType === 'all' ? 'No photos have been uploaded yet.' : `No ${filterType} photos found.`}
              </p>
              <Button 
                onClick={handleUploadClick}
                disabled={isUploading}
                data-testid="upload-first-photos"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Uploading...' : 'Upload Your First Photos'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden file input for uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/jpg,image/png,image/webp"
        multiple
        style={{ display: 'none' }}
        data-testid="file-input"
      />

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle data-testid="photo-detail-title">
                {selectedPhoto.jobTitle} - {getTypeText(selectedPhoto.type)} Photo
              </DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                {/* Photo Display */}
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={selectedPhoto.url}
                    alt={`${getTypeText(selectedPhoto.type)} photo for ${selectedPhoto.jobTitle}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to placeholder if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const placeholder = target.nextElementSibling as HTMLElement;
                      if (placeholder) placeholder.style.display = 'flex';
                    }}
                  />
                  <div className="w-full h-full bg-gradient-to-br from-green-200 to-blue-200 flex items-center justify-center" style={{ display: 'none' }}>
                    <FileImage className="h-24 w-24 text-white" />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" data-testid="download-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download Full Size
                  </Button>
                  <Button variant="outline" data-testid="delete-photo">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Photo Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <Badge className={`${getTypeColor(selectedPhoto.type)} text-white`}>
                        {getTypeText(selectedPhoto.type)}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Captured:</span>
                      <span>{format(new Date(selectedPhoto.capturedAt), 'MMM dd, yyyy HH:mm')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Captured by:</span>
                      <span>{selectedPhoto.capturedBy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>File size:</span>
                      <span>{formatFileSize(selectedPhoto.fileSize)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dimensions:</span>
                      <span>
                        {selectedPhoto.dimensions ? 
                          `${selectedPhoto.dimensions.width} × ${selectedPhoto.dimensions.height}` : 
                          'Auto-detected'
                        }
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Job Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{selectedPhoto.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{selectedPhoto.location}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Notes</h4>
                  <Textarea
                    value={selectedPhoto.notes || ''}
                    placeholder="Add notes about this photo..."
                    className="min-h-[100px]"
                    data-testid="photo-notes"
                  />
                </div>
                
                <Button className="w-full" data-testid="save-notes">
                  Save Notes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}