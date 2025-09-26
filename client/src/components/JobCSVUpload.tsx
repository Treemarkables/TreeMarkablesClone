import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Download,
  Briefcase,
  ArrowRight,
  Loader2,
  Eye,
  Save
} from "lucide-react";
import Papa from "papaparse";

interface JobImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
  totalProcessed: number;
  batchId: string;
}

interface ParsedCSV {
  data: any[];
  errors: any[];
  meta: {
    fields?: string[];
  };
}

export function JobCSVUpload() {
  const [uploadStep, setUploadStep] = useState<'upload' | 'parsing' | 'preview' | 'importing' | 'complete'>('upload');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null);
  const [importResult, setImportResult] = useState<JobImportResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Job import mutation
  const importJobsMutation = useMutation({
    mutationFn: async (file: File): Promise<JobImportResult> => {
      const formData = new FormData();
      formData.append('csvFile', file);
      
      const response = await fetch('/api/jobs/import-csv', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status}: ${text}`);
      }
      
      const { data } = await response.json();
      return data;
    },
    onSuccess: (result: JobImportResult) => {
      setImportResult(result);
      setUploadStep('complete');
      
      // Invalidate jobs cache to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      
      toast({
        title: "Import Complete",
        description: `Successfully imported ${result.imported} jobs out of ${result.totalProcessed} total`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import jobs",
        variant: "destructive"
      });
      setUploadStep('upload');
    }
  });

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a CSV file",
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    parseCSVFile(file);
  };

  const parseCSVFile = (file: File) => {
    setUploadStep('parsing');
    setUploadProgress(0);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        setParsedCSV(results);
        setUploadStep('preview');
        setUploadProgress(100);
      },
      error: (error) => {
        toast({
          title: "Parse Error",
          description: error.message,
          variant: "destructive"
        });
        setUploadStep('upload');
      }
    });
  };

  const startImport = () => {
    if (!selectedFile) return;
    
    setUploadStep('importing');
    setUploadProgress(0);
    
    // Simulate progress during import
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 500);

    importJobsMutation.mutate(selectedFile);
  };

  const resetUpload = () => {
    setUploadStep('upload');
    setUploadProgress(0);
    setSelectedFile(null);
    setParsedCSV(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  if (uploadStep === 'upload') {
    return (
      <div className="space-y-6">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Upload Jobs CSV</h3>
            <p className="text-gray-600">
              Drag and drop your ServiceM8 jobs export file, or click to browse
            </p>
          </div>
          <div className="mt-6">
            <Button 
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-upload-jobs-csv"
            >
              <FileText className="h-4 w-4 mr-2" />
              Select Jobs CSV File
            </Button>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
          </div>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> Import customers first to ensure proper job-to-customer relationships. 
            Your CSV should include job numbers, descriptions, customer information, and dates in standard formats.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (uploadStep === 'parsing') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto animate-spin text-blue-600 mb-4" />
          <h3 className="text-lg font-medium">Parsing CSV File</h3>
          <p className="text-gray-600">Processing your jobs data...</p>
        </div>
        <Progress value={uploadProgress} className="w-full" />
      </div>
    );
  }

  if (uploadStep === 'preview' && parsedCSV) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Preview Jobs Data</h3>
            <p className="text-gray-600">
              Found {parsedCSV.data.length} jobs in your CSV file
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetUpload}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={startImport} data-testid="button-start-import">
              <ArrowRight className="h-4 w-4 mr-2" />
              Import Jobs
            </Button>
          </div>
        </div>

        {parsedCSV.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Found {parsedCSV.errors.length} parsing errors. Import may still proceed but some rows might be skipped.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Preview</CardTitle>
            <CardDescription>
              First 5 rows from your CSV file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    {parsedCSV.meta.fields?.slice(0, 6).map(field => (
                      <TableHead key={field} className="whitespace-nowrap">
                        {field}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedCSV.data.slice(0, 5).map((row, index) => (
                    <TableRow key={index}>
                      {parsedCSV.meta.fields?.slice(0, 6).map(field => (
                        <TableCell key={field} className="whitespace-nowrap">
                          {String(row[field] || '').substring(0, 50)}
                          {String(row[field] || '').length > 50 && '...'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (uploadStep === 'importing') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto animate-spin text-blue-600 mb-4" />
          <h3 className="text-lg font-medium">Importing Jobs</h3>
          <p className="text-gray-600">
            Processing {parsedCSV?.data.length || 0} jobs...
          </p>
        </div>
        <Progress value={uploadProgress} className="w-full" />
      </div>
    );
  }

  if (uploadStep === 'complete' && importResult) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
          <h3 className="text-lg font-medium">Import Complete</h3>
          <p className="text-gray-600">
            Your jobs have been successfully imported
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {importResult.imported}
              </div>
              <div className="text-sm text-gray-600">Imported</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {importResult.updated}
              </div>
              <div className="text-sm text-gray-600">Updated</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {importResult.skipped}
              </div>
              <div className="text-sm text-gray-600">Skipped</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">
                {importResult.totalProcessed}
              </div>
              <div className="text-sm text-gray-600">Total</div>
            </CardContent>
          </Card>
        </div>

        {importResult.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Import Errors:</strong>
              <ul className="mt-2 list-disc list-inside">
                {importResult.errors.slice(0, 5).map((error, index) => (
                  <li key={index} className="text-sm">{error}</li>
                ))}
              </ul>
              {importResult.errors.length > 5 && (
                <p className="text-sm mt-1">...and {importResult.errors.length - 5} more errors</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button onClick={resetUpload} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import More Jobs
          </Button>
          <Button onClick={() => window.location.href = '/job-dashboard'}>
            <Eye className="h-4 w-4 mr-2" />
            View Jobs
          </Button>
        </div>
      </div>
    );
  }

  return null;
}