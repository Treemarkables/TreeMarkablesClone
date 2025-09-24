import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, CheckCircle, AlertCircle, Users, Calendar, DollarSign, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';

interface ServiceM8Job {
  jobNumber: string;
  company: string;
  contactFirst: string;
  contactLast: string;
  email: string;
  phone: string;
  mobile: string;
  address: string;
  status: string;
  invoiceDate: string;
  quoteDate: string;
  workOrderDate: string;
  completionDate: string;
  description: string;
  workCompleted: string;
  invoiceAmount: string;
  totalCost: string;
  paymentMethod: string;
  completedBy: string;
  source: string;
}

interface ImportStats {
  totalJobs: number;
  processedJobs: number;
  successfulMatches: number;
  newCustomers: number;
  errors: number;
}

export function ServiceM8JobImport() {
  const [file, setFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState<ServiceM8Job[]>([]);
  const [importStats, setImportStats] = useState<ImportStats>({
    totalJobs: 0,
    processedJobs: 0,
    successfulMatches: 0,
    newCustomers: 0,
    errors: 0
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'processing' | 'complete'>('upload');
  const [errors, setErrors] = useState<string[]>([]);
  const { toast } = useToast();

  const parseServiceM8CSV = (csvContent: string): ServiceM8Job[] => {
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    const jobs: ServiceM8Job[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Handle CSV parsing with quoted fields containing commas
      const values: string[] = [];
      let currentValue = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // Add last value
      
      if (values.length >= 10) {
        const job: ServiceM8Job = {
          jobNumber: values[0]?.replace(/"/g, '') || '',
          company: values[3]?.replace(/"/g, '') || '',
          contactFirst: values[4]?.replace(/"/g, '') || '',
          contactLast: values[5]?.replace(/"/g, '') || '',
          email: values[6]?.replace(/"/g, '') || '',
          phone: values[7]?.replace(/"/g, '') || '',
          mobile: values[8]?.replace(/"/g, '') || '',
          address: values[9]?.replace(/"/g, '') || '',
          status: values[2]?.replace(/"/g, '') || '',
          invoiceDate: values[10]?.replace(/"/g, '') || '',
          quoteDate: values[11]?.replace(/"/g, '') || '',
          workOrderDate: values[12]?.replace(/"/g, '') || '',
          completionDate: values[29]?.replace(/"/g, '') || '',
          description: values[22]?.replace(/"/g, '') || '',
          workCompleted: values[23]?.replace(/"/g, '') || '',
          invoiceAmount: values[16]?.replace(/"/g, '') || '0',
          totalCost: values[19]?.replace(/"/g, '') || '0',
          paymentMethod: values[26]?.replace(/"/g, '') || '',
          completedBy: values[28]?.replace(/"/g, '') || '',
          source: values[20]?.replace(/"/g, '') || ''
        };
        
        if (job.jobNumber && job.company) {
          jobs.push(job);
        }
      }
    }
    
    return jobs;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file",
        variant: "destructive"
      });
      return;
    }

    setFile(uploadedFile);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result as string;
        const parsedJobs = parseServiceM8CSV(csvContent);
        
        setJobs(parsedJobs);
        setImportStats(prev => ({
          ...prev,
          totalJobs: parsedJobs.length
        }));
        setCurrentStep('preview');
        
        toast({
          title: "File uploaded successfully",
          description: `Found ${parsedJobs.length} jobs to import`
        });
      } catch (error) {
        toast({
          title: "Error parsing CSV",
          description: "Please check your file format",
          variant: "destructive"
        });
      }
    };
    
    reader.readAsText(uploadedFile);
  };

  const importJobsMutation = useMutation({
    mutationFn: async (jobs: ServiceM8Job[]) => {
      const response = await fetch('/api/jobs/import-servicem8', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs })
      });
      const data = await response.json();
      return data;
    },
    onSuccess: (result: any) => {
      setImportStats(result.stats);
      setCurrentStep('complete');
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({
        title: "Import completed successfully",
        description: `Imported ${result.stats.successfulMatches} jobs`
      });
    },
    onError: (error: any) => {
      setErrors([error.message || 'Import failed']);
      toast({
        title: "Import failed",
        description: error.message || "An error occurred during import",
        variant: "destructive"
      });
    }
  });

  const handleImport = async () => {
    if (!jobs.length) return;
    
    setIsProcessing(true);
    setCurrentStep('processing');
    setProgress(0);
    
    // Process jobs in batches of 100 to avoid overwhelming the server
    const batchSize = 100;
    const totalBatches = Math.ceil(jobs.length / batchSize);
    
    try {
      for (let i = 0; i < totalBatches; i++) {
        const startIndex = i * batchSize;
        const endIndex = Math.min(startIndex + batchSize, jobs.length);
        const batch = jobs.slice(startIndex, endIndex);
        
        await importJobsMutation.mutateAsync(batch);
        
        const progressPercent = ((i + 1) / totalBatches) * 100;
        setProgress(progressPercent);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Import error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setJobs([]);
    setImportStats({
      totalJobs: 0,
      processedJobs: 0,
      successfulMatches: 0,
      newCustomers: 0,
      errors: 0
    });
    setProgress(0);
    setCurrentStep('upload');
    setErrors([]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            ServiceM8 Job Import
          </CardTitle>
          <CardDescription>
            Import your ServiceM8 job history CSV file to populate your job database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={currentStep} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="preview" disabled={!jobs.length}>Preview</TabsTrigger>
              <TabsTrigger value="processing" disabled={currentStep !== 'processing'}>Processing</TabsTrigger>
              <TabsTrigger value="complete" disabled={currentStep !== 'complete'}>Complete</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload ServiceM8 Job CSV</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select your ServiceM8 job history CSV export file
                </p>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="max-w-xs mx-auto"
                  data-testid="input-job-csv-upload"
                />
              </div>
              
              {file && (
                <Alert>
                  <FileText className="w-4 h-4" />
                  <AlertDescription>
                    Selected file: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium">Total Jobs</p>
                        <p className="text-xl font-bold">{jobs.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">Unique Companies</p>
                        <p className="text-xl font-bold">
                          {new Set(jobs.map(j => j.company)).size}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                      <div>
                        <p className="text-sm font-medium">Completed Jobs</p>
                        <p className="text-xl font-bold">
                          {jobs.filter(j => j.status.toLowerCase() === 'completed').length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium">Total Value</p>
                        <p className="text-xl font-bold">
                          ${jobs.reduce((sum, job) => sum + parseFloat(job.invoiceAmount || '0'), 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Sample Jobs Preview</h4>
                <div className="space-y-2">
                  {jobs.slice(0, 5).map((job, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">#{job.jobNumber}</Badge>
                              <Badge className={
                                job.status.toLowerCase() === 'completed' ? 'bg-green-100 text-green-800' :
                                job.status.toLowerCase() === 'unsuccessful' ? 'bg-red-100 text-red-800' :
                                'bg-blue-100 text-blue-800'
                              }>
                                {job.status}
                              </Badge>
                            </div>
                            <p className="font-medium">{job.company}</p>
                            <p className="text-sm text-gray-600 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {job.address}
                            </p>
                            {job.description && (
                              <p className="text-sm text-gray-600 line-clamp-2">{job.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-green-600">
                              ${parseFloat(job.invoiceAmount || '0').toLocaleString()}
                            </p>
                            {job.completionDate && job.completionDate !== '0000-00-00 00:00:00' && (
                              <p className="text-xs text-gray-500">
                                {new Date(job.completionDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {jobs.length > 5 && (
                  <p className="text-sm text-gray-500">...and {jobs.length - 5} more jobs</p>
                )}
              </div>

              <div className="flex gap-4">
                <Button onClick={resetImport} variant="outline">
                  Upload Different File
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={!jobs.length || isProcessing}
                  data-testid="button-import-jobs"
                >
                  Import {jobs.length} Jobs
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="processing" className="space-y-4">
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h3 className="text-lg font-medium mb-2">Importing Jobs...</h3>
                <p className="text-gray-600 mb-4">Please wait while we process your ServiceM8 data</p>
                <Progress value={progress} className="max-w-sm mx-auto" />
                <p className="text-sm text-gray-500 mt-2">{Math.round(progress)}% complete</p>
              </div>
            </TabsContent>

            <TabsContent value="complete" className="space-y-4">
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-green-800 mb-2">Import Completed Successfully!</h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">{importStats.successfulMatches}</p>
                      <p className="text-sm text-gray-600">Jobs Imported</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{importStats.newCustomers}</p>
                      <p className="text-sm text-gray-600">New Customers</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-purple-600">{importStats.processedJobs}</p>
                      <p className="text-sm text-gray-600">Total Processed</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-red-600">{importStats.errors}</p>
                      <p className="text-sm text-gray-600">Errors</p>
                    </CardContent>
                  </Card>
                </div>
                
                {errors.length > 0 && (
                  <Alert className="mt-4">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-medium">Import completed with some errors:</p>
                        {errors.slice(0, 5).map((error, index) => (
                          <p key={index} className="text-sm">• {error}</p>
                        ))}
                        {errors.length > 5 && (
                          <p className="text-sm">...and {errors.length - 5} more errors</p>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                
                <Button onClick={resetImport} className="mt-6">
                  Import Another File
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}