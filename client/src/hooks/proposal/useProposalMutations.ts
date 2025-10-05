import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { UploadedPhoto } from "@/types/proposal";

export function useProposalMutations(jobId?: string, onSuccess?: () => void) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createProposal = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/proposals', data);
      return response;
    },
    onSuccess: (response: any) => {
      toast({
        title: "Success",
        description: `Proposal created successfully! Proposal Number: ${response?.proposalNumber || 'N/A'}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      if (jobId) {
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'diary-timeline'] });
      }
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create proposal",
        variant: "destructive",
      });
    },
  });

  const uploadPhotos = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!jobId) throw new Error('Job ID required for photo upload');
      
      const response = await fetch(`/api/jobs/${jobId}/photos`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(errorData.message || 'Upload failed');
      }
      
      const data = await response.json();
      
      return data.photos?.map((photoUrl: string, index: number) => ({
        id: `job-photo-${Date.now()}-${index}`,
        url: photoUrl,
        filename: photoUrl.split('/').pop() || `photo-${index}`,
        type: 'before',
        category: 'documentation',
        capturedAt: new Date().toISOString(),
      })) || [];
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Photos uploaded successfully" });
      if (jobId) {
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload photos",
        variant: "destructive",
      });
    },
  });

  const sendEmail = useMutation({
    mutationFn: async (emailData: { 
      proposalId: string; 
      to: string; 
      subject: string; 
      message?: string; 
      cc?: string 
    }) => {
      return await apiRequest('POST', `/api/proposals/${emailData.proposalId}/send-email`, {
        to: emailData.to,
        subject: emailData.subject,
        message: emailData.message,
        cc: emailData.cc
      });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Email Sent",
        description: `Proposal email sent successfully to ${variables.to}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Email Failed",
        description: error.message || "Failed to send proposal email",
        variant: "destructive"
      });
    }
  });

  return {
    createProposal,
    uploadPhotos,
    sendEmail,
  };
}
