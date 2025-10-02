import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  MessageSquare,
  Mail,
  FileText,
  StickyNote,
  Phone,
  Paperclip,
  Send,
  Plus,
  User,
  Clock,
  Settings,
  CheckCircle,
  Presentation,
  ExternalLink,
  MoreHorizontal,
  Edit,
  Save,
  X,
  Camera,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from "lucide-react";
import { ProposalBuilder } from "@/components/ProposalBuilder";
// ServiceM8 API response types (matches server/services/servicem8-api.ts)
interface ServiceM8DiaryEntry {
  id: string;
  jobUuid: string;
  staffUuid: string | null;
  entryType: string | null;
  note: string | null;
  objectUuid: string | null;
  entryDate: Date | null;
  createdAt: Date | null;
  active: boolean;
}

// Types for diary entries
interface DiaryEntry {
  id: string;
  type: 'note' | 'sms' | 'email' | 'job_event' | 'proposal' | 'call' | 'photo';
  title: string;
  content: string;
  author: string;
  timestamp: string;
  photoUrl?: string;
  metadata?: {
    phoneNumber?: string;
    emailAddress?: string;
    proposalNumber?: string;
    eventType?: string;
    status?: string;
  };
}

// Form schemas
const noteSchema = z.object({
  content: z.string().min(1, "Note content is required"),
  isPrivate: z.boolean().optional()
});

const smsSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  message: z.string().min(1, "Message content is required")
});

const emailSchema = z.object({
  to: z.string().email("Valid email address is required"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message content is required")
});

type NoteFormData = z.infer<typeof noteSchema>;
type SMSFormData = z.infer<typeof smsSchema>;
type EmailFormData = z.infer<typeof emailSchema>;

interface JobDiarySectionProps {
  jobId: string;
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  className?: string;
  onQuoteClick?: (quoteNumber: string) => void;
  onInvoiceClick?: (invoiceNumber: string) => void;
  onProposalClick?: (proposalNumber: string) => void;
}

export function JobDiarySection({ 
  jobId, 
  customerId, 
  customerEmail, 
  customerPhone,
  className,
  onQuoteClick,
  onInvoiceClick,
  onProposalClick
}: JobDiarySectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeComposer, setActiveComposer] = useState<'note' | 'sms' | 'email' | null>(null);
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState<number | null>(null);
  const quickNoteInputRef = React.useRef<HTMLInputElement>(null);
  
  // Forms
  const noteForm = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: { content: "", isPrivate: false }
  });
  
  const smsForm = useForm<SMSFormData>({
    resolver: zodResolver(smsSchema),
    defaultValues: { phoneNumber: customerPhone || "", message: "" }
  });
  
  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { to: customerEmail || "", subject: "", message: "" }
  });

  // Force cache invalidation on mobile devices to prevent stale data
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (isMobile) {
      // On mobile, aggressively invalidate all diary caches on mount
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'diary-timeline'] });
      queryClient.removeQueries({ queryKey: ['/api/jobs', jobId, 'diary-timeline'] });
    }
  }, [isMobile, jobId, queryClient]);

  // Check for bootstrap data (from index.html pre-fetch)
  const bootstrapData = (window as any).__DIARY_BOOTSTRAP__;
  const hasBootstrap = bootstrapData?.jobId === jobId && bootstrapData?.data;
  
  useEffect(() => {
    if (hasBootstrap) {
      console.log('✅ Using bootstrap diary data:', bootstrapData.data.length, 'entries');
    }
  }, [hasBootstrap, bootstrapData]);

  // Fetch diary entries (combining local and ServiceM8 sources)
  const { data: diaryEntries = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/jobs', jobId, 'diary-timeline'],
    // Use bootstrap data as initial data if available
    initialData: hasBootstrap ? (() => {
      console.log('🚀 Seeding React Query with bootstrap data');
      // Transform bootstrap data to DiaryEntry format
      return bootstrapData.data.map((entry: any) => ({
        id: entry.id,
        type: entry.entryType || 'note',
        title: entry.title,
        content: entry.description,
        author: entry.authorName || 'System',
        timestamp: entry.createdAt,
        photoUrl: entry.photoUrl || (entry.photos && entry.photos[0]),
        metadata: entry.metadata || {}
      }));
    })() : undefined,
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache in memory
    refetchOnMount: 'always', // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when window regains focus
    networkMode: 'always', // CRITICAL: Force query on iOS PWAs that falsely report offline
    retry: true,
    retryOnMount: true,
    queryFn: async (): Promise<DiaryEntry[]> => {
      // Add cache-busting timestamp to force fresh data
      const timestamp = Date.now();
      
      const [localResponse, servicem8Response] = await Promise.all([
        // Fetch local diary data (original endpoints)
        Promise.all([
          apiRequest('GET', `/api/jobs/${jobId}/diary?_t=${timestamp}`).then(res => res.json()),
          apiRequest('GET', `/api/communications?jobId=${jobId}&_t=${timestamp}`).then(res => res.json()),
          apiRequest('GET', `/api/proposals?jobId=${jobId}&_t=${timestamp}`).then(res => res.json())
        ]),
        // Fetch ServiceM8 diary data (with error handling)
        apiRequest('GET', `/api/servicem8/jobs/${jobId}/diary?_t=${timestamp}`).then(res => res.json()).catch(() => ({ data: [] }))
      ]);

      const [diaryResponse, communicationsResponse, proposalsResponse] = localResponse;
      const entries: DiaryEntry[] = [];
      
      // Add local diary entries
      if (diaryResponse.data) {
        diaryResponse.data.forEach((entry: any) => {
          const photoUrl = entry.photos && entry.photos.length > 0 ? entry.photos[0] : undefined;
          
          entries.push({
            id: entry.id,
            type: entry.entryType === 'note' ? 'note' : 
                  entry.entryType === 'proposal' ? 'proposal' : 
                  entry.entryType === 'photo' ? 'photo' :
                  entry.entryType === 'email' ? 'email' :
                  'job_event',
            title: entry.title,
            content: entry.description,
            author: entry.authorName || 'System',
            timestamp: entry.createdAt,
            photoUrl: photoUrl,
            metadata: {
              eventType: entry.entryType,
              proposalNumber: entry.entryType === 'proposal' ? 
                entry.title.replace('Proposal Created: ', '') : undefined
            }
          });
        });
      }
      
      // Add local communications
      if (communicationsResponse.data) {
        communicationsResponse.data.forEach((comm: any) => {
          entries.push({
            id: comm.id,
            type: comm.type === 'email' ? 'email' : 'sms',
            title: comm.subject || `${comm.type.toUpperCase()} Message`,
            content: comm.content || comm.message,
            author: comm.sender || 'System',
            timestamp: comm.createdAt || comm.timestamp,
            metadata: {
              phoneNumber: comm.phoneNumber,
              emailAddress: comm.emailAddress
            }
          });
        });
      }
      
      // Add local proposals
      if (proposalsResponse.data) {
        proposalsResponse.data.forEach((proposal: any) => {
          entries.push({
            id: proposal.id,
            type: 'proposal',
            title: `Proposal Created: ${proposal.proposalNumber}`,
            content: proposal.title || proposal.description,
            author: proposal.createdBy || 'System',
            timestamp: proposal.createdAt,
            metadata: {
              proposalNumber: proposal.proposalNumber,
              status: proposal.status
            }
          });
        });
      }

      // Add ServiceM8 diary entries if available
      if (servicem8Response.data && servicem8Response.data.length > 0) {
        servicem8Response.data.forEach((entry: ServiceM8DiaryEntry) => {
          const entryDate = entry.entryDate ? new Date(entry.entryDate) : null;
          
          entries.push({
            id: `servicem8-${entry.id}`, // Prefix to avoid ID conflicts
            type: entry.entryType === 'Note' ? 'note' : 
                  entry.entryType === 'Scheduled' ? 'job_event' : 
                  entry.entryType === 'Completed' ? 'job_event' : 
                  entry.entryType === 'CallLog' ? 'call' : 'note',
            title: entry.entryType === 'Note' ? 'ServiceM8 Note' : 
                   entry.entryType === 'Scheduled' ? 'ServiceM8 Scheduled' :
                   entry.entryType === 'Completed' ? 'ServiceM8 Completed' : 
                   entry.entryType === 'CallLog' ? 'ServiceM8 Call' :
                   'ServiceM8 Entry',
            content: entry.note || 'No content',
            author: 'ServiceM8 User',
            timestamp: entryDate?.toISOString() || (entry.createdAt ? new Date(entry.createdAt).toISOString() : new Date().toISOString()),
            metadata: {
              eventType: entry.entryType || undefined,
              status: entry.active ? 'active' : 'inactive'
            }
          });
        });
      }
      
      // Sort by timestamp (newest first)
      return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },
  });

  // Collect all photos from diary entries for gallery view
  const allPhotos = React.useMemo(() => {
    const photos: string[] = [];
    diaryEntries.forEach(entry => {
      if (entry.photoUrl) {
        photos.push(entry.photoUrl);
      }
    });
    return photos;
  }, [diaryEntries]);

  // Function to handle opening proposals from diary entries
  const handleOpenProposal = async (proposalNumber: string) => {
    if (onProposalClick) {
      onProposalClick(proposalNumber);
      return;
    }
    
    try {
      // Fallback: Fetch all proposals and find the one with matching proposal number
      const response = await apiRequest('GET', '/api/proposals').then(res => res.json());
      const proposal = response.data?.find((p: any) => p.proposalNumber === proposalNumber);
      
      if (proposal) {
        setSelectedProposalId(proposal.id);
        setProposalDialogOpen(true);
      } else {
        toast({
          title: "Error",
          description: "Proposal not found",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error finding proposal:', error);
      toast({
        title: "Error", 
        description: "Failed to open proposal",
        variant: "destructive"
      });
    }
  };

  // Helper function to extract document numbers from diary entries
  const extractDocumentInfo = (entry: DiaryEntry) => {
    const content = `${entry.title} ${entry.content}`.toLowerCase();
    
    // Check for quote
    const quoteMatch = (entry.title + ' ' + entry.content).match(/QTE-\d+/i);
    if ((content.includes('quote') || content.includes('qte-')) && quoteMatch) {
      return { type: 'quote', number: quoteMatch[0] };
    }
    
    // Check for invoice
    const invoiceMatch = (entry.title + ' ' + entry.content).match(/INV-\d+/i);
    if ((content.includes('invoice') || content.includes('inv-')) && invoiceMatch) {
      return { type: 'invoice', number: invoiceMatch[0] };
    }
    
    // Check for proposal
    if (entry.type === 'proposal' && entry.metadata?.proposalNumber) {
      return { type: 'proposal', number: entry.metadata.proposalNumber };
    }
    
    return null;
  };

  // Mutations
  const createNoteMutation = useMutation({
    mutationFn: async (data: NoteFormData) => {
      return apiRequest('POST', `/api/jobs/${jobId}/diary`, {
        entryType: 'note',
        title: 'Job Note',
        description: data.content,
        authorName: 'Current User', // Replace with actual user
        isPrivate: data.isPrivate
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Note added successfully" });
      noteForm.reset();
      setActiveComposer(null);
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'diary-timeline'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add note",
        variant: "destructive"
      });
    }
  });

  const sendSMSMutation = useMutation({
    mutationFn: async (data: SMSFormData) => {
      // This would integrate with your existing SMS service
      return apiRequest('POST', '/api/communications/sms', {
        jobId,
        customerId,
        phoneNumber: data.phoneNumber,
        message: data.message
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "SMS sent successfully" });
      smsForm.reset();
      setActiveComposer(null);
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'diary-timeline'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to send SMS",
        variant: "destructive"
      });
    }
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (data: EmailFormData) => {
      // This would integrate with your existing email service
      return apiRequest('POST', '/api/communications/email', {
        jobId,
        customerId,
        to: data.to,
        subject: data.subject,
        message: data.message
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Email sent successfully" });
      emailForm.reset();
      setActiveComposer(null);
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'diary-timeline'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to send email",
        variant: "destructive"
      });
    }
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ entryId, content }: { entryId: string; content: string }) => {
      return apiRequest('PUT', `/api/diary/${entryId}`, {
        description: content
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Note updated successfully" });
      setEditingEntryId(null);
      setEditingContent("");
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'diary-timeline'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update note",
        variant: "destructive"
      });
    }
  });

  // Helper functions
  const getEntryIcon = (type: DiaryEntry['type']) => {
    switch (type) {
      case 'note': return <StickyNote className="w-4 h-4" />;
      case 'sms': return <MessageSquare className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'job_event': return <CheckCircle className="w-4 h-4" />;
      case 'proposal': return <Presentation className="w-4 h-4" />;
      case 'call': return <Phone className="w-4 h-4" />;
      case 'photo': return <Camera className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getEntryColor = (type: DiaryEntry['type']) => {
    switch (type) {
      case 'note': return "bg-yellow-100 text-yellow-800";
      case 'sms': return "bg-blue-100 text-blue-800";
      case 'email': return "bg-gray-100 text-gray-800";
      case 'job_event': return "bg-green-100 text-green-800";
      case 'proposal': return "bg-purple-100 text-purple-800";
      case 'call': return "bg-orange-100 text-orange-800";
      case 'photo': return "bg-indigo-100 text-indigo-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Format phone number for display
    if (phone.length === 13 && phone.startsWith('+64')) {
      return `${phone.substring(0, 3)} ${phone.substring(3, 5)} ${phone.substring(5, 8)} ${phone.substring(8)}`;
    }
    return phone;
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Job Diary</h3>
          <div className="flex gap-1">
            <Button 
              size="icon" 
              variant="ghost"
              onClick={() => {
                queryClient.removeQueries({ queryKey: ['/api/jobs', jobId, 'diary-timeline'] });
                refetch();
              }}
              data-testid="button-refresh-diary"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Quick Note Input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <StickyNote className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              ref={quickNoteInputRef}
              placeholder="Type a job note here..."
              className="pl-10 pr-10"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  createNoteMutation.mutate({ content: e.currentTarget.value.trim() });
                  e.currentTarget.value = '';
                }
              }}
              data-testid="input-quick-note"
            />
            <Button 
              size="icon" 
              variant="ghost" 
              className="absolute right-1 top-1/2 transform -translate-y-1/2"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
          </div>
          <Button 
            size="icon"
            variant="ghost"
            onClick={() => {
              const input = quickNoteInputRef.current;
              if (input && input.value.trim()) {
                // Submit the quick note if there's content
                createNoteMutation.mutate({ content: input.value.trim() });
                input.value = '';
              } else {
                // Open composer modal if no content
                setActiveComposer('note');
              }
            }}
            data-testid="button-add-note"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading diary entries...</div>
          </div>
        ) : diaryEntries.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">No diary entries yet</div>
          </div>
        ) : (
          <div className="space-y-4">
            {diaryEntries.map((entry) => {
              const docInfo = extractDocumentInfo(entry);
              const isClickable = docInfo && (
                (docInfo.type === 'quote' && onQuoteClick) ||
                (docInfo.type === 'invoice' && onInvoiceClick) ||
                (docInfo.type === 'proposal' && (onProposalClick || true))
              );
              
              const handleEntryClick = () => {
                if (!docInfo) return;
                
                if (docInfo.type === 'quote' && onQuoteClick) {
                  onQuoteClick(docInfo.number);
                } else if (docInfo.type === 'invoice' && onInvoiceClick) {
                  onInvoiceClick(docInfo.number);
                } else if (docInfo.type === 'proposal') {
                  handleOpenProposal(docInfo.number);
                }
              };
              
              return (
                <div key={entry.id} className="flex gap-3" data-testid={`diary-entry-${entry.type}`}>
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getEntryColor(entry.type)} flex-shrink-0`}>
                    {getEntryIcon(entry.type)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div 
                      className={`bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border ${isClickable ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
                      onClick={isClickable ? handleEntryClick : undefined}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                          {entry.type === 'sms' && entry.metadata?.phoneNumber && (
                            <>SMS Message to {formatPhoneNumber(entry.metadata.phoneNumber)}</>
                          )}
                          {entry.type === 'email' && entry.metadata?.emailAddress && (
                            <>Email to {entry.metadata.emailAddress}</>
                          )}
                          {entry.type === 'note' && <>Note</>}
                          {entry.type === 'job_event' && <>Job Created</>}
                          {entry.type === 'proposal' && entry.metadata?.proposalNumber && (
                            <>Proposal {entry.metadata.proposalNumber}</>
                          )}
                          {entry.type === 'photo' && (
                            <><Camera className="w-4 h-4 inline mr-1" />Photo Added</>
                          )}
                        </h4>
                        {entry.type === 'note' && editingEntryId !== entry.id && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEntryId(entry.id);
                              setEditingContent(entry.content);
                            }}
                            data-testid={`button-edit-entry-${entry.id}`}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(entry.timestamp), 'h:mm a dd/MM/yyyy')}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            by {entry.author}
                          </span>
                        </div>
                        {entry.type === 'email' && entry.metadata?.emailAddress && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveComposer('email');
                              // Pre-fill email address for reply
                              if (entry.metadata?.emailAddress) {
                                // Store the reply-to email in a ref or state if needed
                                setTimeout(() => {
                                  const emailInput = document.querySelector('[data-testid="input-email-to"]') as HTMLInputElement;
                                  if (emailInput) emailInput.value = entry.metadata?.emailAddress || '';
                                }, 100);
                              }
                            }}
                            data-testid={`button-reply-email-${entry.id}`}
                          >
                            <Mail className="w-3 h-3 mr-1" />
                            Reply
                          </Button>
                        )}
                      </div>
                      
                      {editingEntryId === entry.id ? (
                        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                          <Textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="text-sm min-h-[80px]"
                            placeholder="Edit note content..."
                            data-testid="textarea-edit-note"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateNoteMutation.mutate({ entryId: entry.id, content: editingContent });
                              }}
                              disabled={updateNoteMutation.isPending || !editingContent.trim()}
                              data-testid="button-save-edit"
                            >
                              <Save className="w-3 h-3 mr-1" />
                              {updateNoteMutation.isPending ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEntryId(null);
                                setEditingContent("");
                              }}
                              data-testid="button-cancel-edit"
                            >
                              <X className="w-3 h-3 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            {entry.content}
                          </div>
                          
                          {entry.type === 'photo' && entry.photoUrl && (
                            <div className="mt-3">
                              <img 
                                src={entry.photoUrl} 
                                alt="Job photo" 
                                className="max-w-full h-auto rounded-lg cursor-pointer hover-elevate"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const photoIndex = allPhotos.indexOf(entry.photoUrl || '');
                                  setViewingPhotoIndex(photoIndex >= 0 ? photoIndex : 0);
                                }}
                                onError={(e) => {
                                  console.error('Image failed to load:', entry.photoUrl);
                                  e.currentTarget.style.display = 'none';
                                }}
                                onLoad={() => {
                                  console.log('Image loaded successfully:', entry.photoUrl);
                                }}
                                data-testid="img-diary-photo"
                              />
                              <div className="text-xs text-gray-500 mt-1">
                                Photo URL: {entry.photoUrl}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      
                      {entry.type === 'proposal' && (
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {entry.metadata?.status || 'draft'}
                          </Badge>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-xs h-6"
                            onClick={() => entry.metadata?.proposalNumber && handleOpenProposal(entry.metadata.proposalNumber)}
                            data-testid="button-view-proposal"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View Proposal
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Quick Actions */}
      <div className="flex-shrink-0 p-4 border-t bg-gray-50 dark:bg-gray-900">
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setActiveComposer('sms')}
            disabled={!customerPhone}
            data-testid="button-send-sms"
          >
            <MessageSquare className="w-4 h-4 mr-1" />
            SMS
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setActiveComposer('email')}
            disabled={!customerEmail}
            data-testid="button-send-email"
          >
            <Mail className="w-4 h-4 mr-1" />
            Email
          </Button>
          <Button size="sm" variant="outline" data-testid="button-call-customer">
            <Phone className="w-4 h-4 mr-1" />
            Call
          </Button>
        </div>
      </div>

      {/* Composer Dialogs */}
      <Dialog open={activeComposer === 'note'} onOpenChange={() => setActiveComposer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Job Note</DialogTitle>
            <DialogDescription>Add a detailed note to the job diary</DialogDescription>
          </DialogHeader>
          <Form {...noteForm}>
            <form onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              noteForm.handleSubmit((data) => createNoteMutation.mutate(data))(e);
            }} className="space-y-4">
              <FormField
                control={noteForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Enter your note here..."
                        rows={4}
                        data-testid="textarea-note-content"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setActiveComposer(null)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createNoteMutation.isPending}
                  data-testid="button-save-note"
                >
                  {createNoteMutation.isPending ? 'Adding...' : 'Add Note'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={activeComposer === 'sms'} onOpenChange={() => setActiveComposer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send SMS</DialogTitle>
            <DialogDescription>Send an SMS message to the customer</DialogDescription>
          </DialogHeader>
          <Form {...smsForm}>
            <form onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              smsForm.handleSubmit((data) => sendSMSMutation.mutate(data))(e);
            }} className="space-y-4">
              <FormField
                control={smsForm.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="+64 21 000 0000"
                        data-testid="input-sms-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={smsForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Enter your message..."
                        rows={3}
                        maxLength={160}
                        data-testid="textarea-sms-message"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setActiveComposer(null)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={sendSMSMutation.isPending}
                  data-testid="button-send-sms-submit"
                >
                  {sendSMSMutation.isPending ? 'Sending...' : 'Send SMS'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={activeComposer === 'email'} onOpenChange={() => setActiveComposer(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
            <DialogDescription>Send an email to the customer</DialogDescription>
          </DialogHeader>
          <Form {...emailForm}>
            <form onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              emailForm.handleSubmit((data) => sendEmailMutation.mutate(data))(e);
            }} className="space-y-4">
              <FormField
                control={emailForm.control}
                name="to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="customer@example.com"
                        type="email"
                        data-testid="input-email-to"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={emailForm.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Job Update"
                        data-testid="input-email-subject"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={emailForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Enter your message..."
                        rows={6}
                        data-testid="textarea-email-message"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setActiveComposer(null)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={sendEmailMutation.isPending}
                  data-testid="button-send-email-submit"
                >
                  {sendEmailMutation.isPending ? 'Sending...' : 'Send Email'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Proposal Builder Dialog */}
      {selectedProposalId && (
        <ProposalBuilder
          isOpen={proposalDialogOpen}
          onClose={() => {
            setProposalDialogOpen(false);
            setSelectedProposalId(null);
          }}
          jobId={jobId}
          customerId={customerId}
          mode="edit"
          proposalId={selectedProposalId}
        />
      )}

      {/* Photo Viewer Modal with Gallery Navigation */}
      <Dialog open={viewingPhotoIndex !== null} onOpenChange={(open) => !open && setViewingPhotoIndex(null)}>
        <DialogContent className="max-w-6xl w-full p-0 h-[90vh] flex flex-col">
          <DialogHeader className="p-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Job Photos</DialogTitle>
                <DialogDescription>
                  {viewingPhotoIndex !== null && `Photo ${viewingPhotoIndex + 1} of ${allPhotos.length}`}
                </DialogDescription>
              </div>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setViewingPhotoIndex(null)}
                data-testid="button-close-photo"
              >
                Close
              </Button>
            </div>
          </DialogHeader>
          
          {viewingPhotoIndex !== null && allPhotos[viewingPhotoIndex] && (
            <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
              {/* Previous Button */}
              {allPhotos.length > 1 && viewingPhotoIndex > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white"
                  onClick={() => setViewingPhotoIndex(viewingPhotoIndex - 1)}
                  data-testid="button-previous-photo"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
              )}
              
              {/* Photo */}
              <img 
                src={allPhotos[viewingPhotoIndex]} 
                alt={`Job photo ${viewingPhotoIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded-lg"
                data-testid="img-photo-viewer"
              />
              
              {/* Next Button */}
              {allPhotos.length > 1 && viewingPhotoIndex < allPhotos.length - 1 && (
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white"
                  onClick={() => setViewingPhotoIndex(viewingPhotoIndex + 1)}
                  data-testid="button-next-photo"
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              )}
            </div>
          )}
          
          <div className="p-4 border-t flex-shrink-0 flex gap-2">
            <Button 
              className="flex-1" 
              onClick={() => {
                if (viewingPhotoIndex !== null && allPhotos[viewingPhotoIndex]) {
                  const link = document.createElement('a');
                  link.href = allPhotos[viewingPhotoIndex];
                  link.download = `job-photo-${viewingPhotoIndex + 1}-${Date.now()}.jpg`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }
              }}
              data-testid="button-download-photo"
            >
              Download Photo
            </Button>
            
            {/* Photo Counter and Navigation Dots */}
            {allPhotos.length > 1 && (
              <div className="flex items-center gap-2 px-4">
                {allPhotos.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setViewingPhotoIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === viewingPhotoIndex 
                        ? 'bg-primary w-6' 
                        : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                    data-testid={`button-photo-dot-${index}`}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}