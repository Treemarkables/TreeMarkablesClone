import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mic, Square, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SpeechToQuoteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuoteGenerated: (quoteData: any) => void;
}

export function SpeechToQuote({ open, onOpenChange, onQuoteGenerated }: SpeechToQuoteProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isMediaRecorderSupported, setIsMediaRecorderSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  // Check MediaRecorder support on mount
  useEffect(() => {
    // Guard against SSR/pre-render
    if (typeof window === 'undefined') return;
    
    const hasBasicSupport = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    
    // Check MIME type support
    const mimeSupported = hasBasicSupport && 
      (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') || 
       MediaRecorder.isTypeSupported('audio/webm') ||
       MediaRecorder.isTypeSupported('audio/mp4'));
    
    setIsMediaRecorderSupported(mimeSupported);
    
    if (!mimeSupported) {
      console.warn('MediaRecorder or required audio format not supported on this browser');
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
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {
        console.error('Error stopping recorder:', e);
      }
      mediaRecorderRef.current = null;
    }
    
    // Stop all media tracks (always, to prevent resource leak)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.error('Error stopping track:', e);
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
        variant: 'destructive',
        title: 'Not Supported',
        description: 'Audio recording is not supported on this browser. Please use Chrome, Firefox, or Edge on desktop.',
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        cleanup();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        variant: 'destructive',
        title: 'Recording Error',
        description: 'Could not access microphone. Please check permissions.',
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
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/speech-to-quote', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process audio');
      }

      const result = await response.json();
      
      toast({
        title: 'Success',
        description: 'Quote generated from your speech!',
      });

      onQuoteGenerated(result.data);
      onOpenChange(false);
    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        variant: 'destructive',
        title: 'Processing Error',
        description: 'Could not process your recording. Please try again.',
      });
    } finally {
      setIsProcessing(false);
      setRecordingTime(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-speech-to-quote">
        <DialogHeader>
          <DialogTitle>Speech to Quote</DialogTitle>
          <DialogDescription>
            Describe the job details and we'll generate a quote for you.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-8">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processing your recording...</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <Button
                  size="icon"
                  variant={isRecording ? 'destructive' : 'default'}
                  className={`h-24 w-24 rounded-full ${isRecording ? 'animate-pulse' : ''}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  data-testid={isRecording ? 'button-stop-recording' : 'button-start-recording'}
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
                <div className="text-2xl font-mono font-bold" data-testid="text-recording-time">
                  {formatTime(recordingTime)}
                </div>
              )}

              <div className="text-center space-y-2">
                <p className="text-sm font-medium">
                  {isRecording ? 'Recording...' : 'Tap to start recording'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isRecording 
                    ? 'Tap the square to stop and process' 
                    : 'Speak clearly about customer name, location, job type, and pricing'
                  }
                </p>
              </div>
            </>
          )}
        </div>

        <div className="text-xs text-muted-foreground text-center border-t pt-4">
          <p><strong>Tips:</strong> Mention customer name, address, job description, tree types, and estimated price</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
