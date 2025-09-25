import { Button } from "@/components/ui/button";
import { JobDiarySection } from "./JobDiarySection";
import { 
  MessageSquare, 
  Zap, 
  Clock, 
  Receipt, 
  Presentation 
} from "lucide-react";
import type { Customer } from "@shared/schema";

interface ServiceM8ActivityFeedProps {
  mode: "create" | "edit";
  jobId?: string;
  customer?: Customer | null;
  onTrackTime: () => void;
  onAddExpense: () => void;
  onCreateProposal: () => void;
}

export function ServiceM8ActivityFeed({
  mode,
  jobId,
  customer,
  onTrackTime,
  onAddExpense,
  onCreateProposal,
}: ServiceM8ActivityFeedProps) {
  return (
    <div className="w-96 bg-gray-50 overflow-y-auto">
      <div className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Job Activity
          </h3>
          
          {/* Job Diary Section */}
          {mode === "edit" && jobId && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <JobDiarySection
                jobId={jobId}
                customerId={customer?.id}
                customerEmail={customer?.email || undefined}
                customerPhone={customer?.phone || undefined}
              />
            </div>
          )}
          
          {mode === "create" && (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">Activity Feed</h4>
              <p className="text-gray-500">
                Job activity and diary entries will appear here after the job is created.
              </p>
            </div>
          )}
          
          {/* Quick Actions Panel */}
          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-600" />
              Quick Actions
            </h4>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start text-left"
                onClick={onTrackTime}
                data-testid="quick-action-time-tracking"
              >
                <Clock className="w-4 h-4 mr-2" />
                Track Time
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start text-left"
                onClick={onAddExpense}
                data-testid="quick-action-expenses"
              >
                <Receipt className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start text-left"
                onClick={onCreateProposal}
                data-testid="quick-action-proposal"
              >
                <Presentation className="w-4 h-4 mr-2" />
                Create Proposal
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}