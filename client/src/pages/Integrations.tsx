import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Settings,
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  Globe,
  Shield,
  Zap,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Plus,
  RefreshCw,
  Key,
  Link,
  Unlink,
  Download
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: 'email' | 'messaging' | 'calendar' | 'crm' | 'marketing' | 'analytics';
  icon: any;
  status: 'connected' | 'disconnected' | 'error' | 'available';
  isEnabled: boolean;
  lastSync?: string;
  connectionCount?: number;
  features: string[];
  setupRequired?: boolean;
}

const availableIntegrations: Integration[] = [
  {
    id: 'outlook',
    name: 'Microsoft Outlook',
    description: 'Connect your Outlook email and calendar for seamless communication management',
    category: 'email',
    icon: Mail,
    status: 'available',
    isEnabled: false,
    features: ['Email sync', 'Calendar integration', 'Contact management', 'Meeting scheduling'],
    setupRequired: true
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Integrate with Gmail for comprehensive email management',
    category: 'email',
    icon: Mail,
    status: 'available',
    isEnabled: false,
    features: ['Email sync', 'Label management', 'Search integration', 'Attachment handling'],
    setupRequired: true
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Professional email delivery and marketing automation',
    category: 'email',
    icon: Zap,
    status: 'connected',
    isEnabled: true,
    lastSync: '2024-12-20T10:30:00.000Z',
    features: ['Email delivery', 'Marketing campaigns', 'Analytics', 'Templates'],
    setupRequired: false
  },
  {
    id: 'twilio',
    name: 'Twilio SMS',
    description: 'Send and receive SMS messages from customers',
    category: 'messaging',
    icon: MessageSquare,
    status: 'available',
    isEnabled: false,
    features: ['SMS messaging', 'Phone verification', 'Bulk messaging', 'Message history'],
    setupRequired: true
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Connect WhatsApp Business for customer communication',
    category: 'messaging',
    icon: MessageSquare,
    status: 'available',
    isEnabled: false,
    features: ['Message sync', 'Media sharing', 'Business profiles', 'Quick replies'],
    setupRequired: true
  },
  {
    id: 'facebook',
    name: 'Facebook Pages',
    description: 'Manage Facebook page messages and interactions',
    category: 'messaging',
    icon: MessageSquare,
    status: 'error',
    isEnabled: false,
    lastSync: '2024-12-19T15:45:00.000Z',
    features: ['Page messages', 'Comment management', 'Review monitoring', 'Post scheduling'],
    setupRequired: false
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync appointments and scheduling with Google Calendar',
    category: 'calendar',
    icon: Calendar,
    status: 'available',
    isEnabled: false,
    features: ['Calendar sync', 'Appointment booking', 'Availability management', 'Reminders'],
    setupRequired: true
  }
];

export default function Integrations() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Mock query for integrations status
  const { data: integrationsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/integrations'],
    queryFn: async () => {
      // TODO: Replace with real API call
      return { success: true, data: availableIntegrations };
    }
  });

  const integrations = integrationsData?.data || availableIntegrations;

  const filteredIntegrations = integrations.filter(integration => 
    selectedCategory === 'all' || integration.category === selectedCategory
  );

  const connectedCount = integrations.filter(i => i.status === 'connected').length;
  const errorCount = integrations.filter(i => i.status === 'error').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600 bg-green-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'disconnected': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return CheckCircle;
      case 'error': return AlertCircle;
      default: return Shield;
    }
  };

  const handleConnect = (integrationId: string) => {
    // TODO: Implement actual connection logic
    console.log('Connecting to:', integrationId);
  };

  const handleDisconnect = (integrationId: string) => {
    // TODO: Implement disconnection logic
    console.log('Disconnecting from:', integrationId);
  };

  const handleToggle = (integrationId: string, enabled: boolean) => {
    // TODO: Implement enable/disable logic
    console.log('Toggling integration:', integrationId, enabled);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="h-6 w-6 text-orange-600" />
                Integrations
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Connect and manage your external service integrations
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetch()}
                data-testid="button-refresh-integrations"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                data-testid="button-browse-integrations"
              >
                <Plus className="h-4 w-4 mr-1" />
                Browse More
              </Button>
            </div>
          </div>
        </div>

        {/* Status Summary */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {connectedCount} Connected
              </span>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {errorCount} Need Attention
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Category Filter */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-6">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:grid-cols-6">
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            <TabsTrigger value="email" data-testid="tab-email">Email</TabsTrigger>
            <TabsTrigger value="messaging" data-testid="tab-messaging">Messaging</TabsTrigger>
            <TabsTrigger value="calendar" data-testid="tab-calendar">Calendar</TabsTrigger>
            <TabsTrigger value="crm" data-testid="tab-crm">CRM</TabsTrigger>
            <TabsTrigger value="marketing" data-testid="tab-marketing">Marketing</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Integrations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIntegrations.map((integration) => {
            const StatusIcon = getStatusIcon(integration.status);
            
            return (
              <Card key={integration.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg">
                        <integration.icon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <Badge 
                          variant="secondary" 
                          className={`mt-1 text-xs ${getStatusColor(integration.status)}`}
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {integration.status.charAt(0).toUpperCase() + integration.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    
                    {integration.status === 'connected' && (
                      <Switch
                        checked={integration.isEnabled}
                        onCheckedChange={(enabled) => handleToggle(integration.id, enabled)}
                        data-testid={`switch-${integration.id}`}
                      />
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {integration.description}
                  </p>
                  
                  {/* Features */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Features
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {integration.features.map((feature) => (
                        <Badge key={feature} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  {/* Connection Info */}
                  {integration.lastSync && (
                    <div className="text-xs text-gray-500">
                      Last sync: {new Date(integration.lastSync).toLocaleString()}
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    {integration.status === 'connected' ? (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          data-testid={`button-configure-${integration.id}`}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Configure
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDisconnect(integration.id)}
                          data-testid={`button-disconnect-${integration.id}`}
                        >
                          <Unlink className="h-4 w-4 mr-1" />
                          Disconnect
                        </Button>
                      </>
                    ) : integration.status === 'error' ? (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 text-red-600 border-red-200"
                          data-testid={`button-fix-${integration.id}`}
                        >
                          <AlertCircle className="h-4 w-4 mr-1" />
                          Fix Connection
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDisconnect(integration.id)}
                          data-testid={`button-remove-${integration.id}`}
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button 
                        className="flex-1" 
                        size="sm"
                        onClick={() => handleConnect(integration.id)}
                        data-testid={`button-connect-${integration.id}`}
                      >
                        <Link className="h-4 w-4 mr-1" />
                        {integration.setupRequired ? 'Setup' : 'Connect'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Help Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-orange-600" />
              Need Help Setting Up Integrations?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Email Integration</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Connect your email accounts to centralize all customer communications in one inbox.
                </p>
                <Button variant="ghost" className="p-0 h-auto text-orange-600 hover:text-orange-700">
                  View Email Setup Guide <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Messaging Services</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Enable SMS and social media messaging to reach customers on their preferred platforms.
                </p>
                <Button variant="ghost" className="p-0 h-auto text-orange-600 hover:text-orange-700">
                  View Messaging Setup Guide <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}