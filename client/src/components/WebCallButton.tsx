import { useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useWebCall } from "@/contexts/WebCallContext";

// Header dial button (desktop web): opens a small popover to type a number
// and place a call through the in-browser Twilio dialer. Hidden on the
// native app, where calls go through the OS dialer instead.
export function WebCallButton() {
  const { webCallAvailable, callState, startCall } = useWebCall();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");

  if (!webCallAvailable) return null;

  const dial = () => {
    const trimmed = number.trim();
    if (!trimmed) return;
    startCall(trimmed);
    setOpen(false);
    setNumber("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Make a call"
          data-testid="web-call-button"
          className="text-black"
          disabled={callState !== "idle"}
        >
          <Phone className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            dial();
          }}
          className="flex flex-col gap-2"
        >
          <p className="text-sm font-medium">Call a number</p>
          <Input
            type="tel"
            placeholder="e.g. 027 123 4567"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            autoFocus
            data-testid="web-call-number-input"
          />
          <Button type="submit" disabled={!number.trim()} data-testid="web-call-dial">
            <Phone className="h-4 w-4 mr-2" />
            Call
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
