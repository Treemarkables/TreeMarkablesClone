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
import { apiRequest } from "@/lib/queryClient";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Download,
  Users,
  ArrowRight,
  Loader2,
  Eye,
  Save
} from "lucide-react";
import Papa from "papaparse";

interface CustomerMatch {
  csvRow: number;
  csvData: {
    name?: string;
    email?: string;
    phone?: string;
    servicem8Uuid?: string;
    address?: string;
    [key: string]: any;
  };
  existingCustomer?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    servicem8Uuid?: string;
  };
  matchType: 'uuid' | 'email' | 'phone' | 'none';
  matchConfidence: 'high' | 'medium' | 'low';
  proposedName: string;
  willUpdate: boolean;
}

interface ParsedCSV {
  data: any[];
  errors: any[];
  meta: {
    fields?: string[];
  };
}

interface MatchingResult {
  matches: CustomerMatch[];
  totalRows: number;
  matchableRows: number;
  highConfidenceMatches: number;
  willUpdateCount: number;
}

interface BulkUpdateResult {
  success: boolean;
  updated: number;
  failed: number;
  errors: string[];
  message: string;
}

interface CSVImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
  totalProcessed: number;
  batchId: string;
}

export function CustomerCSVUpload() {
  const [uploadStep, setUploadStep] = useState<'upload' | 'parsing' | 'preview' | 'updating' | 'complete'>('upload');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null);
  const [matchingResult, setMatchingResult] = useState<MatchingResult | null>(null);
  const [bulkUpdateResult, setBulkUpdateResult] = useState<BulkUpdateResult | null>(null);
  const [csvImportResult, setCSVImportResult] = useState<CSVImportResult | null>(null);
  const [importMode, setImportMode] = useState<'update' | 'import'>('import');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // CSV parsing and matching mutation
  const parseAndMatchMutation = useMutation({
    mutationFn: async (file: File): Promise<MatchingResult> => {
      const formData = new FormData();
      formData.append('csvFile', file);
      
      // Use direct fetch for FormData to avoid Content-Type headers
      const response = await fetch('/api/customers/csv-match', {
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
    onSuccess: (result: MatchingResult) => {
      setMatchingResult(result);
      setUploadStep('preview');
      toast({
        title: "CSV Parsed Successfully",
        description: `Found ${result.matchableRows} customers with ${result.highConfidenceMatches} high-confidence matches`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Parsing Failed",
        description: error.message || "Failed to parse CSV file",
        variant: "destructive"
      });
      setUploadStep('upload');
    }
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async (matches: CustomerMatch[]): Promise<BulkUpdateResult> => {
      return await apiRequest('POST', '/api/customers/bulk-update', { matches });
    },
    onSuccess: (result: BulkUpdateResult) => {
      setBulkUpdateResult(result);
      setUploadStep('complete');
      
      // Invalidate customers cache to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      
      toast({
        title: "Update Complete",
        description: `Successfully updated ${result.updated} customers`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update customers",
        variant: "destructive"
      });
    }
  });

  // CSV Import mutation - for full import with new customers
  const csvImportMutation = useMutation({
    mutationFn: async (file: File): Promise<CSVImportResult> => {
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('importSource', 'csv_upload');
      
      // Use direct fetch for FormData to avoid Content-Type headers
      const response = await fetch('/api/customers/csv-import', {
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
    onSuccess: (result: CSVImportResult) => {
      setCSVImportResult(result);
      setUploadStep('complete');
      
      // Invalidate customers cache to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      
      toast({
        title: "Import Complete",
        description: `${result.imported} imported, ${result.updated} updated, ${result.skipped} skipped`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import CSV file",
        variant: "destructive"
      });
      setUploadStep('upload');
    }
  });

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    
    // Client-side CSV parsing for immediate feedback
    setUploadStep('parsing');
    setUploadProgress(25);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (results) => {
        setParsedCSV(results as ParsedCSV);
        setUploadProgress(50);
        
        // Send to server for matching
        parseAndMatchMutation.mutate(file);
      },
      error: (error) => {
        toast({
          title: "CSV Parse Error",
          description: error.message,
          variant: "destructive"
        });
        setUploadStep('upload');
      }
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        handleFileSelect(file);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please upload a CSV file",
          variant: "destructive"
        });
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleBulkUpdate = () => {
    if (!matchingResult?.matches) return;
    
    const matchesToUpdate = matchingResult.matches.filter(match => match.willUpdate);
    setUploadStep('updating');
    bulkUpdateMutation.mutate(matchesToUpdate);
  };

  const handleFullImport = () => {
    if (!selectedFile) return;
    
    setUploadStep('updating');
    csvImportMutation.mutate(selectedFile);
  };

  const resetUpload = () => {
    setUploadStep('upload');
    setSelectedFile(null);
    setParsedCSV(null);
    setMatchingResult(null);
    setBulkUpdateResult(null);
    setCSVImportResult(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getMatchBadge = (match: CustomerMatch) => {
    const matchTypeLabels = {
      'uuid': 'ServiceM8 UUID',
      'email': 'Email',
      'phone': 'Phone',
      'none': 'No match'
    };

    const confidenceColors = {
      'high': 'bg-green-100 text-green-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'low': 'bg-red-100 text-red-800'
    };

    return (
      <div className="flex flex-col gap-1">
        <Badge variant="outline" className="text-xs">
          {matchTypeLabels[match.matchType]}
        </Badge>
        {match.matchType !== 'none' && (
          <Badge className={`text-xs ${confidenceColors[match.matchConfidence]}`}>
            {match.matchConfidence} confidence
          </Badge>
        )}
      </div>
    );
  };

  if (uploadStep === 'upload') {
    return (
      <Card className="w-full" data-testid="card-csv-upload">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Customer CSV
          </CardTitle>
          <CardDescription>
            Upload a CSV file to automatically match and update customer names. 
            Supports ServiceM8 exports and custom formats.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver ? 'border-primary bg-primary/10' : 'border-muted-foreground/25'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            data-testid="csv-drop-zone"
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Drop your CSV file here</h3>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse files
            </p>
            <Button 
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-browse-files"
            >
              <FileText className="w-4 h-4 mr-2" />
              Choose CSV File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileInputChange}
              className="hidden"
              data-testid="input-csv-file"
            />
          </div>
          
          <div className="mt-6 space-y-4">
            <div>
              <h4 className="font-medium mb-2">Import Mode:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card 
                  className={`cursor-pointer transition-colors ${importMode === 'import' ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                  onClick={() => setImportMode('import')}
                  data-testid="card-import-mode-full"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full border-2 ${importMode === 'import' ? 'bg-primary border-primary' : 'border-muted-foreground'}`} />
                      <div>
                        <div className="font-medium">Full Import</div>
                        <div className="text-sm text-muted-foreground">Import new customers and update existing ones</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card 
                  className={`cursor-pointer transition-colors ${importMode === 'update' ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                  onClick={() => setImportMode('update')}
                  data-testid="card-import-mode-update"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full border-2 ${importMode === 'update' ? 'bg-primary border-primary' : 'border-muted-foreground'}`} />
                      <div>
                        <div className="font-medium">Update Only</div>
                        <div className="text-sm text-muted-foreground">Update existing customer names only</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Supported CSV Formats:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• ServiceM8 Customer Export (company_name, contact_first, contact_last, email, mobile, uuid)</li>
                <li>• Custom format with name, email, phone columns</li>
                <li>• Any CSV with customer identification fields</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (uploadStep === 'parsing') {
    return (
      <Card className="w-full" data-testid="card-csv-parsing">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing CSV File
          </CardTitle>
          <CardDescription>
            Parsing {selectedFile?.name} and matching customers...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={uploadProgress} className="w-full" />
            <div className="text-sm text-muted-foreground">
              {uploadProgress < 50 ? 'Parsing CSV data...' : 'Matching customers...'}
            </div>
            {parsedCSV && (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  Parsed {parsedCSV.data.length} rows from CSV file
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (uploadStep === 'preview' && matchingResult) {
    return (
      <Card className="w-full" data-testid="card-csv-preview">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Preview Customer Matches
          </CardTitle>
          <CardDescription>
            Review the matches before applying updates. {matchingResult.willUpdateCount} customers will be updated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{matchingResult.totalRows}</div>
                <div className="text-sm text-muted-foreground">Total Rows</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{matchingResult.matchableRows}</div>
                <div className="text-sm text-muted-foreground">Matchable</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{matchingResult.highConfidenceMatches}</div>
                <div className="text-sm text-muted-foreground">High Confidence</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{matchingResult.willUpdateCount}</div>
                <div className="text-sm text-muted-foreground">Will Update</div>
              </div>
            </div>

            <Separator />

            {/* Matches Table */}
            <div className="space-y-2">
              <h4 className="font-medium">Customer Matches</h4>
              <ScrollArea className="h-96 w-full border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>CSV Data</TableHead>
                      <TableHead>Match Type</TableHead>
                      <TableHead>Current Name</TableHead>
                      <TableHead>New Name</TableHead>
                      <TableHead className="w-20">Update</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchingResult.matches.map((match, index) => (
                      <TableRow key={index} data-testid={`match-row-${index}`}>
                        <TableCell>{match.csvRow}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{match.csvData.name || 'No name'}</div>
                            <div className="text-muted-foreground">{match.csvData.email}</div>
                            <div className="text-muted-foreground">{match.csvData.phone}</div>
                          </div>
                        </TableCell>
                        <TableCell>{getMatchBadge(match)}</TableCell>
                        <TableCell>
                          {match.existingCustomer ? (
                            <div className="text-sm">
                              <div className="font-medium">{match.existingCustomer.name}</div>
                              <div className="text-muted-foreground">{match.existingCustomer.email}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No match</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {match.willUpdate && (
                              <ArrowRight className="w-4 h-4 text-blue-500" />
                            )}
                            <span className={match.willUpdate ? 'font-medium text-blue-600' : 'text-muted-foreground'}>
                              {match.proposedName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {match.willUpdate ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <X className="w-4 h-4 text-red-500" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={resetUpload} data-testid="button-start-over">
                Start Over
              </Button>
              {importMode === 'update' ? (
                <Button 
                  onClick={handleBulkUpdate}
                  disabled={matchingResult.willUpdateCount === 0}
                  data-testid="button-apply-updates"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Apply Updates ({matchingResult.willUpdateCount})
                </Button>
              ) : (
                <Button 
                  onClick={handleFullImport}
                  data-testid="button-full-import"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import All Customers ({matchingResult.totalRows})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (uploadStep === 'updating') {
    return (
      <Card className="w-full" data-testid="card-csv-updating">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Updating Customers
          </CardTitle>
          <CardDescription>
            Applying customer name updates...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={100} className="w-full" />
            <div className="text-sm text-muted-foreground">
              Please wait while we update customer records...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (uploadStep === 'complete' && bulkUpdateResult) {
    return (
      <Card className="w-full" data-testid="card-csv-complete">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Update Complete
          </CardTitle>
          <CardDescription>
            Customer name updates have been successfully applied
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Results Summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{bulkUpdateResult.updated}</div>
                <div className="text-sm text-muted-foreground">Updated Successfully</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{bulkUpdateResult.failed}</div>
                <div className="text-sm text-muted-foreground">Failed Updates</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{bulkUpdateResult.updated + bulkUpdateResult.failed}</div>
                <div className="text-sm text-muted-foreground">Total Processed</div>
              </div>
            </div>

            {/* Success Message */}
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {bulkUpdateResult.message}
              </AlertDescription>
            </Alert>

            {/* Errors (if any) */}
            {bulkUpdateResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div className="font-medium">Some updates failed:</div>
                    {bulkUpdateResult.errors.slice(0, 5).map((error, index) => (
                      <div key={index} className="text-sm">• {error}</div>
                    ))}
                    {bulkUpdateResult.errors.length > 5 && (
                      <div className="text-sm">... and {bulkUpdateResult.errors.length - 5} more</div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={resetUpload} data-testid="button-upload-another">
                <Upload className="w-4 h-4 mr-2" />
                Upload Another CSV
              </Button>
              <Button onClick={resetUpload} data-testid="button-done">
                Done
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}