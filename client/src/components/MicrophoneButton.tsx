import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MicrophoneButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'ghost' | 'outline' | 'secondary';
  appendText?: boolean; // If true, append to existing text. If false, replace
}

export function MicrophoneButton({ 
  onTranscript, 
  className,
  size = 'icon',
  variant = 'ghost',
  appendText = true
}: MicrophoneButtonProps) {
  const { toast } = useToast();

  const { isListening, isSupported, toggleListening } = useSpeechToText({
    onResult: (transcript) => {
      if (transcript.trim()) {
        onTranscript(transcript.trim());
      }
    },
    continuous: false,
    language: 'en-NZ'
  });

  const handleClick = () => {
    if (!isSupported) {
      toast({
        title: 'Speech recognition not supported',
        description: 'Your browser does not support speech recognition. Try Chrome or Edge.',
        variant: 'destructive'
      });
      return;
    }

    toggleListening();
  };

  if (!isSupported) {
    return null; // Hide button if not supported
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handleClick}
      className={cn(
        isListening && 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 animate-pulse',
        className
      )}
      data-testid="button-microphone"
    >
      {isListening ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
