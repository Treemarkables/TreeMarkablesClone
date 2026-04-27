import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  MessageSquare,
  Camera,
  Loader2,
  Upload,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Sparkles,
  X,
  Check,
} from "lucide-react";

interface ExtractedLeadData {
  name: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  rawMessage?: string;
}

interface CreateLeadFromMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadCreated: (data: ExtractedLeadData) => void;
}

export function CreateLeadFromMessageDialog({
  open,
  onOpenChange,
  onLeadCreated,
}: CreateLeadFromMessageDialogProps) {
  const [activeTab, setActiveTab] = useState<"paste" | "screenshot">("paste");
  const [messageText, setMessageText] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedLeadData | null>(
    null,
  );
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Handle clipboard paste for screenshots - works from ANY tab
  useEffect(() => {
    if (!open) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      const files = e.clipboardData?.files;

      let imageFile: File | null = null;

      if (items) {
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              imageFile = file;
              break;
            }
          }
        }
      }

      if (!imageFile && files) {
        for (const file of Array.from(files)) {
          if (file.type.startsWith("image/")) {
            imageFile = file;
            break;
          }
        }
      }

      if (!imageFile) return;

      // Claim the paste so no other handler (e.g. GlobalJobCard) also grabs it
      e.preventDefault();
      e.stopImmediatePropagation();

      setSelectedImage(imageFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(imageFile);
      setExtractedData(null);
      setActiveTab("screenshot");
    };

    // Capture phase + window target so we run before document-level handlers
    // registered by other open modals.
    window.addEventListener("paste", handlePaste, { capture: true });
    return () =>
      window.removeEventListener("paste", handlePaste, { capture: true });
  }, [open]);

  const extractFromTextMutation = useMutation({
    mutationFn: async (data: { message: string; phone?: string }) => {
      const response = await apiRequest(
        "POST",
        "/api/leads/extract-from-message",
        data,
      );
      return response.json();
    },
    onSuccess: (response: any) => {
      if (response.success && response.data) {
        setExtractedData(response.data);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Extraction Failed",
        description: error.message || "Could not extract details from message",
        variant: "destructive",
      });
    },
  });

  const extractFromScreenshotMutation = useMutation({
    mutationFn: async (imageBase64: string) => {
      console.log("📸 Starting extraction API call...");
      const response = await apiRequest(
        "POST",
        "/api/leads/extract-from-screenshot",
        { image: imageBase64 },
      );
      const result = await response.json();
      console.log("📸 API response received:", JSON.stringify(result));
      return result;
    },
    onSuccess: (response: any) => {
      console.log("📸 onSuccess called with:", JSON.stringify(response));
      // Check for data - response might already be the data object
      const extractedInfo = response?.data || response;

      // Check if we got any useful data (non-empty strings)
      const hasName = extractedInfo?.name && extractedInfo.name.trim() !== "";
      const hasPhone =
        extractedInfo?.phone && extractedInfo.phone.trim() !== "";
      const hasEmail =
        extractedInfo?.email && extractedInfo.email.trim() !== "";
      const hasAddress =
        extractedInfo?.address && extractedInfo.address.trim() !== "";
      const hasDescription =
        extractedInfo?.description && extractedInfo.description.trim() !== "";

      if (hasName || hasPhone || hasEmail || hasAddress || hasDescription) {
        console.log(
          "📸 Extraction successful, auto-creating lead:",
          extractedInfo,
        );
        // Close dialog and create lead
        setMessageText("");
        setManualPhone("");
        setSelectedImage(null);
        setImagePreview(null);
        setExtractedData(null);
        onOpenChange(false);
        onLeadCreated(extractedInfo);
      } else {
        // Still show extracted data state so user can see what happened
        console.log("📸 No useful data extracted:", response);
        setExtractedData(extractedInfo);
        toast({
          title: "No Details Found",
          description:
            "The AI couldn't read the image. Make sure it's a clear screenshot of just the SMS conversation (not a screenshot-in-screenshot).",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.log("📸 onError called:", error);
      toast({
        title: "Extraction Failed",
        description:
          error.message || "Could not extract details from screenshot",
        variant: "destructive",
      });
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setExtractedData(null);
    }
  };

  const handleExtractFromText = () => {
    if (!messageText.trim()) {
      toast({
        title: "No Message",
        description: "Please paste the customer's message first",
        variant: "destructive",
      });
      return;
    }
    extractFromTextMutation.mutate({
      message: messageText,
      phone: manualPhone || undefined,
    });
  };

  const handleExtractFromScreenshot = async () => {
    // Use imagePreview directly if available (from paste), or read from selectedImage
    if (imagePreview) {
      // imagePreview is already a base64 data URL
      const base64 = imagePreview.split(",")[1];
      if (base64) {
        extractFromScreenshotMutation.mutate(base64);
        return;
      }
    }

    if (!selectedImage) {
      toast({
        title: "No Screenshot",
        description: "Please upload a screenshot first",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      extractFromScreenshotMutation.mutate(base64);
    };
    reader.readAsDataURL(selectedImage);
  };

  const handleCreateLead = () => {
    if (!extractedData) {
      toast({
        title: "No Data",
        description: "Please extract customer details first",
        variant: "destructive",
      });
      return;
    }
    onLeadCreated(extractedData);
    handleClose();
  };

  const handleClose = () => {
    setMessageText("");
    setManualPhone("");
    setSelectedImage(null);
    setImagePreview(null);
    setExtractedData(null);
    onOpenChange(false);
  };

  const isExtracting_ =
    extractFromTextMutation.isPending ||
    extractFromScreenshotMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Create Lead from Message
          </DialogTitle>
          <DialogDescription>
            Paste a customer's text message or upload a screenshot to
            automatically extract their details
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "paste" | "screenshot")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Paste Text
            </TabsTrigger>
            <TabsTrigger value="screenshot" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Screenshot
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="message">Customer's Message</Label>
              <Textarea
                id="message"
                placeholder="Paste the customer's text message here...

Example:
Thank you, Jack
📍 14 Dominion Road, Te Hapara, Gisborne"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="min-h-[120px]"
                data-testid="textarea-paste-message"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Customer's Phone (optional)</Label>
              <Input
                id="phone"
                placeholder="+64 21 231 8338"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                data-testid="input-manual-phone"
              />
              <p className="text-xs text-muted-foreground">
                Enter the phone number if it's not in the message
              </p>
            </div>

            <Button
              onClick={handleExtractFromText}
              disabled={!messageText.trim() || isExtracting_}
              className="w-full"
              data-testid="button-extract-text"
            >
              {extractFromTextMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Extract Details
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="screenshot" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Upload Screenshot</Label>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                data-testid="input-screenshot-file"
              />

              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Screenshot preview"
                    className="w-full max-h-[300px] object-contain rounded-lg border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview(null);
                      setExtractedData(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Card
                  className="border-dashed cursor-pointer hover-elevate"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">
                      Paste or click to upload
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Press Cmd+V to paste a screenshot, or click to browse
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            <Button
              onClick={handleExtractFromScreenshot}
              disabled={(!selectedImage && !imagePreview) || isExtracting_}
              className="w-full"
              data-testid="button-extract-screenshot"
            >
              {extractFromScreenshotMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Screenshot...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Extract from Screenshot
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        {extractedData && (
          <Card className="mt-4 border-green-200 bg-green-50">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-medium mb-3">
                <Check className="h-5 w-5" />
                Extracted Details
              </div>

              {extractedData.name && (
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-medium">{extractedData.name}</p>
                  </div>
                </div>
              )}

              {extractedData.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium">{extractedData.phone}</p>
                  </div>
                </div>
              )}

              {extractedData.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{extractedData.email}</p>
                  </div>
                </div>
              )}

              {extractedData.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="font-medium">{extractedData.address}</p>
                  </div>
                </div>
              )}

              {extractedData.description && (
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Job Details</p>
                    <p className="text-sm">{extractedData.description}</p>
                  </div>
                </div>
              )}

              <Button
                onClick={handleCreateLead}
                className="w-full mt-4"
                data-testid="button-create-lead"
              >
                Create Lead
              </Button>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
