/**
 * Settings page: edit an invoice or proposal template's block layout.
 *
 * Thin shell — the actual palette/canvas/inspector live in BlockBuilderSurface
 * so the same UI can be embedded inside the per-job proposal modal later.
 * This page owns: template loading, the save mutation, and the topbar.
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import {
  Eye,
  ChevronLeft,
  Save,
  LayoutTemplate,
  Monitor,
  Smartphone,
} from 'lucide-react';
import type {
  DocumentTemplate,
  DocumentBlock,
} from '@shared/schema';
import { DEFAULT_INVOICE_BLOCKS, DEFAULT_PROPOSAL_BLOCKS } from '@shared/schema';
import { BlockBuilderSurface, type DocumentKind } from '@/components/BlockBuilderSurface';

export type { DocumentKind };

const KIND_META: Record<DocumentKind, { title: string; defaultBlocks: DocumentBlock[] }> = {
  invoice: { title: 'Invoice Block Builder', defaultBlocks: DEFAULT_INVOICE_BLOCKS },
  proposal: { title: 'Proposal Block Builder', defaultBlocks: DEFAULT_PROPOSAL_BLOCKS },
};

export default function DocumentBuilderPage({ documentKind = 'invoice' }: { documentKind?: DocumentKind } = {}) {
  const { toast } = useToast();
  const meta = KIND_META[documentKind];
  const kindLabel = documentKind === 'invoice' ? 'Invoice' : 'Proposal';

  const { data: templatesRes, isLoading } = useQuery<{ success: boolean; data: DocumentTemplate[] }>({
    queryKey: ['/api/templates'],
    refetchOnWindowFocus: false,
  });

  const template = templatesRes?.data?.find((t) => t.type === documentKind) ?? null;

  const [blocks, setBlocks] = useState<DocumentBlock[] | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [deviceWidth, setDeviceWidth] = useState<'desktop' | 'mobile'>('desktop');

  const effectiveBlocks: DocumentBlock[] = blocks
    ?? (template?.blockConfig as DocumentBlock[] | null)
    ?? meta.defaultBlocks;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error(`No ${documentKind} template found`);
      return apiRequest('PUT', `/api/templates/${template.id}`, { blockConfig: effectiveBlocks });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      toast({ title: `${kindLabel} layout saved`, variant: 'default' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    },
  });

  const resetToDefault = useCallback(() => {
    setBlocks(meta.defaultBlocks);
  }, [meta.defaultBlocks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading template...</div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-gray-500">No {documentKind} template found. Please create one first.</div>
        <Link href="/templates">
          <Button variant="outline">Go to Templates</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white flex-shrink-0">
        <Link href="/settings">
          <Button size="icon" variant="ghost" aria-label="Back to settings">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <LayoutTemplate className="w-5 h-5 text-orange-500" />
          <div>
            <h1 className="font-semibold text-gray-900 leading-tight">{meta.title}</h1>
            <p className="text-xs text-gray-500 leading-tight">Drag blocks to reorder · Click to configure</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-md p-0.5" data-testid="builder-mode-toggle">
            <Button
              size="sm"
              variant={previewMode ? 'ghost' : 'secondary'}
              onClick={() => setPreviewMode(false)}
              className="h-7 px-3"
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant={previewMode ? 'secondary' : 'ghost'}
              onClick={() => setPreviewMode(true)}
              className="h-7 px-3"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              Customer view
            </Button>
          </div>
          <div className="flex items-center bg-gray-100 rounded-md p-0.5" data-testid="builder-device-toggle" title="Preview device width">
            <Button
              size="icon"
              variant={deviceWidth === 'desktop' ? 'secondary' : 'ghost'}
              onClick={() => setDeviceWidth('desktop')}
              className="h-7 w-7"
              title="Desktop"
            >
              <Monitor className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant={deviceWidth === 'mobile' ? 'secondary' : 'ghost'}
              onClick={() => setDeviceWidth('mobile')}
              className="h-7 w-7"
              title="Mobile"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={resetToDefault}>
            Reset to Default
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="btn-save-layout"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saveMutation.isPending ? 'Saving...' : 'Save Layout'}
          </Button>
        </div>
      </div>

      <BlockBuilderSurface
        blocks={effectiveBlocks}
        onBlocksChange={setBlocks}
        template={template}
        documentKind={documentKind}
        previewMode={previewMode}
        deviceWidth={deviceWidth}
      />
    </div>
  );
}
