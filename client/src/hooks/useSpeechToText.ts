import { useState, useEffect, useRef } from 'react';

interface UseSpeechToTextProps {
  onResult: (transcript: string) => void;
  continuous?: boolean;
  language?: string;
}

export function useSpeechToText({
  onResult,
  continuous = false,
  language = 'en-NZ'
}: UseSpeechToTextProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  // Callers pass inline arrow functions, so `onResult` is a new reference each render.
  // Stash it in a ref so the recognition object below is built once and not torn down
  // mid-recording every time the parent re-renders (e.g. a React Query refetch).
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    // Check if browser supports Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    // Initialize speech recognition
    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;

    // Accumulate final-result text across multiple onresult events for one
    // recording session. The prior "fire only if the *last* result is final"
    // gate could miss the transcript entirely when Chrome's final-segment
    // delivery interleaves with interims — by the time the session ends, the
    // last event was an interim and the callback never fired. Instead we now
    // rebuild from finals on every onresult and flush on `onend`, which
    // always fires when a session ends.
    let finalText = '';

    recognition.onstart = () => {
      finalText = '';
      console.log(
        '[useSpeechToText] onstart — lang=' + language + ' continuous=' + continuous,
      );
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      // event.results is the cumulative list for this session, not a delta —
      // rebuild finals from the whole list each time.
      let interim = '';
      let collected = '';
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        const text = r[0]?.transcript ?? '';
        if (r.isFinal) {
          collected += text;
        } else {
          interim += text;
        }
      }
      finalText = collected;
      console.log(
        '[useSpeechToText] onresult — finals="' + finalText + '" interim="' + interim + '" count=' + event.results.length,
      );
    };

    recognition.onerror = (event: any) => {
      console.error('[useSpeechToText] onerror —', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log('[useSpeechToText] onend — flushing finalText="' + finalText + '"');
      setIsListening(false);
      const trimmed = finalText.trim();
      if (trimmed) {
        try {
          onResultRef.current(trimmed);
        } catch (err) {
          console.error('[useSpeechToText] onResult callback threw:', err);
        }
      }
      finalText = '';
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore — already stopped or never started
      }
      recognitionRef.current = null;
    };
  }, [continuous, language]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        // Chrome throws InvalidStateError if start() is called while already starting.
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  };
}
