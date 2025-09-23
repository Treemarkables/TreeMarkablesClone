import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, Users, Bell, Shield, CreditCard, Building, Globe, Plus, Mail, Phone } from "lucide-react";
import { useState } from "react";

// Mock data for staff and company settings
const mockStaff = [
  {
    id: "1",
    name: "Mike Johnson", 
    email: "mike@treemarkables.nz",
    phone: "021-234-5678",
    role: "Manager",
    permissions: ["all"],
    isActive: true,
    lastLogin: "2024-09-23"
  },
  {
    id: "2",
    name: "Sarah Wilson",
    email: "sarah@treemarkables.nz", 
    phone: "027-345-6789",
    role: "Arborist",
    permissions: ["jobs", "customers"],
    isActive: true,
    lastLogin: "2024-09-22"
  },
  {
    id: "3",
    name: "Tom Brown",
    email: "tom@treemarkables.nz",
    phone: "022-456-7890", 
    role: "Crew Leader",
    permissions: ["jobs"],
    isActive: false,
    lastLogin: "2024-09-18"
  }
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("company");
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    smsAlerts: true,
    jobReminders: true,
    invoiceAlerts: false,
    systemUpdates: true
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Manager': return 'bg-purple-100 text-purple-800';
      case 'Arborist': return 'bg-green-100 text-green-800';
      case 'Crew Leader': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Add staff & manage your account</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="company" data-testid="tab-company">
            <Building className="w-4 h-4 mr-2" />
            Company
          </TabsTrigger>
          <TabsTrigger value="staff" data-testid="tab-staff">
            <Users className="w-4 h-4 mr-2" />
            Staff
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Company Settings */}
        <TabsContent value="company" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input 
                    id="company-name" 
                    defaultValue="Treemarkables"
                    data-testid="input-company-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abn">ABN/GST Number</Label>
                  <Input 
                    id="abn" 
                    placeholder="12 345 678 901"
                    data-testid="input-abn"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Business Phone</Label>
                  <Input 
                    id="phone" 
                    defaultValue="09-123-4567"
                    data-testid="input-business-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Business Email</Label>
                  <Input 
                    id="email" 
                    defaultValue="quotes@treemarkables.nz"
                    data-testid="input-business-email"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Business Address</Label>
                <Input 
                  id="address" 
                  placeholder="123 Main Street, Auckland 1010"
                  data-testid="input-business-address"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select defaultValue="Pacific/Auckland">
                    <SelectTrigger data-testid="select-timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pacific/Auckland">Pacific/Auckland</SelectItem>
                      <SelectItem value="Pacific/Wellington">Pacific/Wellington</SelectItem>
                      <SelectItem value="Pacific/Chatham">Pacific/Chatham</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select defaultValue="NZD">
                    <SelectTrigger data-testid="select-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NZD">NZD ($)</SelectItem>
                      <SelectItem value="AUD">AUD ($)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button data-testid="button-save-company">
                Save Company Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Management */}
        <TabsContent value="staff" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Staff Members</CardTitle>
                <Button data-testid="button-add-staff">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Staff Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockStaff.map((staff) => (
                  <Card key={staff.id} className="p-4" data-testid={`card-staff-${staff.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-amber-100 text-amber-800">
                            {getInitials(staff.name)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold" data-testid={`text-staff-name-${staff.id}`}>
                              {staff.name}
                            </h3>
                            <Badge className={getRoleColor(staff.role)}>
                              {staff.role}
                            </Badge>
                            {!staff.isActive && (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Mail className="w-4 h-4" />
                              <span>{staff.email}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              <span>{staff.phone}</span>
                            </div>
                          </div>
                          
                          <div className="text-sm text-gray-600">
                            <span>Last login: {new Date(staff.lastLogin).toLocaleDateString()}</span>
                            <span className="mx-2">•</span>
                            <span>Permissions: {staff.permissions.join(', ')}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid={`button-edit-staff-${staff.id}`}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" data-testid={`button-deactivate-staff-${staff.id}`}>
                          {staff.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-alerts">Email Alerts</Label>
                  <p className="text-sm text-gray-600">Receive important notifications via email</p>
                </div>
                <Switch 
                  id="email-alerts"
                  checked={notifications.emailAlerts}
                  onCheckedChange={(checked) => 
                    setNotifications(prev => ({ ...prev, emailAlerts: checked }))
                  }
                  data-testid="switch-email-alerts"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sms-alerts">SMS Alerts</Label>
                  <p className="text-sm text-gray-600">Receive urgent notifications via SMS</p>
                </div>
                <Switch 
                  id="sms-alerts"
                  checked={notifications.smsAlerts}
                  onCheckedChange={(checked) => 
                    setNotifications(prev => ({ ...prev, smsAlerts: checked }))
                  }
                  data-testid="switch-sms-alerts"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="job-reminders">Job Reminders</Label>
                  <p className="text-sm text-gray-600">Daily reminders about upcoming jobs</p>
                </div>
                <Switch 
                  id="job-reminders"
                  checked={notifications.jobReminders}
                  onCheckedChange={(checked) => 
                    setNotifications(prev => ({ ...prev, jobReminders: checked }))
                  }
                  data-testid="switch-job-reminders"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="invoice-alerts">Invoice Alerts</Label>
                  <p className="text-sm text-gray-600">Notifications when invoices are paid</p>
                </div>
                <Switch 
                  id="invoice-alerts"
                  checked={notifications.invoiceAlerts}
                  onCheckedChange={(checked) => 
                    setNotifications(prev => ({ ...prev, invoiceAlerts: checked }))
                  }
                  data-testid="switch-invoice-alerts"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="system-updates">System Updates</Label>
                  <p className="text-sm text-gray-600">Updates about new features and improvements</p>
                </div>
                <Switch 
                  id="system-updates"
                  checked={notifications.systemUpdates}
                  onCheckedChange={(checked) => 
                    setNotifications(prev => ({ ...prev, systemUpdates: checked }))
                  }
                  data-testid="switch-system-updates"
                />
              </div>

              <Button data-testid="button-save-notifications">
                Save Notification Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label>Change Password</Label>
                  <div className="space-y-2 mt-2">
                    <Input type="password" placeholder="Current password" data-testid="input-current-password" />
                    <Input type="password" placeholder="New password" data-testid="input-new-password" />
                    <Input type="password" placeholder="Confirm new password" data-testid="input-confirm-password" />
                  </div>
                  <Button className="mt-2" data-testid="button-change-password">
                    Update Password
                  </Button>
                </div>

                <Separator />

                <div>
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-gray-600 mt-1 mb-4">
                    Add an extra layer of security to your account
                  </p>
                  <Button variant="outline" data-testid="button-setup-2fa">
                    Setup 2FA
                  </Button>
                </div>

                <Separator />

                <div>
                  <Label>API Access</Label>
                  <p className="text-sm text-gray-600 mt-1 mb-4">
                    Generate API keys for integrations
                  </p>
                  <Button variant="outline" data-testid="button-generate-api-key">
                    Generate API Key
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}