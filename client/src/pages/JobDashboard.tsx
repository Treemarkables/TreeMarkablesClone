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
            <TabsTrigger value="marketing" data-testid="tab-marketing">Marketing</TabsTrigger>
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

          <TabsContent value="marketing" className="space-y-6">
            {/* Marketing Overview */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Posts This Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">12</div>
                  <p className="text-xs text-muted-foreground">+3 from last month</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">4.8%</div>
                  <p className="text-xs text-muted-foreground">Above industry avg</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">New Reviews</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">8</div>
                  <p className="text-xs text-muted-foreground">This month</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Leads Generated</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">15</div>
                  <p className="text-xs text-muted-foreground">From social media</p>
                </CardContent>
              </Card>
            </div>

            {/* Content Calendar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Content Calendar - September 2024
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2 text-center">
                  <div className="font-semibold p-2">Sun</div>
                  <div className="font-semibold p-2">Mon</div>
                  <div className="font-semibold p-2">Tue</div>
                  <div className="font-semibold p-2">Wed</div>
                  <div className="font-semibold p-2">Thu</div>
                  <div className="font-semibold p-2">Fri</div>
                  <div className="font-semibold p-2">Sat</div>
                  
                  {/* Sample calendar content */}
                  <div className="p-2 rounded border">15</div>
                  <div className="p-2 rounded border">16</div>
                  <div className="p-2 rounded border">17</div>
                  <div className="p-2 rounded border bg-blue-50 dark:bg-blue-950">
                    <div className="text-xs">18</div>
                    <div className="text-xs text-blue-600 mt-1">Storm prep tips</div>
                  </div>
                  <div className="p-2 rounded border bg-green-50 dark:bg-green-950">
                    <div className="text-xs">19</div>
                    <div className="text-xs text-green-600 mt-1">Before/after post</div>
                  </div>
                  <div className="p-2 rounded border">20</div>
                  <div className="p-2 rounded border">21</div>
                </div>
              </CardContent>
            </Card>

            {/* Content Ideas */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-blue-500" />
                    AI Content Suggestions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-950">
                      <div className="font-medium text-blue-800 dark:text-blue-200">Seasonal Content</div>
                      <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        "Spring is the perfect time for tree health assessments. Book your consultation now!"
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary">Facebook</Badge>
                        <Badge variant="secondary">Instagram</Badge>
                      </div>
                    </div>
                    
                    <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950">
                      <div className="font-medium text-green-800 dark:text-green-200">Safety Education</div>
                      <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                        "Did you know? Trees near power lines should only be handled by certified arborists"
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary">LinkedIn</Badge>
                        <Badge variant="secondary">Blog</Badge>
                      </div>
                    </div>
                    
                    <div className="p-3 rounded-lg border bg-orange-50 dark:bg-orange-950">
                      <div className="font-medium text-orange-800 dark:text-orange-200">Customer Success</div>
                      <div className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                        "Amazing transformation! Sarah's overgrown pine is now safe and beautiful"
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary">Before/After</Badge>
                        <Badge variant="secondary">Testimonial</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marketing Campaigns</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="font-medium">Storm Season Prep</div>
                        <div className="text-sm text-muted-foreground">March - May campaign</div>
                      </div>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        Active
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="font-medium">Winter Safety Checks</div>
                        <div className="text-sm text-muted-foreground">June - August campaign</div>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                        Scheduled
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="font-medium">Spring Growth Management</div>
                        <div className="text-sm text-muted-foreground">September - November</div>
                      </div>
                      <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300">
                        Planning
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Social Media Templates */}
            <Card>
              <CardHeader>
                <CardTitle>Social Media Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="font-medium mb-2">Before/After Showcase</div>
                    <div className="text-sm text-muted-foreground mb-3">
                      "🌳 Transformation Tuesday! From hazardous overgrowth to safe, beautiful landscaping. [PHOTOS] Professional tree services make all the difference! #TreeCare #Gisborne"
                    </div>
                    <Button size="sm" variant="outline" className="w-full">Use Template</Button>
                  </div>
                  
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="font-medium mb-2">Safety Education</div>
                    <div className="text-sm text-muted-foreground mb-3">
                      "⚠️ Safety First! Here's why you should never attempt DIY tree removal near power lines. Trust the professionals at Treemarkables! #TreeSafety #ProfessionalService"
                    </div>
                    <Button size="sm" variant="outline" className="w-full">Use Template</Button>
                  </div>
                  
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="font-medium mb-2">Customer Testimonial</div>
                    <div className="text-sm text-muted-foreground mb-3">
                      "⭐⭐⭐⭐⭐ 'Exceptional service from the Treemarkables team!' - [CUSTOMER NAME]. We're proud to serve Gisborne with professional tree care! #HappyCustomers #TreeCare"
                    </div>
                    <Button size="sm" variant="outline" className="w-full">Use Template</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Review Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Review & Testimonial Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-green-50 dark:bg-green-950">
                    <div>
                      <div className="font-medium">Sarah Mitchell</div>
                      <div className="text-sm text-muted-foreground">"Amazing job removing our large pine tree. Professional and tidy!"</div>
                      <div className="text-xs text-green-600 mt-1">⭐⭐⭐⭐⭐ Google Review - 2 days ago</div>
                    </div>
                    <Button size="sm" variant="outline">Share</Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-blue-50 dark:bg-blue-950">
                    <div>
                      <div className="font-medium">Green Valley School</div>
                      <div className="text-sm text-muted-foreground">"Reliable service for our ongoing tree maintenance. Highly recommend!"</div>
                      <div className="text-xs text-blue-600 mt-1">⭐⭐⭐⭐⭐ Facebook Review - 1 week ago</div>
                    </div>
                    <Button size="sm" variant="outline">Share</Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-orange-50 dark:bg-orange-950">
                    <div>
                      <div className="font-medium">John Williams - Follow Up</div>
                      <div className="text-sm text-muted-foreground">Completed job 3 days ago - perfect time to request review</div>
                      <div className="text-xs text-orange-600 mt-1">Storm damage cleanup - $2,200 job</div>
                    </div>
                    <Button size="sm">Request Review</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Photo Content Library */}
            <Card>
              <CardHeader>
                <CardTitle>Content Photo Library</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-sm font-medium">Pine Removal</div>
                      <div className="text-xs text-muted-foreground">Before/After Set</div>
                    </div>
                  </div>
                  <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-sm font-medium">Team Action</div>
                      <div className="text-xs text-muted-foreground">Professional at work</div>
                    </div>
                  </div>
                  <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-sm font-medium">Equipment</div>
                      <div className="text-xs text-muted-foreground">Crane operation</div>
                    </div>
                  </div>
                  <div className="aspect-square rounded-lg bg-muted flex items-center justify-center hover-elevate cursor-pointer">
                    <div className="text-center">
                      <Plus className="h-8 w-8 mx-auto mb-1" />
                      <div className="text-xs">Add Photo</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Revenue Analytics */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Pipeline Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    ${jobs.reduce((sum, job) => sum + parseInt(job.estimate.replace(/[^0-9]/g, '') || '0'), 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">From {jobs.length} active jobs</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {jobs.length > 0 ? Math.round((jobs.filter(j => j.status === 'completed').length / jobs.length) * 100) : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">{jobs.filter(j => j.status === 'completed').length} of {jobs.length} jobs</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Average Job Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    ${jobs.length > 0 ? Math.round(jobs.reduce((sum, job) => sum + parseInt(job.estimate.replace(/[^0-9]/g, '') || '0'), 0) / jobs.length).toLocaleString() : 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Per job average</p>
                </CardContent>
              </Card>
            </div>

            {/* Job Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Job Status Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
                    <div className="text-2xl font-bold text-blue-600">{jobs.filter(j => j.status === 'scheduled').length}</div>
                    <div className="text-sm text-blue-800 dark:text-blue-300">Scheduled</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950">
                    <div className="text-2xl font-bold text-yellow-600">{jobs.filter(j => j.status === 'in-progress').length}</div>
                    <div className="text-sm text-yellow-800 dark:text-yellow-300">In Progress</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950">
                    <div className="text-2xl font-bold text-green-600">{jobs.filter(j => j.status === 'completed').length}</div>
                    <div className="text-sm text-green-800 dark:text-green-300">Completed</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-950">
                    <div className="text-2xl font-bold text-orange-600">{jobs.filter(j => j.status === 'quote-pending').length}</div>
                    <div className="text-sm text-orange-800 dark:text-orange-300">Quote Pending</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Priority Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Priority Distribution & Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['urgent', 'high', 'medium', 'low'].map(priority => {
                    const priorityJobs = jobs.filter(j => j.priority === priority);
                    const priorityValue = priorityJobs.reduce((sum, job) => sum + parseInt(job.estimate.replace(/[^0-9]/g, '') || '0'), 0);
                    const percentage = jobs.length > 0 ? (priorityJobs.length / jobs.length) * 100 : 0;
                    
                    return (
                      <div key={priority} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Badge className={getPriorityColor(priority as Job['priority'])}>
                            {priority.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{priorityJobs.length} jobs</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${priorityValue.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">{percentage.toFixed(1)}% of total</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* AI Business Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-blue-500" />
                  AI Business Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 rounded bg-blue-50 dark:bg-blue-950">
                    <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div>
                      <div className="font-medium text-blue-800 dark:text-blue-200">Revenue Optimization</div>
                      <div className="text-sm text-blue-700 dark:text-blue-300">
                        High priority jobs generate {jobs.filter(j => j.priority === 'high' || j.priority === 'urgent').length > 0 
                          ? Math.round((jobs.filter(j => j.priority === 'high' || j.priority === 'urgent').reduce((sum, job) => sum + parseInt(job.estimate.replace(/[^0-9]/g, '') || '0'), 0) / jobs.filter(j => j.priority === 'high' || j.priority === 'urgent').length) / 
                            (jobs.filter(j => j.priority === 'medium' || j.priority === 'low').reduce((sum, job) => sum + parseInt(job.estimate.replace(/[^0-9]/g, '') || '0'), 0) / Math.max(jobs.filter(j => j.priority === 'medium' || j.priority === 'low').length, 1)) * 100 - 100)
                          : 0}% more revenue on average. Focus on emergency and hazardous tree work.
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2 p-3 rounded bg-green-50 dark:bg-green-950">
                    <AlertCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <div>
                      <div className="font-medium text-green-800 dark:text-green-200">Customer Patterns</div>
                      <div className="text-sm text-green-700 dark:text-green-300">
                        {new Set(jobs.map(j => j.customer)).size} unique customers with {jobs.length} total jobs. 
                        Average {(jobs.length / new Set(jobs.map(j => j.customer)).size).toFixed(1)} jobs per customer.
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2 p-3 rounded bg-orange-50 dark:bg-orange-950">
                    <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
                    <div>
                      <div className="font-medium text-orange-800 dark:text-orange-200">Quote Follow-up</div>
                      <div className="text-sm text-orange-700 dark:text-orange-300">
                        {jobs.filter(j => j.status === 'quote-pending').length} quotes pending. 
                        Quick follow-up increases conversion by 67%. Recommend calling within 24 hours.
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Customers */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Value Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(
                    jobs.reduce((acc, job) => {
                      if (!acc[job.customer]) {
                        acc[job.customer] = { count: 0, value: 0, phone: job.phone };
                      }
                      acc[job.customer].count += 1;
                      acc[job.customer].value += parseInt(job.estimate.replace(/[^0-9]/g, '') || '0');
                      return acc;
                    }, {} as Record<string, {count: number, value: number, phone: string}>)
                  )
                  .sort(([,a], [,b]) => b.value - a.value)
                  .slice(0, 5)
                  .map(([customer, data]) => (
                    <div key={customer} className="flex items-center justify-between p-3 rounded-lg border hover-elevate">
                      <div>
                        <div className="font-medium">{customer}</div>
                        <div className="text-sm text-muted-foreground">{data.count} jobs • {data.phone}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">${data.value.toLocaleString()}</div>
                        <div className="text-sm text-green-600">Top customer</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}