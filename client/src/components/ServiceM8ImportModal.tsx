import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  Download, 
  Users, 
  Briefcase, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Database,
  RefreshCw
} from "lucide-react";

interface ImportResult {
  success: boolean;
  imported: number;
  errors: string[];
}

interface FullImportResult {
  success: boolean;
  customers: ImportResult;
  jobs: ImportResult;
  message: string;
}

export function ServiceM8ImportModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [importStep, setImportStep] = useState<'ready' | 'testing' | 'importing' | 'complete'>('ready');
  const { toast } = useToast();

  // Test ServiceM8 connection
  const { data: connectionTest, isLoading: testingConnection, refetch: testConnection } = useQuery({
    queryKey: ['/api/servicem8/test'],
    enabled: false // Don't auto-run, trigger manually
  });

  // Import mutations
  const importAllMutation = useMutation({
    mutationFn: async (): Promise<FullImportResult> => {
      return await apiRequest('/api/servicem8/import/all', {
        method: 'POST'
      });
    },
    onSuccess: (result: FullImportResult) => {
      if (result.success) {
        // Invalidate customers and jobs queries to refresh UI
        queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        
        toast({
          title: "Import Successful!",
          description: result.message,
        });
        setImportStep('complete');
      } else {
        toast({
          title: "Import Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Import Error", 
        description: "Failed to import ServiceM8 data",
        variant: "destructive",
      });
    }
  });

  const importCustomersMutation = useMutation({
    mutationFn: async (): Promise<ImportResult> => {
      return await apiRequest('/api/servicem8/import/customers', {
        method: 'POST'
      });
    },
    onSuccess: (result: ImportResult) => {
      if (result.success) {
        // Invalidate customers query to refresh UI
        queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      }
      
      toast({
        title: result.success ? "Customers Imported" : "Import Error",
        description: `${result.imported} customers imported. ${result.errors.length} errors.`,
        variant: result.success ? "default" : "destructive",
      });
    }
  });

  const importJobsMutation = useMutation({
    mutationFn: async (): Promise<ImportResult> => {
      return await apiRequest('/api/servicem8/import/jobs', {
        method: 'POST'
      });
    },
    onSuccess: (result: ImportResult) => {
      if (result.success) {
        // Invalidate jobs query to refresh UI
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      }
      
      toast({
        title: result.success ? "Jobs Imported" : "Import Error", 
        description: `${result.imported} jobs imported. ${result.errors.length} errors.`,
        variant: result.success ? "default" : "destructive",
      });
    }
  });

  const handleTestConnection = async () => {
    setImportStep('testing');
    await testConnection();
    setImportStep('ready');
  };

  const handleImportAll = async () => {
    setImportStep('importing');
    await importAllMutation.mutateAsync();
  };

  const handleClose = () => {
    setIsOpen(false);
    setImportStep('ready');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-servicem8-import">
          <Database className="h-4 w-4 mr-2" />
          Import from ServiceM8
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            ServiceM8 Data Import
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Connection Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Connection Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {testingConnection || importStep === 'testing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : connectionTest && 'success' in connectionTest && connectionTest.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                  )}
                  <span className="text-sm">
                    {testingConnection || importStep === 'testing' ? 'Testing connection...' : 
                     connectionTest && 'success' in connectionTest && connectionTest.success ? 'Connected to ServiceM8' :
                     'Not tested yet'}
                  </span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleTestConnection}
                  disabled={testingConnection || importStep === 'testing'}
                  data-testid="button-test-connection"
                >
                  Test Connection
                </Button>
              </div>
              {connectionTest && 'success' in connectionTest && !connectionTest.success && 'message' in connectionTest && (
                <Alert className="mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{connectionTest.message}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Import Progress */}
          {importStep === 'importing' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Import Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Importing data from ServiceM8...</span>
                  </div>
                  <Progress value={50} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Import Results */}
          {importStep === 'complete' && importAllMutation.data && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Import Complete
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Customers</span>
                      </div>
                      <Badge variant="secondary">{importAllMutation.data.customers.imported}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-green-600" />
                        <span className="font-medium">Jobs</span>
                      </div>
                      <Badge variant="secondary">{importAllMutation.data.jobs.imported}</Badge>
                    </div>
                  </div>
                  
                  {(importAllMutation.data.customers.errors.length > 0 || importAllMutation.data.jobs.errors.length > 0) && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Some items could not be imported. Check the logs for details.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Import Options */}
          {importStep !== 'complete' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Import Options</CardTitle>
                <CardDescription>
                  Choose what data to import from your ServiceM8 account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Full Import */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Import All Data</h4>
                        <p className="text-sm text-muted-foreground">
                          Import all customers and jobs from ServiceM8
                        </p>
                      </div>
                      <Button 
                        onClick={handleImportAll}
                        disabled={!(connectionTest && 'success' in connectionTest && connectionTest.success) || importStep === 'importing'}
                        data-testid="button-import-all"
                      >
                        {importStep === 'importing' ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Import All
                      </Button>
                    </div>
                  </div>

                  {/* Individual Imports */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        <h4 className="font-medium">Customers Only</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Import customer contacts and details
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => importCustomersMutation.mutate()}
                        disabled={!(connectionTest && 'success' in connectionTest && connectionTest.success) || importCustomersMutation.isPending}
                        data-testid="button-import-customers"
                      >
                        {importCustomersMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Users className="h-4 w-4 mr-2" />
                        )}
                        Import Customers
                      </Button>
                    </div>

                    <div className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-green-600" />
                        <h4 className="font-medium">Jobs Only</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Import job details and schedules
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => importJobsMutation.mutate()}
                        disabled={!(connectionTest && 'success' in connectionTest && connectionTest.success) || importJobsMutation.isPending}
                        data-testid="button-import-jobs"
                      >
                        {importJobsMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Briefcase className="h-4 w-4 mr-2" />
                        )}
                        Import Jobs
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Important Notes */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> This will import data from your ServiceM8 account. 
              Make sure you have the correct API key configured and sufficient permissions.
              Imported data will be added to your existing records.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} data-testid="button-close-import">
              {importStep === 'complete' ? 'Done' : 'Cancel'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}