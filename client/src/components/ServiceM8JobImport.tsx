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
import Papa from 'papaparse';

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
    console.log('🔄 Starting CSV parsing with Papa Parse...');
    console.log('CSV content length:', csvContent.length);
    
    if (!csvContent || csvContent.trim().length === 0) {
      console.error('❌ CSV content is empty');
      return [];
    }
    
    try {
      // Use Papa Parse for robust CSV parsing  
      const parseResult = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transform: (value: string) => value.trim()
      }) as Papa.ParseResult<Record<string, string>>;
      
      if (parseResult.errors && parseResult.errors.length > 0) {
        console.warn('⚠️ CSV parsing warnings:', parseResult.errors);
      }
      
      const rawData = parseResult.data;
      console.log(`📊 Papa Parse found ${rawData.length} data rows`);
      
      if (rawData.length === 0) {
        console.error('❌ No data rows found after parsing');
        return [];
      }
      
      // Log the headers found
      const headers = Object.keys(rawData[0] || {});
      console.log('📋 CSV headers found:', headers);
      
      // Build header mapping once to prevent column detection issues
      const buildHeaderMap = (headers: string[]) => {
        const headerMap: Record<string, string> = {};
        
        const mapField = (fieldName: string, patterns: string[]) => {
          for (const pattern of patterns) {
            // Try exact match first
            const exactMatch = headers.find(h => h === pattern);
            if (exactMatch) {
              headerMap[fieldName] = exactMatch;
              return;
            }
          }
          
          for (const pattern of patterns) {
            // Try case-insensitive match
            const caseMatch = headers.find(h => h.toLowerCase() === pattern.toLowerCase());
            if (caseMatch) {
              headerMap[fieldName] = caseMatch;
              return;
            }
          }
          
          // For job numbers specifically, use anchored regex for safety
          if (fieldName === 'jobNumber') {
            for (const pattern of patterns) {
              const jobNumberRegex = new RegExp(`^${pattern.replace(/\s+/g, '[\\s_#]*')}$`, 'i');
              const regexMatch = headers.find(h => jobNumberRegex.test(h));
              if (regexMatch) {
                headerMap[fieldName] = regexMatch;
                return;
              }
            }
          } else {
            // For other fields, use controlled partial matching
            for (const pattern of patterns) {
              const partialMatch = headers.find(h => {
                const headerLower = h.toLowerCase();
                const patternLower = pattern.toLowerCase();
                return headerLower.includes(patternLower) && 
                       !headerLower.includes('description') && 
                       !headerLower.includes('notes') &&
                       !headerLower.includes('details') &&
                       !headerLower.includes('customer') &&
                       !headerLower.includes('employee');
              });
              if (partialMatch) {
                headerMap[fieldName] = partialMatch;
                return;
              }
            }
          }
          
          headerMap[fieldName] = ''; // No match found
        };
        
        // Map all fields with their possible ServiceM8 header names - COMPLETE job number matching
        mapField('jobNumber', ['Job Number', 'JobNumber', 'Job_Number', 'Job ID', 'JobID', 'Job_ID', 'Job #', 'Job No.', 'Job No', 'Job']);
        mapField('company', ['Company', 'Customer', 'Client', 'Business', 'Company Name', 'Customer Name']);
        mapField('address', ['Address', 'Location', 'Site', 'Site Address', 'Job Address', 'Property Address']);
        mapField('status', ['Status', 'Job Status', 'State', 'Job State']);
        mapField('description', [
          'Description', 'Job Description', 'Details', 'Work', 'Notes',
          'Work Description', 'Job Details', 'Service Description', 'Job Notes',
          'Work Notes', 'Task Description', 'Service Notes', 'Work Summary',
          'Job Summary', 'Work Required', 'Tasks', 'Work To Be Done'
        ]);
        mapField('contactFirst', ['First Name', 'FirstName', 'Contact First', 'ContactFirst', 'Contact', 'Name']);
        mapField('contactLast', ['Last Name', 'LastName', 'Contact Last', 'ContactLast', 'Surname']);
        mapField('email', ['Email', 'Email Address', 'EmailAddress']);
        mapField('phone', ['Phone', 'Phone Number', 'PhoneNumber', 'Tel', 'Telephone']);
        mapField('mobile', ['Mobile', 'Cell', 'Mobile Phone', 'MobilePhone']);
        mapField('invoiceAmount', ['Invoice Amount', 'InvoiceAmount', 'Amount', 'Total', 'Cost', 'Price', 'Value', 'Job Total']);
        mapField('totalCost', ['Total Cost', 'TotalCost', 'Cost']);
        mapField('workCompleted', ['Work Completed', 'WorkCompleted', 'Completed Work', 'Work Done']);
        mapField('invoiceDate', ['Invoice Date', 'InvoiceDate']);
        mapField('quoteDate', ['Quote Date', 'QuoteDate']);
        mapField('workOrderDate', ['Work Order Date', 'WorkOrderDate', 'Created', 'Date Created', 'Start Date']);
        mapField('completionDate', ['Completion Date', 'CompletionDate', 'Completed', 'Date Completed', 'End Date']);
        mapField('paymentMethod', ['Payment Method', 'PaymentMethod']);
        mapField('completedBy', ['Completed By', 'CompletedBy', 'Worker', 'Staff']);
        
        return headerMap;
      };
      
      const headerMap = buildHeaderMap(headers);
      console.log('🗺️ Header mapping:', headerMap);
      
      // Helper function to safely get field value
      const getFieldValue = (row: Record<string, string>, fieldName: string): string => {
        const headerKey = headerMap[fieldName];
        return headerKey ? (row[headerKey] || '') : '';
      };
      
      // Helper function to parse monetary values while preserving negative indicators
      const parseMonetaryValue = (value: string): string => {
        if (!value) return '0';
        
        // Check for negative indicators first
        const isNegative = value.includes('-') || (value.includes('(') && value.includes(')'));
        
        // Remove currency symbols, spaces, and thousands separators, but preserve negative indicators
        let cleaned = value.replace(/[$£€¥₹₦,\s()]/g, '');
        
        // Keep only digits, decimal point, and minus sign
        const numeric = cleaned.replace(/[^\d.-]/g, '');
        
        // Validate it's a proper number
        let parsed = parseFloat(numeric);
        
        // Apply negative if indicated by parentheses (accounting format)
        if (isNegative && parsed > 0) {
          parsed = -parsed;
        }
        
        return isNaN(parsed) ? '0' : parsed.toString();
      };
      
      const jobs: ServiceM8Job[] = [];
      
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        
        // Log first few rows for debugging
        if (i < 3) {
          console.log(`🔍 Row ${i + 1} sample:`, Object.fromEntries(
            Object.entries(row).slice(0, 6).map(([k, v]) => [k, v ? v.substring(0, 50) : ''])
          ));
        }
        
        const job: ServiceM8Job = {
          // Use safe field extraction with proper header mapping
          jobNumber: getFieldValue(row, 'jobNumber') || `job-${i + 1}`,
          company: getFieldValue(row, 'company'),
          contactFirst: getFieldValue(row, 'contactFirst'),
          contactLast: getFieldValue(row, 'contactLast'),
          email: getFieldValue(row, 'email'),
          phone: getFieldValue(row, 'phone'),
          mobile: getFieldValue(row, 'mobile'),
          address: getFieldValue(row, 'address'),
          status: getFieldValue(row, 'status') || 'pending',
          description: getFieldValue(row, 'description') || getFieldValue(row, 'workCompleted') || '',
          workCompleted: getFieldValue(row, 'workCompleted'),
          
          // Financial fields with proper monetary parsing
          invoiceAmount: parseMonetaryValue(getFieldValue(row, 'invoiceAmount')),
          totalCost: parseMonetaryValue(getFieldValue(row, 'totalCost')),
          
          // Date fields
          invoiceDate: getFieldValue(row, 'invoiceDate'),
          quoteDate: getFieldValue(row, 'quoteDate'),
          workOrderDate: getFieldValue(row, 'workOrderDate'),
          completionDate: getFieldValue(row, 'completionDate'),
          
          // Additional fields
          paymentMethod: getFieldValue(row, 'paymentMethod'),
          completedBy: getFieldValue(row, 'completedBy'),
          source: 'ServiceM8 Import'
        };
        
        // Validation - require either job number or company
        if (job.jobNumber && job.jobNumber !== `job-${i + 1}` || job.company) {
          jobs.push(job);
          
          // Log first few successful jobs
          if (jobs.length <= 5) {
            console.log(`✅ Job ${jobs.length}:`, {
              jobNumber: job.jobNumber,
              company: job.company,
              address: job.address?.substring(0, 50),
              amount: job.invoiceAmount
            });
          }
        }
      }
      
      console.log(`🎉 Successfully parsed ${jobs.length} jobs from ${rawData.length} data rows`);
      return jobs;
      
    } catch (error) {
      console.error('❌ CSV parsing failed:', error);
      return [];
    }
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
      // Provide safe default stats if result.stats is undefined
      const safeStats = result.stats || {
        totalJobs: 0,
        processedJobs: 0,
        successfulMatches: 0,
        newCustomers: 0,
        errors: 0
      };
      
      setImportStats(safeStats);
      setCurrentStep('complete');
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      
      // Show different messages based on import results
      if (safeStats.errors > 0 && safeStats.successfulMatches === 0) {
        toast({
          title: "Import failed",
          description: `All ${safeStats.errors} jobs failed to import. Check for duplicate job numbers.`,
          variant: "destructive"
        });
      } else if (safeStats.errors > 0) {
        toast({
          title: "Import partially completed",
          description: `Imported ${safeStats.successfulMatches} jobs, ${safeStats.errors} failed`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Import completed successfully",
          description: `Imported ${safeStats.successfulMatches} jobs`
        });
      }
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
    
    // Initialize accumulated stats
    let accumulatedStats = {
      totalJobs: jobs.length,
      processedJobs: 0,
      successfulMatches: 0,
      newCustomers: 0,
      errors: 0
    };
    
    // Process jobs in batches - larger batches for big datasets
    const batchSize = jobs.length > 1000 ? 200 : 100;
    const totalBatches = Math.ceil(jobs.length / batchSize);
    
    try {
      for (let i = 0; i < totalBatches; i++) {
        const startIndex = i * batchSize;
        const endIndex = Math.min(startIndex + batchSize, jobs.length);
        const batch = jobs.slice(startIndex, endIndex);
        
        // Import this batch and get its stats
        const result = await fetch('/api/jobs/import-servicem8', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobs: batch })
        });
        const batchResult = await result.json();
        
        // Accumulate stats from this batch
        const batchStats = batchResult.stats || {
          totalJobs: 0,
          processedJobs: 0,
          successfulMatches: 0,
          newCustomers: 0,
          errors: 0
        };
        
        accumulatedStats.processedJobs += batchStats.processedJobs || batch.length;
        accumulatedStats.successfulMatches += batchStats.successfulMatches || 0;
        accumulatedStats.newCustomers += batchStats.newCustomers || 0;
        accumulatedStats.errors += batchStats.errors || 0;
        
        const progressPercent = ((i + 1) / totalBatches) * 100;
        setProgress(progressPercent);
        
        // Shorter delay for large imports
        const delay = jobs.length > 1000 ? 200 : 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Set final accumulated stats and complete
      setImportStats(accumulatedStats);
      setCurrentStep('complete');
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      
      // Show final success message
      if (accumulatedStats.errors > 0 && accumulatedStats.successfulMatches === 0) {
        toast({
          title: "Import failed",
          description: `All ${accumulatedStats.errors} jobs failed to import. Check for duplicate job numbers.`,
          variant: "destructive"
        });
      } else if (accumulatedStats.errors > 0) {
        toast({
          title: "Import partially completed",
          description: `Imported ${accumulatedStats.successfulMatches} jobs, ${accumulatedStats.errors} failed`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Import completed successfully",
          description: `Imported ${accumulatedStats.successfulMatches} jobs from ${jobs.length} total`
        });
      }
      
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: error.message || "An error occurred during import",
        variant: "destructive"
      });
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
              {/* 🚀 IMPORT BUTTON - TOP OF PAGE - IMPOSSIBLE TO MISS */}
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl shadow-xl mb-6 border-4 border-green-400">
                <div className="text-center">
                  <h2 className="text-3xl font-bold mb-2">🚀 READY TO IMPORT YOUR SERVICEM8 DATA!</h2>
                  <p className="text-xl mb-4">Found {jobs.length.toLocaleString()} jobs ready to import</p>
                  <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
                    <Button onClick={resetImport} variant="outline" className="flex-1 bg-white text-green-600 hover:bg-gray-50 text-lg font-bold py-3" size="lg">
                      📁 Upload Different File
                    </Button>
                    <Button 
                      onClick={handleImport} 
                      disabled={!jobs.length || isProcessing}
                      data-testid="button-import-jobs"
                      className="flex-1 bg-yellow-400 text-green-800 hover:bg-yellow-300 text-2xl font-bold py-4 shadow-lg border-2 border-yellow-300"
                      size="lg"
                    >
                      🚀 IMPORT {jobs.length.toLocaleString()} JOBS NOW!
                    </Button>
                  </div>
                </div>
              </div>
              
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
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-4">
                  {jobs.slice(0, 10).map((job, index) => (
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

              {jobs.length > 10 && (
                <div className="text-center py-2 text-sm text-gray-600 bg-blue-50 rounded">
                  Showing first 10 jobs of {jobs.length} total jobs to import
                </div>
              )}
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-amber-800 mb-2">⚠️ Important: Duplicate Jobs</h4>
                <p className="text-sm text-amber-700 mb-3">
                  Your database already contains jobs. If your CSV has the same job numbers, the import will fail.
                </p>
                <Button 
                  onClick={async () => {
                    if (confirm('⚠️ This will DELETE ALL existing jobs and customers. Are you sure?')) {
                      try {
                        await fetch('/api/admin/clear-data', { method: 'POST' });
                        toast({ title: "Database cleared", description: "All jobs and customers deleted" });
                      } catch (error) {
                        toast({ title: "Clear failed", description: "Could not clear database", variant: "destructive" });
                      }
                    }
                  }}
                  variant="destructive"
                  size="sm"
                  className="mr-2"
                >
                  🗑️ Clear All Data First
                </Button>
                <span className="text-xs text-amber-600">
                  Recommended for first-time imports
                </span>
              </div>
              
              {/* IMPORT ACTIONS - ALWAYS VISIBLE */}
              <div className="sticky bottom-0 bg-white border-t-2 border-green-200 shadow-lg p-6 mt-6 rounded-t-lg">
                <div className="max-w-4xl mx-auto">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-green-700">
                      📋 Ready to Import {jobs.length.toLocaleString()} Jobs
                    </h3>
                    <p className="text-sm text-gray-600">Choose your import action below</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button onClick={resetImport} variant="outline" className="flex-1" size="lg">
                      📁 Upload Different File
                    </Button>
                    <Button 
                      onClick={handleImport} 
                      disabled={!jobs.length || isProcessing}
                      data-testid="button-import-jobs"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-lg font-bold py-4"
                      size="lg"
                    >
                      🚀 IMPORT {jobs.length.toLocaleString()} JOBS NOW
                    </Button>
                  </div>
                </div>
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
                {importStats && importStats.errors > 0 && importStats.successfulMatches === 0 ? (
                  <>
                    <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-red-800 mb-2">Import Failed!</h3>
                    <p className="text-red-600 mb-4">
                      All {importStats?.errors || 0} jobs failed to import. This usually means duplicate job numbers already exist in your database.
                    </p>
                  </>
                ) : importStats && importStats.errors > 0 ? (
                  <>
                    <AlertCircle className="w-16 h-16 text-amber-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-amber-800 mb-2">Import Partially Completed</h3>
                    <p className="text-amber-600 mb-4">
                      {importStats?.successfulMatches || 0} jobs imported successfully, but {importStats?.errors || 0} failed (likely duplicates).
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-green-800 mb-2">Import Completed Successfully!</h3>
                  </>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">{importStats?.successfulMatches || 0}</p>
                      <p className="text-sm text-gray-600">Jobs Imported</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{importStats?.newCustomers || 0}</p>
                      <p className="text-sm text-gray-600">New Customers</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-purple-600">{importStats?.processedJobs || 0}</p>
                      <p className="text-sm text-gray-600">Total Processed</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-red-600">{importStats?.errors || 0}</p>
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