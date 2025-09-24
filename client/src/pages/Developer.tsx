import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Code, Database, Webhook, Key, Activity, Settings, Copy, ExternalLink, Plus, Eye, EyeOff, Upload } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ServiceM8JobImport } from "@/components/ServiceM8JobImport";

// Mock data for API keys and webhooks
const mockApiKeys = [
  {
    id: "1",
    name: "Production API Key",
    key: "sk_prod_1234567890abcdef",
    permissions: ["read", "write"],
    lastUsed: "2024-09-23",
    status: "active"
  },
  {
    id: "2", 
    name: "Analytics Integration",
    key: "sk_test_abcdef1234567890",
    permissions: ["read"],
    lastUsed: "2024-09-20",
    status: "active"
  },
  {
    id: "3",
    name: "Mobile App Key", 
    key: "sk_test_9876543210fedcba",
    permissions: ["read", "write"],
    lastUsed: "Never",
    status: "inactive"
  }
];

const mockWebhooks = [
  {
    id: "1",
    name: "Job Status Updates",
    url: "https://your-app.com/webhooks/jobs",
    events: ["job.created", "job.completed"],
    status: "active",
    lastDelivery: "2024-09-23"
  },
  {
    id: "2",
    name: "Invoice Notifications", 
    url: "https://accounting-system.com/webhooks/invoices",
    events: ["invoice.created", "invoice.paid"],
    status: "active",
    lastDelivery: "2024-09-22"
  }
];

export default function Developer() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const toggleApiKeyVisibility = (keyId: string) => {
    setShowApiKeys(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: `${label} copied successfully`,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Developer</h1>
          <p className="text-gray-600">API access, webhooks, and integrations</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="api-keys" data-testid="tab-api-keys">
            <Key className="w-4 h-4 mr-2" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks" data-testid="tab-webhooks">
            <Webhook className="w-4 h-4 mr-2" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="csv-import" data-testid="tab-csv-import">
            <Upload className="w-4 h-4 mr-2" />
            CSV Import
          </TabsTrigger>
          <TabsTrigger value="docs" data-testid="tab-docs">
            <Code className="w-4 h-4 mr-2" />
            API Docs
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active API Keys</p>
                    <p className="text-2xl font-bold">{mockApiKeys.filter(k => k.status === 'active').length}</p>
                  </div>
                  <Key className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Webhooks</p>
                    <p className="text-2xl font-bold">{mockWebhooks.filter(w => w.status === 'active').length}</p>
                  </div>
                  <Webhook className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">API Calls Today</p>
                    <p className="text-2xl font-bold">1,234</p>
                  </div>
                  <Activity className="w-8 h-8 text-amber-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick Start</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Getting Started with the Treemarkables API</h3>
                <p className="text-gray-600 mb-4">
                  Our API allows you to integrate Treemarkables with your existing systems. 
                  You can manage jobs, customers, quotes, and more programmatically.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <code className="text-sm">
                    curl -H "Authorization: Bearer YOUR_API_KEY" \\<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp; https://api.treemarkables.nz/v1/jobs
                  </code>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-semibold mb-2">Base URL</h3>
                <div className="flex items-center gap-2">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                    https://api.treemarkables.nz/v1
                  </code>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard("https://api.treemarkables.nz/v1", "Base URL")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api-keys" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>API Keys</CardTitle>
                <Button data-testid="button-create-api-key">
                  <Plus className="w-4 h-4 mr-2" />
                  Create API Key
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockApiKeys.map((apiKey) => (
                  <Card key={apiKey.id} className="p-4" data-testid={`card-api-key-${apiKey.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold" data-testid={`text-api-key-name-${apiKey.id}`}>
                            {apiKey.name}
                          </h3>
                          <Badge className={getStatusColor(apiKey.status)}>
                            {apiKey.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                            {showApiKeys[apiKey.id] ? apiKey.key : '•'.repeat(24)}
                          </code>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => toggleApiKeyVisibility(apiKey.id)}
                            data-testid={`button-toggle-visibility-${apiKey.id}`}
                          >
                            {showApiKeys[apiKey.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToClipboard(apiKey.key, "API Key")}
                            data-testid={`button-copy-${apiKey.id}`}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Permissions: {apiKey.permissions.join(', ')}</span>
                          <span>Last used: {apiKey.lastUsed}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid={`button-edit-api-key-${apiKey.id}`}>
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700"
                          data-testid={`button-delete-api-key-${apiKey.id}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks */}
        <TabsContent value="webhooks" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Webhooks</CardTitle>
                <Button data-testid="button-create-webhook">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Webhook
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockWebhooks.map((webhook) => (
                  <Card key={webhook.id} className="p-4" data-testid={`card-webhook-${webhook.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold" data-testid={`text-webhook-name-${webhook.id}`}>
                            {webhook.name}
                          </h3>
                          <Badge className={getStatusColor(webhook.status)}>
                            {webhook.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                            {webhook.url}
                          </code>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToClipboard(webhook.url, "Webhook URL")}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Events: {webhook.events.join(', ')}</span>
                          <span>Last delivery: {webhook.lastDelivery}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid={`button-test-webhook-${webhook.id}`}>
                          Test
                        </Button>
                        <Button variant="outline" size="sm" data-testid={`button-edit-webhook-${webhook.id}`}>
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700"
                          data-testid={`button-delete-webhook-${webhook.id}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Documentation */}
        <TabsContent value="docs" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>API Documentation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Available Endpoints</h3>
                <div className="space-y-3">
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <code className="font-mono text-sm">GET /jobs</code>
                      <Badge variant="outline">Read</Badge>
                    </div>
                    <p className="text-sm text-gray-600">Retrieve a list of all jobs</p>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <code className="font-mono text-sm">POST /jobs</code>
                      <Badge variant="outline">Write</Badge>
                    </div>
                    <p className="text-sm text-gray-600">Create a new job</p>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <code className="font-mono text-sm">GET /customers</code>
                      <Badge variant="outline">Read</Badge>
                    </div>
                    <p className="text-sm text-gray-600">Retrieve a list of all customers</p>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <code className="font-mono text-sm">POST /quotes</code>
                      <Badge variant="outline">Write</Badge>
                    </div>
                    <p className="text-sm text-gray-600">Create a new quote</p>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-semibold mb-2">External Documentation</h3>
                <Button variant="outline" className="w-full justify-between">
                  <span>View Full API Documentation</span>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CSV Import */}
        <TabsContent value="csv-import" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>ServiceM8 Job Import</CardTitle>
            </CardHeader>
            <CardContent>
              <ServiceM8JobImport />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}