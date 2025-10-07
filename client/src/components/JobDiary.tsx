import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  Plus, 
  Clock, 
  User, 
  MapPin, 
  Wrench, 
  Camera, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Cloud, 
  Shield, 
  Calendar,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Mail
} from "lucide-react";

interface JobDiaryEntry {
  id: string;
  jobId: string;
  entryType: string;
  title: string;
  description: string;
  authorName: string;
  authorRole?: string;
  photos?: string[];
  weatherConditions?: string;
  equipmentUsed?: string[];
  timeSpent?: number;
  progress?: number;
  tags?: string[];
  location?: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

interface JobDiaryProps {
  jobId: string;
  jobTitle?: string;
  compact?: boolean;
  onQuoteClick?: (quoteNumber: string) => void;
  onInvoiceClick?: (invoiceNumber: string) => void;
  onProposalClick?: (proposalNumber: string) => void;
}

const entryTypeConfig = {
  note: { icon: FileText, color: "bg-blue-100 text-blue-800", label: "Note" },
  progress: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Progress" },
  issue: { icon: AlertTriangle, color: "bg-red-100 text-red-800", label: "Issue" },
  milestone: { icon: Calendar, color: "bg-purple-100 text-purple-800", label: "Milestone" },
  weather: { icon: Cloud, color: "bg-gray-100 text-gray-800", label: "Weather" },
  equipment: { icon: Wrench, color: "bg-orange-100 text-orange-800", label: "Equipment" },
  safety: { icon: Shield, color: "bg-yellow-100 text-yellow-800", label: "Safety" },
  completion: { icon: CheckCircle, color: "bg-emerald-100 text-emerald-800", label: "Completion" },
  photo: { icon: Camera, color: "bg-indigo-100 text-indigo-800", label: "Photo" },
  email: { icon: Mail, color: "bg-cyan-100 text-cyan-800", label: "Email" }
};

export function JobDiary({ jobId, jobTitle, compact = false, onQuoteClick, onInvoiceClick, onProposalClick }: JobDiaryProps) {
  const [showNewEntryDialog, setShowNewEntryDialog] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [showPrivateEntries, setShowPrivateEntries] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; entryId: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch diary entries for this job
  const { data: diaryEntries, isLoading } = useQuery({
    queryKey: ['job-diary', jobId, filterType],
    queryFn: async () => {
      const url = filterType && filterType !== 'all'
        ? `/api/jobs/${jobId}/diary?entryType=${filterType}`
        : `/api/jobs/${jobId}/diary`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch diary entries');
      const result = await response.json();
      console.log('Diary entries loaded:', result.data.filter((e: any) => e.entryType === 'photo'));
      return result.data;
    }
  });

  // Create new diary entry mutation
  const createEntryMutation = useMutation({
    mutationFn: async (entryData: any) => {
      return await apiRequest('POST', `/api/jobs/${jobId}/diary`, entryData);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['job-diary', jobId] });
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      // Force refetch
      await queryClient.refetchQueries({ queryKey: ['/api/jobs'] });
      setShowNewEntryDialog(false);
      toast({
        title: "Success",
        description: "Diary entry created successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create diary entry",
        variant: "destructive"
      });
    }
  });

  // Delete diary entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return await apiRequest('DELETE', `/api/diary/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-diary', jobId] });
      toast({
        title: "Success",
        description: "Diary entry deleted successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete diary entry",
        variant: "destructive"
      });
    }
  });

  // Delete photo from diary entry mutation
  const deletePhotoMutation = useMutation({
    mutationFn: async ({ entryId, photoUrl }: { entryId: string; photoUrl: string }) => {
      return await apiRequest('DELETE', `/api/diary/${entryId}/photos`, { photoUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-diary', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Success",
        description: "Photo deleted successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete photo",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const entryData = {
      entryType: formData.get('entryType'),
      title: formData.get('title'),
      description: formData.get('description'),
      authorName: formData.get('authorName'),
      authorRole: formData.get('authorRole'),
      weatherConditions: formData.get('weatherConditions'),
      equipmentUsed: formData.get('equipmentUsed') ? 
        (formData.get('equipmentUsed') as string).split(',').map(s => s.trim()) : [],
      timeSpent: formData.get('timeSpent') ? parseInt(formData.get('timeSpent') as string) : undefined,
      progress: formData.get('progress') ? parseInt(formData.get('progress') as string) : undefined,
      location: formData.get('location'),
      isPrivate: formData.get('isPrivate') === 'on',
      tags: formData.get('tags') ? 
        (formData.get('tags') as string).split(',').map(s => s.trim()) : []
    };

    createEntryMutation.mutate(entryData);
  };

  const filteredEntries = (diaryEntries || []).filter((entry: JobDiaryEntry) => 
    showPrivateEntries || !entry.isPrivate
  );

  if (compact) {
    return (
      <>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Job Diary
              </div>
              <Button
                size="sm"
                onClick={() => setShowNewEntryDialog(true)}
                data-testid="button-add-diary-entry"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Entry
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="text-sm text-gray-500">Loading diary entries...</div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-sm text-gray-500">No diary entries yet</div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {filteredEntries.slice(0, 3).map((entry: JobDiaryEntry) => {
                  const config = entryTypeConfig[entry.entryType as keyof typeof entryTypeConfig] || entryTypeConfig.note;
                  const IconComponent = config.icon;
                  
                  return (
                    <div key={entry.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm">
                      <IconComponent className="h-4 w-4 mt-0.5 text-gray-600" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{entry.title}</span>
                          <Badge variant="secondary" className={`text-xs ${config.color}`}>
                            {config.label}
                          </Badge>
                          {entry.isPrivate && <EyeOff className="h-3 w-3 text-gray-400" />}
                        </div>
                        <div className="text-gray-600 text-xs truncate">{entry.description}</div>
                        <div className="text-gray-400 text-xs">
                          {entry.authorName} • {format(new Date(entry.createdAt), 'MMM dd, HH:mm')}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredEntries.length > 3 && (
                  <div className="text-xs text-gray-500 text-center">
                    +{filteredEntries.length - 3} more entries
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal Dialog for compact mode */}
        <Dialog open={showNewEntryDialog} onOpenChange={setShowNewEntryDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Diary Entry</DialogTitle>
              <DialogDescription>
                Record progress, notes, or important events for this job.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Entry Type</label>
                  <Select name="entryType" required>
                    <SelectTrigger data-testid="select-entry-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(entryTypeConfig).map(([type, config]) => (
                        <SelectItem key={type} value={type}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Author Name</label>
                  <Input 
                    name="authorName" 
                    placeholder="Your name" 
                    required 
                    data-testid="input-author-name"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Title</label>
                <Input 
                  name="title" 
                  placeholder="Brief description of entry" 
                  required 
                  data-testid="input-entry-title"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea 
                  name="description" 
                  placeholder="Detailed description of work performed, observations, or notes"
                  rows={3}
                  required
                  data-testid="textarea-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Author Role (Optional)</label>
                  <Select name="authorRole">
                    <SelectTrigger data-testid="select-author-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="foreman">Foreman</SelectItem>
                      <SelectItem value="technician">Technician</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Weather Conditions (Optional)</label>
                  <Select name="weatherConditions">
                    <SelectTrigger data-testid="select-weather">
                      <SelectValue placeholder="Weather" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sunny">Sunny</SelectItem>
                      <SelectItem value="cloudy">Cloudy</SelectItem>
                      <SelectItem value="rainy">Rainy</SelectItem>
                      <SelectItem value="windy">Windy</SelectItem>
                      <SelectItem value="stormy">Stormy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Equipment Used (Optional)</label>
                  <Input 
                    name="equipmentUsed" 
                    placeholder="Chainsaw, crane, truck (comma separated)"
                    data-testid="input-equipment"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Time Spent (Minutes)</label>
                  <Input 
                    name="timeSpent" 
                    type="number" 
                    placeholder="120"
                    data-testid="input-time-spent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Progress (%)</label>
                  <Input 
                    name="progress" 
                    type="number" 
                    min="0" 
                    max="100" 
                    placeholder="75"
                    data-testid="input-progress"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Location (Optional)</label>
                  <Input 
                    name="location" 
                    placeholder="Front yard, back garden"
                    data-testid="input-location"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Tags (Optional)</label>
                <Input 
                  name="tags" 
                  placeholder="safety, urgent, customer-request (comma separated)"
                  data-testid="input-tags"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  name="isPrivate" 
                  className="rounded"
                  data-testid="checkbox-private"
                />
                <label className="text-sm font-medium">Private entry (internal use only)</label>
              </div>

              <div className="flex justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowNewEntryDialog(false)}
                  data-testid="button-cancel-entry"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createEntryMutation.isPending}
                  data-testid="button-save-entry"
                >
                  {createEntryMutation.isPending ? 'Saving...' : 'Save Entry'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Job Diary</h2>
          {jobTitle && <p className="text-muted-foreground">{jobTitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40" data-testid="select-entry-type-filter">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(entryTypeConfig).map(([type, config]) => (
                <SelectItem key={type} value={type}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPrivateEntries(!showPrivateEntries)}
            data-testid="button-toggle-private"
          >
            {showPrivateEntries ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
            {showPrivateEntries ? 'Hide Private' : 'Show Private'}
          </Button>
          <Dialog open={showNewEntryDialog} onOpenChange={setShowNewEntryDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-diary-entry">
                <Plus className="h-4 w-4 mr-2" />
                New Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Diary Entry</DialogTitle>
                <DialogDescription>
                  Record progress, notes, or important events for this job.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Entry Type</label>
                    <Select name="entryType" required>
                      <SelectTrigger data-testid="select-entry-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(entryTypeConfig).map(([type, config]) => (
                          <SelectItem key={type} value={type}>{config.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Author Name</label>
                    <Input 
                      name="authorName" 
                      placeholder="Your name" 
                      required 
                      data-testid="input-author-name"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input 
                    name="title" 
                    placeholder="Brief description of the entry" 
                    required 
                    data-testid="input-title"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea 
                    name="description" 
                    placeholder="Detailed description of what happened, progress made, or issues encountered" 
                    required 
                    rows={4}
                    data-testid="textarea-description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Author Role</label>
                    <Select name="authorRole">
                      <SelectTrigger data-testid="select-author-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="foreman">Foreman</SelectItem>
                        <SelectItem value="technician">Technician</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="specialist">Specialist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Location (Optional)</label>
                    <Input 
                      name="location" 
                      placeholder="Specific area within job site" 
                      data-testid="input-location"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Time Spent (minutes)</label>
                    <Input 
                      name="timeSpent" 
                      type="number" 
                      placeholder="60" 
                      min="0"
                      data-testid="input-time-spent"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Progress (%)</label>
                    <Input 
                      name="progress" 
                      type="number" 
                      placeholder="75" 
                      min="0" 
                      max="100"
                      data-testid="input-progress"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Weather Conditions</label>
                    <Select name="weatherConditions">
                      <SelectTrigger data-testid="select-weather">
                        <SelectValue placeholder="Select weather" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sunny">Sunny</SelectItem>
                        <SelectItem value="cloudy">Cloudy</SelectItem>
                        <SelectItem value="rainy">Rainy</SelectItem>
                        <SelectItem value="windy">Windy</SelectItem>
                        <SelectItem value="stormy">Stormy</SelectItem>
                        <SelectItem value="foggy">Foggy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Equipment Used</label>
                    <Input 
                      name="equipmentUsed" 
                      placeholder="Crane, Chipper, Chainsaw (comma separated)" 
                      data-testid="input-equipment"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Tags</label>
                  <Input 
                    name="tags" 
                    placeholder="urgent, customer-request, safety (comma separated)" 
                    data-testid="input-tags"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    name="isPrivate" 
                    id="isPrivate" 
                    className="rounded border-gray-300"
                    data-testid="checkbox-private"
                  />
                  <label htmlFor="isPrivate" className="text-sm font-medium">
                    Private entry (internal use only)
                  </label>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowNewEntryDialog(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createEntryMutation.isPending}
                    data-testid="button-save-entry"
                  >
                    {createEntryMutation.isPending ? 'Saving...' : 'Save Entry'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading diary entries...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No diary entries yet</h3>
            <p className="text-gray-600 mb-4">Start documenting job progress, notes, and important events.</p>
            <Button onClick={() => setShowNewEntryDialog(true)} data-testid="button-add-first-entry">
              <Plus className="h-4 w-4 mr-2" />
              Add First Entry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry: JobDiaryEntry) => {
            const config = entryTypeConfig[entry.entryType as keyof typeof entryTypeConfig] || entryTypeConfig.note;
            const IconComponent = config.icon;
            
            // Detect document type and extract number
            const detectDocument = () => {
              const title = entry.title.toLowerCase();
              const desc = entry.description.toLowerCase();
              
              // Extract quote number (e.g., "QTE-3326")
              const quoteMatch = (entry.title + ' ' + entry.description).match(/QTE-\d+/i);
              if ((title.includes('quote') || desc.includes('quote')) && quoteMatch && onQuoteClick) {
                return { type: 'quote', number: quoteMatch[0], handler: () => onQuoteClick(quoteMatch[0]) };
              }
              
              // Extract invoice number (e.g., "INV-3326")
              const invoiceMatch = (entry.title + ' ' + entry.description).match(/INV-\d+/i);
              if ((title.includes('invoice') || desc.includes('invoice')) && invoiceMatch && onInvoiceClick) {
                return { type: 'invoice', number: invoiceMatch[0], handler: () => onInvoiceClick(invoiceMatch[0]) };
              }
              
              // Extract proposal number (e.g., "PROP-3326")
              const proposalMatch = (entry.title + ' ' + entry.description).match(/PROP-\d+/i);
              if ((title.includes('proposal') || desc.includes('proposal')) && proposalMatch && onProposalClick) {
                return { type: 'proposal', number: proposalMatch[0], handler: () => onProposalClick(proposalMatch[0]) };
              }
              
              return null;
            };
            
            const docInfo = detectDocument();
            const isClickable = !!docInfo;
            
            return (
              <Card 
                key={entry.id} 
                className={`relative ${isClickable ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
                onClick={() => docInfo?.handler()}
              >
                {/* Delete Button - Absolutely Positioned */}
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this diary entry?')) {
                      deleteEntryMutation.mutate(entry.id);
                    }
                  }}
                  className="absolute top-2 right-2 z-20 h-8 w-8"
                  data-testid={`button-delete-entry-${entry.id}`}
                  title="Delete entry"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                <CardContent className="p-6 pr-16">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className={`p-2 rounded-lg ${config.color}`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="text-lg font-semibold">{entry.title}</h3>
                        <Badge variant="secondary" className={config.color}>
                          {config.label}
                        </Badge>
                        {entry.isPrivate && (
                          <Badge variant="outline" className="text-xs">
                            <EyeOff className="h-3 w-3 mr-1" />
                            Private
                          </Badge>
                        )}
                        </div>
                        <p className="text-gray-700 mb-4">{entry.description}</p>
                        
                        {/* Photo Gallery */}
                        {entry.photos && entry.photos.length > 0 && (
                          <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Camera className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-700">
                                {entry.photos.length} {entry.photos.length === 1 ? 'Photo' : 'Photos'}
                              </span>
                            </div>
                            <div className="grid grid-cols-6 sm:grid-cols-6 md:grid-cols-8 gap-1">
                              {entry.photos.map((photo, index) => (
                                <div
                                  key={index}
                                  className="relative aspect-square rounded-md overflow-hidden bg-gray-100 group"
                                >
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelectedPhoto({ url: photo, entryId: entry.id })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setSelectedPhoto({ url: photo, entryId: entry.id });
                                      }
                                    }}
                                    className="w-full h-full hover-elevate active-elevate-2 active:opacity-80 transition-opacity cursor-pointer"
                                    data-testid={`button-view-photo-${index}`}
                                  >
                                    <img
                                      src={photo}
                                      alt={`Diary photo ${index + 1}`}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 active:bg-opacity-20 transition-opacity flex items-center justify-center pointer-events-none">
                                      <Eye className="h-5 w-5 text-white drop-shadow-lg opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </div>
                                  {/* Delete Photo Button - Always visible on mobile, hover on desktop */}
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm('Delete this photo from the diary entry?')) {
                                        deletePhotoMutation.mutate({
                                          entryId: entry.id,
                                          photoUrl: photo
                                        });
                                      }
                                    }}
                                    className="absolute top-0.5 right-0.5 h-5 w-5 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10"
                                    data-testid={`button-delete-photo-${index}`}
                                    title="Delete photo"
                                    disabled={deletePhotoMutation.isPending}
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4 text-gray-400" />
                            <span>{entry.authorName}</span>
                            {entry.authorRole && (
                              <span className="text-gray-500">({entry.authorRole})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span>{format(new Date(entry.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                          </div>
                          {entry.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <span>{entry.location}</span>
                            </div>
                          )}
                          {entry.timeSpent && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span>{entry.timeSpent} minutes</span>
                            </div>
                          )}
                        </div>

                        {(entry.progress !== undefined || entry.weatherConditions || entry.equipmentUsed?.length || entry.tags?.length) && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              {entry.progress !== undefined && (
                                <div>
                                  <span className="text-gray-500">Progress:</span>
                                  <span className="ml-1 font-medium">{entry.progress}%</span>
                                </div>
                              )}
                              {entry.weatherConditions && (
                                <div className="flex items-center gap-1">
                                  <Cloud className="h-4 w-4 text-gray-400" />
                                  <span className="capitalize">{entry.weatherConditions}</span>
                                </div>
                              )}
                              {entry.equipmentUsed?.length && (
                                <div className="flex items-center gap-1">
                                  <Wrench className="h-4 w-4 text-gray-400" />
                                  <span>{entry.equipmentUsed.join(', ')}</span>
                                </div>
                              )}
                              {entry.tags?.length && (
                                <div className="flex flex-wrap gap-1">
                                  {entry.tags.map((tag, index) => (
                                    <Badge key={index} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Full-Page Photo View */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4 sm:p-8"
          onClick={() => setSelectedPhoto(null)}
          data-testid="fullpage-photo-overlay"
        >
          {/* Close Button */}
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 bg-white/10 text-white rounded-full p-3 sm:p-3 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition-colors touch-manipulation"
            data-testid="button-close-photo"
            aria-label="Close photo"
          >
            <svg className="w-6 h-6 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this photo from the diary entry?')) {
                deletePhotoMutation.mutate({
                  entryId: selectedPhoto.entryId,
                  photoUrl: selectedPhoto.url
                });
                setSelectedPhoto(null);
              }
            }}
            className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 bg-red-600 text-white rounded-full p-3 sm:p-3 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-red-700 active:bg-red-800 transition-colors touch-manipulation"
            data-testid="button-delete-fullscreen-photo"
            aria-label="Delete photo"
            disabled={deletePhotoMutation.isPending}
          >
            <Trash2 className="w-5 h-5 sm:w-5 sm:h-5" />
          </button>

          <img
            src={selectedPhoto.url}
            alt="Full size diary photo"
            className="max-w-full max-h-full w-auto h-auto object-contain touch-manipulation"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
          />
        </div>
      )}
    </div>
  );
}