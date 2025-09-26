import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Users, 
  Upload,
  Database,
  CheckCircle,
  AlertCircle,
  Info
} from "lucide-react";
import { CustomerCSVUpload } from "./CustomerCSVUpload";
import { JobCSVUpload } from "./JobCSVUpload";

export function CSVImportManager() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          ServiceM8 Data Migration
        </h2>
        <p className="text-muted-foreground">
          Import your historical jobs and customer data from ServiceM8 using CSV files.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" data-testid="tab-import-overview">
            <Database className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="customers" data-testid="tab-import-customers">
            <Users className="h-4 w-4 mr-2" />
            Import Customers
          </TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-import-jobs">
            <FileText className="h-4 w-4 mr-2" />
            Import Jobs
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Migration Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Migration Progress
                </CardTitle>
                <CardDescription>
                  Track your ServiceM8 data migration status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Customers</span>
                  <Badge variant="outline">Ready to Import</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Jobs</span>
                  <Badge variant="outline">Ready to Import</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Import Order */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Import Order
                </CardTitle>
                <CardDescription>
                  Follow this sequence for best results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <span className="text-sm">Import Customers first</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <span className="text-sm">Then import Jobs</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold">
                    ✓
                  </div>
                  <span className="text-sm">Review imported data</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Start */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Migration Tips:</strong> Export your data from ServiceM8 as CSV files. 
              Import customers first to ensure job-to-customer relationships are maintained. 
              Each import process includes validation and error reporting.
            </AlertDescription>
          </Alert>

          {/* CSV Format Guidelines */}
          <Card>
            <CardHeader>
              <CardTitle>CSV Format Guidelines</CardTitle>
              <CardDescription>
                Prepare your ServiceM8 export files with these requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Customer Files
                  </h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Include column headers in first row</li>
                    <li>• Required: Name, Email or Phone</li>
                    <li>• Optional: Address, Notes, ServiceM8 UUID</li>
                    <li>• Standard CSV format (.csv extension)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Job Files
                  </h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Include column headers in first row</li>
                    <li>• Required: Job Number, Description, Customer info</li>
                    <li>• Dates: DD/MM/YYYY or YYYY-MM-DD format</li>
                    <li>• Status: Use ServiceM8 status names</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customer Import Tab */}
        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Import Customers
              </CardTitle>
              <CardDescription>
                Import your ServiceM8 customer database (recommended first step)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CustomerCSVUpload />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Job Import Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Import Jobs
              </CardTitle>
              <CardDescription>
                Import your ServiceM8 job history (import customers first)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JobCSVUpload />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}