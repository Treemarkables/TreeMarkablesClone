import { DispatchBoard } from "@/components/DispatchBoard";
import { OnboardingBanner } from "@/components/OnboardingBanner";

export default function Dispatch() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <OnboardingBanner />
      <DispatchBoard />
    </div>
  );
}