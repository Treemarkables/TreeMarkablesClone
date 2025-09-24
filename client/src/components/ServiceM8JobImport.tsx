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
    console.log('Starting CSV parsing...');
    console.log('CSV content length:', csvContent.length);
    
    if (!csvContent || csvContent.trim().length === 0) {
      console.error('CSV content is empty');
      return [];
    }
    
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    console.log('Total lines after filtering:', lines.length);
    
    if (lines.length < 2) {
      console.error('CSV has less than 2 lines (header + data)');
      return [];
    }
    
    const headerLine = lines[0].trim();
    console.log('Raw header line:', headerLine);
    
    // Parse headers more carefully
    const headers = headerLine.split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
    console.log('Parsed headers:', headers);
    
    // Find column indices by looking for common ServiceM8 field names
    const findColumnIndex = (possibleNames: string[]) => {
      for (const name of possibleNames) {
        const index = headers.findIndex(h => h.includes(name.toLowerCase()));
        if (index !== -1) return index;
      }
      return -1;
    };
    
    const columnIndices = {
      jobNumber: findColumnIndex(['job', 'job_id', 'jobid', 'jobnumber', 'job_number', 'id']),
      company: findColumnIndex(['company', 'customer', 'client', 'business']),
      address: findColumnIndex(['address', 'location', 'site']),
      status: findColumnIndex(['status', 'state']),
      description: findColumnIndex(['description', 'details', 'work', 'notes']),
      amount: findColumnIndex(['amount', 'total', 'cost', 'price', 'invoice']),
      contact: findColumnIndex(['contact', 'name', 'first', 'fname']),
      phone: findColumnIndex(['phone', 'mobile', 'tel']),
      email: findColumnIndex(['email', 'mail']),
      date: findColumnIndex(['date', 'created', 'completion', 'complete'])
    };
    
    console.log('Column indices found:', columnIndices);
    
    const jobs: ServiceM8Job[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parse CSV line with proper quote handling
      const values: string[] = [];
      let currentValue = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim().replace(/^"|"$/g, ''));
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim().replace(/^"|"$/g, ''));
      
      if (i <= 3) {
        console.log(`Row ${i} values (${values.length} total):`, values.slice(0, 8));
      }
      
      // Create job object using found column indices
      const job: ServiceM8Job = {
        jobNumber: (columnIndices.jobNumber >= 0 ? values[columnIndices.jobNumber] : values[0]) || `job-${i}`,
        company: (columnIndices.company >= 0 ? values[columnIndices.company] : values[1]) || '',
        contactFirst: (columnIndices.contact >= 0 ? values[columnIndices.contact] : values[2]) || '',
        contactLast: '',
        email: (columnIndices.email >= 0 ? values[columnIndices.email] : '') || '',
        phone: (columnIndices.phone >= 0 ? values[columnIndices.phone] : '') || '',
        mobile: '',
        address: (columnIndices.address >= 0 ? values[columnIndices.address] : values[3]) || '',
        status: (columnIndices.status >= 0 ? values[columnIndices.status] : values[4]) || 'pending',
        description: (columnIndices.description >= 0 ? values[columnIndices.description] : '') || '',
        workCompleted: '',
        invoiceAmount: (columnIndices.amount >= 0 ? values[columnIndices.amount] : '0') || '0',
        totalCost: '0',
        invoiceDate: '',
        quoteDate: '',
        workOrderDate: (columnIndices.date >= 0 ? values[columnIndices.date] : '') || '',
        completionDate: '',
        paymentMethod: '',
        completedBy: '',
        source: 'ServiceM8 Import'
      };
      
      // Very lenient validation - accept any row with job number OR company
      if (job.jobNumber || job.company) {
        jobs.push(job);
        if (jobs.length <= 5) {
          console.log(`Job ${jobs.length}:`, {
            jobNumber: job.jobNumber,
            company: job.company,
            address: job.address,
            amount: job.invoiceAmount
          });
        }
      }
    }
    
    console.log(`✅ Successfully parsed ${jobs.length} jobs from ${lines.length - 1} data rows`);
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
                <h4 className="font-medium">Jobs Preview ({jobs.length} total)</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4">
                  {jobs.map((job, index) => (
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