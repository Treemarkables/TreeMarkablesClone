import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mic, Square, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SpeechToQuoteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuoteGenerated: (quoteData: any) => void;
  context?:
    | "full"
    | "job-description"
    | "invoice-description"
    | "internal-notes";
}

export function SpeechToQuote({
  open,
  onOpenChange,
  onQuoteGenerated,
  context = "full",
}: SpeechToQuoteProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isMediaRecorderSupported, setIsMediaRecorderSupported] =
    useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mimeTypeRef = useRef<string>("audio/webm"); // Store MIME type used for recording
  const { toast } = useToast();

  // Check device capabilities on mount
  useEffect(() => {
    // Guard against SSR/pre-render
    if (typeof window === "undefined") return;

    // Detect iOS devices for UI hints
    const iosDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(iosDevice);

    const hasBasicSupport = !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      window.MediaRecorder
    );

    // iOS Safari is picky - if MediaRecorder exists, let's try to use it
    // We'll determine the best MIME type dynamically when recording starts
    setIsMediaRecorderSupported(hasBasicSupport);

    if (!hasBasicSupport) {
      console.warn(
        "MediaRecorder or getUserMedia not supported on this browser",
      );
    }
  }, []);

  // Cleanup on unmount or dialog close
  useEffect(() => {
    if (!open) {
      cleanup();
    }

    return () => {
      cleanup();
    };
  }, [open]);

  const cleanup = () => {
    // Stop recording regardless of current state (prevents leak during processing)
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {
        console.error("Error stopping recorder:", e);
      }
      mediaRecorderRef.current = null;
    }

    // Stop all media tracks (always, to prevent resource leak)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.error("Error stopping track:", e);
        }
      });
      streamRef.current = null;
    }

    // Clear timer (always, to prevent interval leak)
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Reset state
    setIsRecording(false);
    setIsProcessing(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  const startRecording = async () => {
    if (!isMediaRecorderSupported) {
      toast({
        variant: "destructive",
        title: "Not Supported",
        description:
          "Audio recording is not supported on this browser. Please use Chrome, Firefox, or Edge on desktop.",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000, // High quality sample rate
        },
      });
      streamRef.current = stream;

      // Choose MIME type based on device support - try in order of preference
      let mimeType = "";
      let recorderOptions: MediaRecorderOptions = {};

      if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
        recorderOptions = { mimeType, audioBitsPerSecond: 128000 };
      } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
        recorderOptions = { mimeType, audioBitsPerSecond: 128000 };
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
        recorderOptions = { mimeType, audioBitsPerSecond: 128000 };
      } else {
        // No specific MIME type supported, let browser choose default
        // This is common on older iOS versions
        console.warn("No specific MIME type supported, using browser default");
        recorderOptions = { audioBitsPerSecond: 128000 };
      }

      // Store MIME type for later use when creating blob
      mimeTypeRef.current = mimeType || "audio/webm"; // fallback for blob creation

      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, recorderOptions);
      } catch (error) {
        console.warn(
          "Failed to create MediaRecorder with options, trying without options:",
          error,
        );
        // If options fail (iOS quirk), try without any options
        mediaRecorder = new MediaRecorder(stream);
        mimeTypeRef.current = "audio/webm"; // Use generic fallback
      }

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeTypeRef.current,
        });
        await processAudio(audioBlob);
        cleanup();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        variant: "destructive",
        title: "Recording Error",
        description: "Could not access microphone. Please check permissions.",
      });
      cleanup();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);

    try {
      // Determine filename based on input type and MIME type
      let filename = "recording.webm";
      if (audioBlob instanceof File) {
        filename = audioBlob.name;
      } else {
        // Use appropriate extension based on MIME type
        const extension = mimeTypeRef.current.includes("mp4") ? "m4a" : "webm";
        filename = `recording.${extension}`;
      }

      const formData = new FormData();
      formData.append("audio", audioBlob, filename);
      formData.append("context", context);

      const response = await fetch("/api/speech-to-quote", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process audio");
      }

      const result = await response.json();

      const successMessage =
        context === "full"
          ? "Quote generated from your speech!"
          : "Description transcribed from your speech!";

      onQuoteGenerated(result.data);
      onOpenChange(false);
    } catch (error) {
      console.error("Error processing audio:", error);
      toast({
        variant: "destructive",
        title: "Processing Error",
        description: "Could not process your recording. Please try again.",
      });
    } finally {
      setIsProcessing(false);
      setRecordingTime(0);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 25MB)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description:
          "Audio file must be less than 25MB. Try a shorter recording.",
      });
      return;
    }

    // Validate file type
    const validTypes = [
      "audio/mp4",
      "audio/m4a",
      "audio/mpeg",
      "audio/wav",
      "audio/webm",
      "audio/x-m4a",
    ];
    if (
      !validTypes.includes(file.type) &&
      !file.name.match(/\.(m4a|mp3|wav|webm)$/i)
    ) {
      toast({
        variant: "destructive",
        title: "Invalid File",
        description: "Please upload an audio file (m4a, mp3, wav, or webm)",
      });
      return;
    }

    await processAudio(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="dialog-speech-to-quote"
      >
        <DialogHeader>
          <DialogTitle>
            {context === "full" ? "Speech to Quote" : "Voice to Text"}
          </DialogTitle>
          <DialogDescription>
            {context === "full"
              ? isIOS
                ? "Upload a voice recording to generate a quote"
                : "Record your voice or upload an audio file to generate a quote"
              : isIOS
                ? "Upload a voice recording to transcribe into text"
                : "Record your voice or upload an audio file to transcribe into text"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-8">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Processing your recording...
              </p>
            </div>
          ) : (
            <>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/mp4,audio/m4a,audio/mpeg,audio/wav,audio/webm,.m4a,.mp3,.wav,.webm"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-audio-file"
              />

              {!isMediaRecorderSupported ? (
                /* Unsupported browser - show upload only */
                <div className="flex flex-col items-center gap-4 w-full">
                  <Button
                    size="lg"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                    data-testid="button-upload-audio"
                  >
                    Upload Audio File
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Upload a pre-recorded audio file (m4a, mp3, wav, or webm)
                  </p>
                </div>
              ) : (
                /* Android/Desktop - show recording with upload option */
                <>
                  <div className="relative">
                    <Button
                      size="icon"
                      variant={isRecording ? "destructive" : "default"}
                      className={`h-24 w-24 rounded-full ${isRecording ? "animate-pulse" : ""}`}
                      onClick={isRecording ? stopRecording : startRecording}
                      data-testid={
                        isRecording
                          ? "button-stop-recording"
                          : "button-start-recording"
                      }
                      aria-label={isRecording ? "Stop recording" : "Start recording"}
                    >
                      {isRecording ? (
                        <Square className="h-12 w-12" />
                      ) : (
                        <Mic className="h-12 w-12" />
                      )}
                    </Button>
                    {isRecording && (
                      <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive animate-pulse" />
                    )}
                  </div>

                  {isRecording && (
                    <div
                      className="text-2xl font-mono font-bold"
                      data-testid="text-recording-time"
                    >
                      {formatTime(recordingTime)}
                    </div>
                  )}

                  <div className="text-center space-y-2">
                    <p className="text-sm font-medium">
                      {isRecording ? "Recording..." : "Tap to start recording"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isRecording
                        ? "Tap the square to stop and process"
                        : "Speak clearly about customer name, location, job type, and pricing"}
                    </p>
                  </div>

                  {!isRecording && (
                    <div className="w-full border-t pt-4">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full"
                        data-testid="button-upload-audio-alternative"
                      >
                        Or Upload Audio File
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="text-xs text-muted-foreground text-center border-t pt-4">
          <p>
            <strong>Tips:</strong> Mention customer name, address, job
            description, tree types, and estimated price
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
