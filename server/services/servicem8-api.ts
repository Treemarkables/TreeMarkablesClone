import { z } from 'zod';
import { 
  servicem8JobSchema,
  servicem8DiaryEntrySchema,
  servicem8QuoteSchema,
  servicem8InvoiceSchema,
  servicem8CompanySchema,
  servicem8NoteSchema
} from '@shared/schema';

// Define the API response types - nullable fields match ServiceM8 schema availability
export interface ServiceM8Job {
  id: string;
  jobNumber: string | null;
  description: string | null;
  address: string | null;
  customerUuid: string | null; // Not available in ServiceM8 job schema
  status: string;
  priority: string | null; // Not available in ServiceM8 job schema
  value: number | null; // Not available in ServiceM8 job schema
  workStartDate: Date | null; // Not available in ServiceM8 job schema
  workEndDate: Date | null; // Not available in ServiceM8 job schema
  createdAt: Date | null;
  active: boolean;
}

export interface ServiceM8DiaryEntry {
  id: string;
  jobUuid: string;
  staffUuid: string | null; // Not available in ServiceM8 diary schema
  entryType: string | null;
  note: string | null; // Only available in note schema, not diary schema
  objectUuid: string | null;
  entryDate: Date | null;
  createdAt: Date | null; // Not available in ServiceM8 diary schema
  active: boolean;
}

export interface ServiceM8Quote {
  id: string;
  jobUuid: string | null;
  quoteNumber: string | null;
  status: string | null; // Not available in ServiceM8 quote schema
  value: number | null;
  quoteDate: Date | null;
  expiryDate: Date | null; // Not available in ServiceM8 quote schema
  createdAt: Date | null; // Not available in ServiceM8 quote schema
  active: boolean;
}

export interface ServiceM8Invoice {
  id: string;
  jobUuid: string; // Same as ID since jobs ARE invoices in ServiceM8
  invoiceNumber: string | null;
  status: string | null;
  value: number | null;
  invoiceDate: Date | null;
  dueDate: Date | null; // Not available in ServiceM8 invoice schema
  createdAt: Date | null;
  active: boolean;
}

export interface ServiceM8Customer {
  id: string;
  firstName: string | null; // Not available in ServiceM8 company schema
  lastName: string | null; // Not available in ServiceM8 company schema
  companyName: string;
  email: string | null;
  mobile: string | null; // Not available in ServiceM8 company schema
  phone: string | null;
  billingAddress: string | null;
  createdAt: Date | null; // Not available in ServiceM8 company schema
  active: boolean;
}

// ServiceM8 API Configuration
const SERVICEM8_API_CONFIG = {
  baseUrl: 'https://api.servicem8.com/api/1.0',
  version: '1.0',
  userAgent: 'Treemarkables-Dispatch/1.0',
  maxRetries: 3,
  timeoutMs: 30000,
  rateLimitDelay: 1000, // 1 second between requests
} as const;

// Data transformation helpers using shared schemas - NO FABRICATED DATA
const DataMappers = {
  job: (rawJob: any): ServiceM8Job => {
    const validated = servicem8JobSchema.parse(rawJob);

    return {
      id: validated.uuid,
      jobNumber: validated.generated_job_id || null,
      description: validated.job_description || null,
      address: validated.job_address || null,
      customerUuid: null, // ServiceM8 doesn't provide customer UUID in job schema
      status: validated.status,
      priority: null, // ServiceM8 doesn't provide priority in job schema
      value: null, // ServiceM8 doesn't provide value in job schema
      workStartDate: null, // ServiceM8 doesn't provide work dates in job schema
      workEndDate: null, // ServiceM8 doesn't provide work dates in job schema
      createdAt: validated.created_timestamp ? new Date(validated.created_timestamp) : 
                 (validated.last_updated_timestamp ? new Date(validated.last_updated_timestamp) : null),
      active: validated.active !== false,
    };
  },

  diaryEntry: (rawEntry: any): ServiceM8DiaryEntry => {
    const validated = servicem8DiaryEntrySchema.parse(rawEntry);
    if (!validated.uuid) {
      throw new Error('ServiceM8 diary entry missing required UUID');
    }
    return {
      id: validated.uuid,
      jobUuid: validated.job_uuid,
      staffUuid: validated.staff_uuid || null, // Staff attribution from ServiceM8 API
      entryType: validated.object_type || null,
      note: null, // No note text in diary entry - use note schema for that
      objectUuid: validated.object_uuid || null, // Object reference from ServiceM8 API
      entryDate: validated.start_date ? new Date(validated.start_date) : null,
      createdAt: null, // Not available in ServiceM8 diary schema
      active: !validated.is_deleted,
    };
  },

  note: (rawNote: any): ServiceM8DiaryEntry => {
    const validated = servicem8NoteSchema.parse(rawNote);
    return {
      id: validated.uuid,
      jobUuid: validated.job_uuid,
      staffUuid: validated.staff_uuid || null,
      entryType: 'note',
      note: validated.note, // Actual note text from ServiceM8
      objectUuid: validated.uuid,
      entryDate: validated.created_timestamp ? new Date(validated.created_timestamp) : null,
      createdAt: validated.created_timestamp ? new Date(validated.created_timestamp) : null,
      active: true, // Notes don't have deletion flag in schema
    };
  },

  quote: (rawQuote: any): ServiceM8Quote => {
    const validated = servicem8QuoteSchema.parse(rawQuote);
    return {
      id: validated.uuid,
      jobUuid: validated.job_uuid || null,
      quoteNumber: validated.quote_number || null,
      status: null, // ServiceM8 doesn't provide quote status in schema
      value: validated.quote_total || null,
      quoteDate: validated.quote_date ? new Date(validated.quote_date) : null,
      expiryDate: null, // ServiceM8 doesn't provide expiry date in schema
      createdAt: null, // ServiceM8 doesn't provide created timestamp in schema
      active: validated.active !== false,
    };
  },

  invoice: (rawInvoice: any): ServiceM8Invoice => {
    const validated = servicem8InvoiceSchema.parse(rawInvoice);
    
    // Validate that we have a proper job UUID for referential integrity
    const jobUuid = validated.job_uuid || validated.uuid;
    if (!jobUuid) {
      throw new Error('ServiceM8 invoice missing required job UUID for referential integrity');
    }
    
    return {
      id: validated.uuid, // ServiceM8 invoice UUID
      jobUuid: jobUuid, // Associated job UUID from ServiceM8 API (validated above)
      invoiceNumber: validated.generated_job_id || null,
      status: validated.invoice_status || null,
      value: validated.job_total || null,
      invoiceDate: validated.invoice_date ? new Date(validated.invoice_date) : null,
      dueDate: null, // Not available in ServiceM8 schema
      createdAt: validated.created_timestamp ? new Date(validated.created_timestamp) : null,
      active: validated.active !== false,
    };
  },

  customer: (rawCustomer: any): ServiceM8Customer => {
    const validated = servicem8CompanySchema.parse(rawCustomer);
    return {
      id: validated.uuid,
      firstName: null, // ServiceM8 doesn't provide firstName in company schema
      lastName: null, // ServiceM8 doesn't provide lastName in company schema  
      companyName: validated.name,
      email: validated.email || null,
      mobile: null, // ServiceM8 doesn't provide mobile in company schema
      phone: validated.phone || null,
      billingAddress: validated.address || null,
      createdAt: null, // ServiceM8 doesn't provide created timestamp in schema
      active: validated.active !== false,
    };
  },
};

// Rate limiting helper
class RateLimiter {
  private lastRequestTime = 0;
  private readonly delayMs: number;

  constructor(delayMs: number) {
    this.delayMs = delayMs;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.delayMs) {
      const waitTime = this.delayMs - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
}

export interface ServiceM8ApiCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface ServiceM8FetchOptions {
  limit?: number;
  offset?: number;
  filter?: Record<string, any>;
  orderBy?: string;
  since?: Date; // For incremental sync
}

export interface ServiceM8FetchResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
}

export class ServiceM8ApiService {
  private credentials: ServiceM8ApiCredentials;
  private rateLimiter: RateLimiter;

  constructor(credentials: ServiceM8ApiCredentials) {
    this.credentials = credentials;
    this.rateLimiter = new RateLimiter(SERVICEM8_API_CONFIG.rateLimitDelay);
  }

  /**
   * Update API credentials (e.g., after token refresh)
   */
  updateCredentials(credentials: ServiceM8ApiCredentials): void {
    this.credentials = credentials;
  }

  /**
   * Make authenticated request to ServiceM8 API
   */
  private async makeRequest<T>(
    endpoint: string,
    options: ServiceM8FetchOptions = {}
  ): Promise<ServiceM8FetchResult<T>> {
    await this.rateLimiter.wait();

    const { limit = 100, offset = 0, filter, orderBy, since } = options;

    // Build query parameters
    const params = new URLSearchParams({
      '$format': 'json',
      '$limit': limit.toString(),
      '$offset': offset.toString(),
    });

    if (orderBy) {
      params.append('$orderby', orderBy);
    }

    // Build combined filter expression
    const filterExpressions: string[] = [];

    if (since) {
      // ServiceM8 uses timestamp filtering for incremental sync
      filterExpressions.push(`created_timestamp gt '${since.toISOString()}'`);
    }

    if (filter) {
      // Add custom filters
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          const filterExpression = typeof value === 'string' 
            ? `${key} eq '${value}'`
            : `${key} eq ${value}`;
          filterExpressions.push(filterExpression);
        }
      });
    }

    // Combine all filters with AND
    if (filterExpressions.length > 0) {
      params.append('$filter', filterExpressions.join(' and '));
    }

    const url = `${SERVICEM8_API_CONFIG.baseUrl}/${endpoint}?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'User-Agent': SERVICEM8_API_CONFIG.userAgent,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(SERVICEM8_API_CONFIG.timeoutMs),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('ServiceM8 API authentication failed - token may be expired');
      }
      if (response.status === 429) {
        throw new Error('ServiceM8 API rate limit exceeded - please retry later');
      }
      throw new Error(`ServiceM8 API error: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    // ServiceM8 returns bare arrays, validate as array
    if (!Array.isArray(responseData)) {
      throw new Error('ServiceM8 API did not return expected array format');
    }

    return {
      data: responseData as T[],
      total: responseData.length,
      hasMore: responseData.length === limit,
      nextOffset: responseData.length === limit ? offset + limit : undefined,
    };
  }

  /**
   * Fetch jobs from ServiceM8
   */
  async fetchJobs(options: ServiceM8FetchOptions = {}): Promise<ServiceM8FetchResult<ServiceM8Job>> {
    try {
      const result = await this.makeRequest<any>('job.json', {
        ...options,
        orderBy: options.orderBy || 'created_timestamp desc',
      });

      // Transform and validate each job using the shared mapper
      const jobs: ServiceM8Job[] = result.data.map(DataMappers.job);

      return {
        ...result,
        data: jobs,
      };
    } catch (error) {
      throw new Error(`Failed to fetch ServiceM8 jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch diary entries AND notes from ServiceM8 and merge them
   */
  async fetchDiaryEntries(options: ServiceM8FetchOptions = {}): Promise<ServiceM8FetchResult<ServiceM8DiaryEntry>> {
    try {
      // Fetch both diary entries and notes in parallel
      const [diaryResult, notesResult] = await Promise.all([
        this.makeRequest<any>('diary.json', {
          ...options,
          orderBy: options.orderBy || 'start_date desc', // Use valid diary field for ordering
        }),
        this.makeRequest<any>('note.json', {
          ...options,
          orderBy: options.orderBy || 'created_timestamp desc', // Notes have created_timestamp
        }),
      ]);

      // Transform diary entries
      const diaryEntries: ServiceM8DiaryEntry[] = diaryResult.data.map(DataMappers.diaryEntry);
      const noteEntries: ServiceM8DiaryEntry[] = notesResult.data.map(DataMappers.note);

      // Create lookup maps for efficient merging
      const diaryByObjectUuid = new Map<string, ServiceM8DiaryEntry>();
      const diaryByJobAndTime = new Map<string, ServiceM8DiaryEntry>();

      // Index diary entries by object_uuid (primary) and job+time (fallback)
      diaryEntries.forEach(entry => {
        if (entry.objectUuid) {
          diaryByObjectUuid.set(entry.objectUuid, entry);
        }
        
        // Also index by job+time as fallback (only for entries with valid timestamps)
        if (entry.entryDate && entry.jobUuid) {
          const timeKey = `${entry.jobUuid}-${entry.entryDate.getTime()}`;
          diaryByJobAndTime.set(timeKey, entry);
        }
      });

      // Merge notes into corresponding diary entries
      const mergedNoteIds = new Set<string>();

      noteEntries.forEach(note => {
        let targetDiaryEntry: ServiceM8DiaryEntry | undefined;

        // Primary matching: Use ServiceM8's object_uuid linking
        if (note.objectUuid && diaryByObjectUuid.has(note.objectUuid)) {
          targetDiaryEntry = diaryByObjectUuid.get(note.objectUuid);
        }
        // Fallback matching: Only if BOTH note and potential diary lack object_uuid
        else if (!note.objectUuid && note.entryDate && note.jobUuid) {
          const noteTime = note.entryDate.getTime();
          
          // Look for diary entries on same job within ±1 minute that also lack object_uuid
          for (const diaryEntry of diaryEntries) {
            if (!diaryEntry.objectUuid && 
                diaryEntry.jobUuid === note.jobUuid && 
                diaryEntry.entryDate) {
              
              const diaryTime = diaryEntry.entryDate.getTime();
              const timeDiff = Math.abs(noteTime - diaryTime);
              
              // Match within 1 minute tolerance (60,000 milliseconds)
              if (timeDiff <= 60000) {
                targetDiaryEntry = diaryEntry;
                break;
              }
            }
          }
        }

        // If we found a matching diary entry, merge the note data
        if (targetDiaryEntry) {
          targetDiaryEntry.note = note.note;
          targetDiaryEntry.staffUuid = note.staffUuid || targetDiaryEntry.staffUuid;
          mergedNoteIds.add(note.id);
        }
      });

      // Keep only standalone notes that weren't merged
      const standaloneNotes = noteEntries.filter(note => !mergedNoteIds.has(note.id));

      // Combine merged diary entries with standalone notes
      const allEntries = [...diaryEntries, ...standaloneNotes];

      // Sort by date (most recent first)
      allEntries.sort((a, b) => {
        const dateA = a.entryDate || new Date(0);
        const dateB = b.entryDate || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      return {
        data: allEntries,
        total: allEntries.length,
        hasMore: diaryResult.hasMore || notesResult.hasMore,
        nextOffset: Math.max(diaryResult.nextOffset || 0, notesResult.nextOffset || 0),
      };
    } catch (error) {
      throw new Error(`Failed to fetch ServiceM8 diary entries and notes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch quotes from ServiceM8
   */
  async fetchQuotes(options: ServiceM8FetchOptions = {}): Promise<ServiceM8FetchResult<ServiceM8Quote>> {
    try {
      const result = await this.makeRequest<any>('quote.json', {
        ...options,
        orderBy: options.orderBy || 'created_timestamp desc',
      });

      // Transform and validate each quote using the shared mapper
      const quotes: ServiceM8Quote[] = result.data.map(DataMappers.quote);

      return {
        ...result,
        data: quotes,
      };
    } catch (error) {
      throw new Error(`Failed to fetch ServiceM8 quotes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch invoices from ServiceM8
   */
  async fetchInvoices(options: ServiceM8FetchOptions = {}): Promise<ServiceM8FetchResult<ServiceM8Invoice>> {
    try {
      const result = await this.makeRequest<any>('invoice.json', {
        ...options,
        orderBy: options.orderBy || 'created_timestamp desc',
      });

      // Transform and validate each invoice using the shared mapper
      const invoices: ServiceM8Invoice[] = result.data.map(DataMappers.invoice);

      return {
        ...result,
        data: invoices,
      };
    } catch (error) {
      throw new Error(`Failed to fetch ServiceM8 invoices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch customers from ServiceM8
   */
  async fetchCustomers(options: ServiceM8FetchOptions = {}): Promise<ServiceM8FetchResult<ServiceM8Customer>> {
    try {
      const result = await this.makeRequest<any>('company.json', {
        ...options,
        orderBy: options.orderBy || 'created_timestamp desc',
      });

      // Transform and validate each customer using the shared mapper
      const customers: ServiceM8Customer[] = result.data.map(DataMappers.customer);

      return {
        ...result,
        data: customers,
      };
    } catch (error) {
      throw new Error(`Failed to fetch ServiceM8 customers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test API connection and credentials
   */
  async testConnection(): Promise<{ success: boolean; message: string; companyInfo?: any }> {
    try {
      // Fetch a small amount of data to test connection
      const result = await this.makeRequest<any>('company.json', { limit: 1 });
      
      return {
        success: true,
        message: 'ServiceM8 API connection successful',
        companyInfo: result.data[0] || null,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown API connection error',
      };
    }
  }

  /**
   * Perform bulk data sync from ServiceM8
   */
  async performBulkSync(since?: Date): Promise<{
    jobs: ServiceM8Job[];
    diaryEntries: ServiceM8DiaryEntry[];
    quotes: ServiceM8Quote[];
    invoices: ServiceM8Invoice[];
    customers: ServiceM8Customer[];
    syncTimestamp: Date;
  }> {
    const syncTimestamp = new Date();
    
    try {
      // Fetch all data in parallel for efficiency  
      const [jobsRaw, diaryEntriesResult, quotesRaw, invoicesRaw, customersRaw] = await Promise.all([
        this.fetchAllData<any>('job.json', { since }),
        this.fetchDiaryEntries({ since }), // Use the enhanced diary entries fetch that includes notes
        this.fetchAllData<any>('quote.json', { since }),
        this.fetchAllData<any>('invoice.json', { since }),
        this.fetchAllData<any>('company.json', { since }),
      ]);

      // Transform raw data using the shared mappers
      const jobs: ServiceM8Job[] = jobsRaw.map(DataMappers.job);
      const diaryEntries: ServiceM8DiaryEntry[] = diaryEntriesResult.data; // Already transformed by fetchDiaryEntries
      const quotes: ServiceM8Quote[] = quotesRaw.map(DataMappers.quote);
      const invoices: ServiceM8Invoice[] = invoicesRaw.map(DataMappers.invoice);
      const customers: ServiceM8Customer[] = customersRaw.map(DataMappers.customer);

      return {
        jobs,
        diaryEntries,
        quotes,
        invoices,
        customers,
        syncTimestamp,
      };
    } catch (error) {
      throw new Error(`ServiceM8 bulk sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Helper to fetch all data with pagination
   */
  private async fetchAllData<T>(
    endpoint: string,
    baseOptions: ServiceM8FetchOptions = {}
  ): Promise<T[]> {
    const allData: T[] = [];
    let hasMore = true;
    let offset = 0;

    while (hasMore) {
      const options = { ...baseOptions, offset };
      const result = await this.makeRequest<T>(endpoint, options);
      allData.push(...result.data);
      hasMore = result.hasMore;
      
      if (result.nextOffset !== undefined) {
        offset = result.nextOffset;
      } else {
        hasMore = false;
      }

      // Safety check to prevent infinite loops
      if (result.data.length === 0) {
        break;
      }
    }

    return allData;
  }
}