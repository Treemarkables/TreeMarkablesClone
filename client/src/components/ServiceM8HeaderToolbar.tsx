import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  Calendar, 
  Clock, 
  FileText, 
  Presentation,
  Target,
  Settings,
  ChevronDown,
  Receipt,
  Send,
  Zap,
  Percent,
  CreditCard,
  CheckCircle,
  X
} from "lucide-react";

interface ServiceM8HeaderToolbarProps {
  mode: "create" | "edit";
  jobNumber?: string;
  customerName?: string;
  onClose: () => void;
  onEmailClick: () => void;
  onSMSClick: () => void;
  onCallClick: () => void;
  onScheduleClick: () => void;
  onQueueClick: () => void;
  onFormClick: () => void;
  onProposalClick: () => void;
  onProfitClick: () => void;
  // More dropdown actions
  onTrackExpenses: () => void;
  onSendInvoice: () => void;
  onSMSInvoice: () => void;
  onAutoInvoice: () => void;
  onPartialInvoice: () => void;
  onCustomiseInvoice: () => void;
  onAddPayment: () => void;
  onSendToXero: () => void;
}

export function ServiceM8HeaderToolbar({
  mode,
  jobNumber,
  customerName,
  onClose,
  onEmailClick,
  onSMSClick,
  onCallClick,
  onScheduleClick,
  onQueueClick,
  onFormClick,
  onProposalClick,
  onProfitClick,
  onTrackExpenses,
  onSendInvoice,
  onSMSInvoice,
  onAutoInvoice,
  onPartialInvoice,
  onCustomiseInvoice,
  onAddPayment,
  onSendToXero,
}: ServiceM8HeaderToolbarProps) {
  return (
    <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {mode === "create" ? "New Job" : `Job #${jobNumber || ""}`}
            </h1>
            <p className="text-sm text-gray-500">
              {customerName || "Job Details"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          data-testid="button-close-servicem8-job-card"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      {/* ServiceM8 Action Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button 
          variant="outline" 
          size="sm"
          onClick={onEmailClick}
          className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
          data-testid="servicem8-button-email"
        >
          <Mail className="w-4 h-4 mr-1" />
          Email
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={onSMSClick}
          className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
          data-testid="servicem8-button-sms"
        >
          <MessageSquare className="w-4 h-4 mr-1" />
          SMS
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={onCallClick}
          className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          data-testid="servicem8-button-call"
        >
          <Phone className="w-4 h-4 mr-1" />
          Call
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={onScheduleClick}
          className="bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100"
          data-testid="servicem8-button-schedule"
        >
          <Calendar className="w-4 h-4 mr-1" />
          Schedule
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={onQueueClick}
          className="bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100"
          data-testid="servicem8-button-queue"
        >
          <Clock className="w-4 h-4 mr-1" />
          Queue
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={onFormClick}
          className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
          data-testid="servicem8-button-form"
        >
          <FileText className="w-4 h-4 mr-1" />
          Form
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={onProposalClick}
          className="bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
          data-testid="servicem8-button-proposal"
        >
          <Presentation className="w-4 h-4 mr-1" />
          Proposal
        </Button>
        
        {/* Profit Tracking Button */}
        <Button 
          variant="outline" 
          size="sm"
          onClick={onProfitClick}
          className="bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
          data-testid="servicem8-button-profit"
        >
          <Target className="w-4 h-4 mr-1" />
          Profit
        </Button>
        
        {/* More Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
              data-testid="servicem8-button-more"
            >
              <Settings className="w-4 h-4 mr-1" />
              More
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onTrackExpenses}>
              <Receipt className="w-4 h-4 mr-2" />
              Track Expenses
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSendInvoice}>
              <Send className="w-4 h-4 mr-2 text-green-600" />
              Send Invoice
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSMSInvoice}>
              <MessageSquare className="w-4 h-4 mr-2 text-purple-600" />
              SMS Invoice
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onAutoInvoice}>
              <Zap className="w-4 h-4 mr-2 text-yellow-600" />
              Auto Invoice
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPartialInvoice}>
              <Percent className="w-4 h-4 mr-2 text-orange-600" />
              Partial Invoice
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCustomiseInvoice}>
              <Settings className="w-4 h-4 mr-2 text-teal-600" />
              Customise Invoice
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onAddPayment}>
              <CreditCard className="w-4 h-4 mr-2 text-blue-600" />
              Add Payment
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSendToXero}>
              <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
              Send to Xero
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}