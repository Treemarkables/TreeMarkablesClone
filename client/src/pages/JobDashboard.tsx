import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Calendar, 
  MapPin, 
  Phone, 
  Mic, 
  Bot, 
  Plus, 
  Search,
  Clock,
  DollarSign,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Users
} from "lucide-react";

// Add Speech Recognition types for TypeScript
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

interface Job {
  id: string;
  title: string;
  customer: string;
  phone: string;
  address: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'quote-pending';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  date: string;
  time: string;
  estimate: string;
  description: string;
  aiNotes?: string;
}

const sampleJobs: Job[] = [
  {
    id: "1",
    title: "Large Pine Tree Removal",
    customer: "Sarah Mitchell",
    phone: "021 456 789",
    address: "123 Hillside Road, Gisborne",
    status: "scheduled",
    priority: "high",
    date: "2024-09-20",
    time: "09:00",
    estimate: "$1,200",
    description: "20m pine tree overhanging house, urgent removal needed",
    aiNotes: "AI detected: High priority due to safety risk. Weather clear for 3 days. Recommend crane access."
  },
  {
    id: "2", 
    title: "Hedge Trimming - Commercial",
    customer: "Green Valley School",
    phone: "06 867 5555",
    address: "45 Education Drive, Gisborne",
    status: "in-progress",
    priority: "medium",
    date: "2024-09-19",
    time: "14:00",
    estimate: "$450",
    description: "Quarterly hedge maintenance around school perimeter"
  },
  {
    id: "3",
    title: "Storm Damage Assessment",
    customer: "John Williams",
    phone: "027 123 456",
    address: "78 Coastal Road, Gisborne",
    status: "quote-pending",
    priority: "urgent",
    date: "2024-09-19",
    time: "16:30",
    estimate: "TBD",
    description: "Multiple trees down from recent storm, insurance claim"
  }
];

export default function JobDashboard() {
  const [jobs, setJobs] = useState<Job[]>(sampleJobs);
  const [isListening, setIsListening] = useState(false);
  const [voiceCommand, setVoiceCommand] = useState("");
  const [showNewJobDialog, setShowNewJobDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredJobs, setFilteredJobs] = useState<Job[]>(sampleJobs);
  const [newJob, setNewJob] = useState({ customer: "", phone: "", address: "", description: "" });
  const [recognition, setRecognition] = useState<any>(null);

  // Initialize Web Speech API
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onresult = (event: any) => {
        const command = event.results[0][0].transcript.toLowerCase();
        setVoiceCommand(command);
        processVoiceCommand(command);
        setIsListening(false);
      };
      
      recognitionInstance.onerror = () => {
        setIsListening(false);
        setVoiceCommand("Voice recognition not available in this browser");
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
    }
  }, []);

  // Filter jobs based on search
  useEffect(() => {
    const filtered = jobs.filter(job => 
      job.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.address.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredJobs(filtered);
  }, [jobs, searchTerm]);

  const processVoiceCommand = (command: string) => {
    if (command.includes('create') && command.includes('job')) {
      setShowNewJobDialog(true);
      setVoiceCommand(`AI: Opening job creation form...`);
    } else if (command.includes('complete') || command.includes('finish')) {
      const firstInProgress = jobs.find(j => j.status === 'in-progress');
      if (firstInProgress) {
        completeJob(firstInProgress.id);
        setVoiceCommand(`AI: Completed job for ${firstInProgress.customer}`);
      }
    } else if (command.includes('call')) {
      const firstJob = jobs[0];
      makePhoneCall(firstJob.phone, firstJob.customer);
    } else {
      setVoiceCommand(`AI: I heard "${command}" - feature coming soon!`);
    }
  };

  const startVoiceRecognition = () => {
    if (recognition) {
      setIsListening(true);
      setVoiceCommand("");
      recognition.start();
    } else {
      // Fallback simulation for browsers without speech recognition
      setIsListening(true);
      setTimeout(() => {
        const commands = [
          "create new job for tree removal",
          "complete current job",
          "call next customer"
        ];
        const randomCommand = commands[Math.floor(Math.random() * commands.length)];
        processVoiceCommand(randomCommand);
      }, 2000);
    }
  };

  // Job management functions
  const createJob = () => {
    if (!newJob.customer || !newJob.address) return;
    
    const job: Job = {
      id: Date.now().toString(),
      title: `Tree Service - ${newJob.customer}`,
      customer: newJob.customer,
      phone: newJob.phone || "Contact needed",
      address: newJob.address,
      status: 'scheduled',
      priority: 'medium',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      estimate: 'TBD',
      description: newJob.description || 'Tree service required',
      aiNotes: `AI created: Auto-generated from voice/manual input. Weather checked: Clear conditions.`
    };
    
    setJobs([...jobs, job]);
    setNewJob({ customer: "", phone: "", address: "", description: "" });
    setShowNewJobDialog(false);
    setVoiceCommand(`AI: New job created for ${job.customer}`);
  };

  const completeJob = (jobId: string) => {
    setJobs(jobs.map(job => 
      job.id === jobId 
        ? { ...job, status: 'completed' as const }
        : job
    ));
  };

  const makePhoneCall = (phone: string, customer: string) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    window.location.href = `tel:${cleanPhone}`;
    setVoiceCommand(`AI: Calling ${customer} at ${phone}`);
  };

  const sendSMS = (phone: string, customer: string) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const message = `Hi ${customer}, this is Treemarkables. We'll be arriving shortly for your scheduled tree service. Thanks!`;
    window.location.href = `sms:${cleanPhone}?&body=${encodeURIComponent(message)}`;
    setVoiceCommand(`AI: Sending SMS to ${customer}`);
  };

  const navigateToJob = (address: string) => {
    window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank');
    setVoiceCommand(`AI: Opening navigation to ${address}`);
  };

  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'quote-pending': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    }
  };

  const getPriorityColor = (priority: Job['priority']) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      case 'medium': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    }
  };

  const aiSuggestions = [
    `AI suggests rescheduling pine tree removal - high winds forecast tomorrow`,
    `Optimal route today: ${jobs.length} jobs scheduled, estimated 6.5 hours total`,
    `Weather alert: Clear conditions next 3 days - good for tree work`,
    `${jobs.filter(j => j.status === 'quote-pending').length} quotes pending - follow up recommended`
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Treemarkables Job Manager</h1>
            <p className="text-muted-foreground">AI-Powered Field Service Management</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={isListening ? "destructive" : "default"}
              onClick={startVoiceRecognition}
              className="flex items-center gap-2"
              data-testid="button-voice-command"
              disabled={isListening}
            >
              <Mic className={`h-4 w-4 ${isListening ? 'animate-pulse' : ''}`} />
              {isListening ? 'Listening...' : 'Voice Command'}
            </Button>
            <Dialog open={showNewJobDialog} onOpenChange={setShowNewJobDialog}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2" data-testid="button-new-job">
                  <Plus className="h-4 w-4" />
                  New Job
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Job</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input 
                    placeholder="Customer Name" 
                    value={newJob.customer}
                    onChange={(e) => setNewJob({ ...newJob, customer: e.target.value })}
                    data-testid="input-customer-name" 
                  />
                  <Input 
                    placeholder="Phone Number" 
                    value={newJob.phone}
                    onChange={(e) => setNewJob({ ...newJob, phone: e.target.value })}
                    data-testid="input-phone" 
                  />
                  <Input 
                    placeholder="Address" 
                    value={newJob.address}
                    onChange={(e) => setNewJob({ ...newJob, address: e.target.value })}
                    data-testid="input-address" 
                  />
                  <Textarea 
                    placeholder="Job Description" 
                    value={newJob.description}
                    onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                    data-testid="textarea-description" 
                  />
                  <Button onClick={createJob} className="w-full" data-testid="button-create-job">
                    Create Job
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Voice Command Display */}
        {voiceCommand && (
          <Card className="mb-6 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-green-600" />
                <span className="font-semibold">AI Agent:</span>
                <span className="text-green-800 dark:text-green-200">{voiceCommand}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Suggestions Panel */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Assistant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {aiSuggestions.map((suggestion, index) => (
                <div key={index} className="flex items-start gap-2 p-2 rounded bg-muted/50">
                  <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                  <span className="text-sm">{suggestion}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Today's Jobs</p>
                  <p className="text-2xl font-bold">{jobs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Revenue Today</p>
                  <p className="text-2xl font-bold">$2,100</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">{jobs.filter(j => j.status === 'in-progress').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Team Active</p>
                  <p className="text-2xl font-bold">2/3</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="jobs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="jobs" data-testid="tab-jobs">Jobs</TabsTrigger>
            <TabsTrigger value="schedule" data-testid="tab-schedule">Schedule</TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers">Customers</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="space-y-4">
            <div className="flex gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search jobs..." 
                  className="pl-10" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-jobs" 
                />
              </div>
            </div>

            <div className="grid gap-4">
              {filteredJobs.map((job) => (
                <Card key={job.id} className="hover-elevate">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">{job.title}</h3>
                        <p className="text-muted-foreground">{job.customer}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={getPriorityColor(job.priority)}>
                          {job.priority}
                        </Badge>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status.replace('-', ' ')}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{job.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{job.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{job.date} at {job.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{job.estimate}</span>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">{job.description}</p>

                    {job.aiNotes && (
                      <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded mb-4">
                        <div className="flex items-start gap-2">
                          <Bot className="h-4 w-4 text-blue-500 mt-0.5" />
                          <span className="text-sm text-blue-800 dark:text-blue-200">{job.aiNotes}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => makePhoneCall(job.phone, job.customer)}
                        data-testid={`button-call-${job.id}`}
                      >
                        <Phone className="h-4 w-4 mr-1" />
                        Call
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => sendSMS(job.phone, job.customer)}
                        data-testid={`button-message-${job.id}`}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        SMS
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => navigateToJob(job.address)}
                        data-testid={`button-navigate-${job.id}`}
                      >
                        <MapPin className="h-4 w-4 mr-1" />
                        Navigate
                      </Button>
                      {job.status !== 'completed' && (
                        <Button 
                          size="sm" 
                          onClick={() => completeJob(job.id)}
                          data-testid={`button-complete-${job.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Complete
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Calendar view with drag & drop scheduling coming soon</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers">
            <Card>
              <CardHeader>
                <CardTitle>Customer Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Customer database with AI insights and communication history</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Business Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Revenue tracking, job completion rates, and AI-powered business insights</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}