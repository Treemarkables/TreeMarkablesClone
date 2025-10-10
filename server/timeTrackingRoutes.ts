import { Request, Response } from "express";
import { z } from "zod";
import { timeTrackingService } from "./timeTrackingService";
import { storage } from "./storage";
import {
  dailyTimeFormSchema,
  staffRateFormSchema,
} from "../shared/timeTracking";

// Request validation schemas
const saveDailyTimeSchema = z.object({
  jobId: z.string().min(1, "Job ID is required"),
  employeeId: z.string().min(1, "Employee ID is required"),
  employeeName: z.string().min(1, "Employee name is required"),
  entryDate: z.string().min(1, "Entry date is required"),
  totalDayHours: z.number().min(0, "Total day hours must be positive"),
  timeEntries: z.array(z.object({
    jobId: z.string().min(1, "Job ID is required"),
    jobNumber: z.string().min(1, "Job number is required"),
    employeeId: z.string().min(1, "Employee ID is required"),
    employeeName: z.string().min(1, "Employee name is required"),
    lineItemId: z.string().min(1, "Line item ID is required"),
    lineItemNumber: z.string().min(1, "Line item number is required"),
    lineItemName: z.string().min(1, "Line item name is required"),
    lineItemCategory: z.string().min(1, "Line item category is required"),
    hours: z.number().min(0, "Hours must be positive"),
    rate: z.number().min(0, "Rate must be positive"),
    startTime: z.string().optional(),
    billed: z.boolean().default(false),
  })),
  maintenanceHours: z.number().min(0).default(0),
  travelHours: z.number().min(0).default(0),
  adminHours: z.number().min(0).default(0),
  breakHours: z.number().min(0).default(0),
  roundingMode: z.enum(["none", "15min", "30min", "1hour"]).default("none"),
  travelTimeMode: z.enum(["included", "excluded", "separate"]).default("included"),
  efficiency: z.any().optional(), // Allow efficiency data to be passed through
});

/**
 * ServiceM8-Style Time Tracking API Routes
 */
export function setupTimeTrackingRoutes(app: any) {
  
  // ========================================
  // DAILY TIME ENTRY ENDPOINTS
  // ========================================

  // POST /api/time-entries/daily - Save complete daily time entry
  app.post('/api/time-entries/daily', async (req: Request, res: Response) => {
    try {
      const validation = saveDailyTimeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid time entry data',
          errors: validation.error.errors 
        });
      }

      const result = await timeTrackingService.saveDailyTimeEntry(validation.data);
      
      res.json({ 
        success: true, 
        data: result,
        message: `Saved ${validation.data.timeEntries.length} time entries with ${result.dailyEntry.jobEfficiency}% efficiency`
      });
    } catch (error) {
      console.error('Error saving daily time entry:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error saving time entry' 
      });
    }
  });

  // GET /api/time-entries/daily - Get daily time entries
  app.get('/api/time-entries/daily', async (req: Request, res: Response) => {
    try {
      const { employeeId, fromDate, toDate } = req.query;
      
      const entries = await timeTrackingService.getDailyTimeEntries(
        employeeId as string,
        fromDate as string,
        toDate as string
      );
      
      res.json({ success: true, data: entries });
    } catch (error) {
      console.error('Error fetching daily time entries:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching time entries' 
      });
    }
  });

  // GET /api/time-entries/daily/:employeeId/:date - Get specific daily entry
  app.get('/api/time-entries/daily/:employeeId/:date', async (req: Request, res: Response) => {
    try {
      const { employeeId, date } = req.params;
      const entry = await timeTrackingService.getDailyTimeEntry(employeeId, date);
      
      if (!entry) {
        return res.status(404).json({
          success: false,
          message: 'Daily time entry not found'
        });
      }
      
      res.json({ success: true, data: entry });
    } catch (error) {
      console.error('Error fetching daily time entry:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching time entry' 
      });
    }
  });

  // ========================================
  // JOB TIME ENTRY ENDPOINTS
  // ========================================

  // GET /api/time-entries/:jobId/:date? - Get time entries for a job
  app.get('/api/time-entries/:jobId/:date?', async (req: Request, res: Response) => {
    try {
      const { jobId, date } = req.params;
      console.log('GET /api/time-entries called with:', { jobId, date });
      
      const entries = await timeTrackingService.getJobTimeEntries(jobId, date);
      console.log('Retrieved entries:', entries.length, 'entries:', entries);
      
      res.json({ success: true, data: entries });
    } catch (error) {
      console.error('Error fetching job time entries:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching job time entries' 
      });
    }
  });

  // POST /api/time-entries/:jobId - Create job time entries for a specific job
  app.post('/api/time-entries/:jobId', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const { entries, rounding, travelTime, additionalCosts } = req.body;
      
      console.log('POST /api/time-entries/:jobId called with:', {
        jobId,
        entriesCount: entries?.length,
        entries: entries,
        rounding,
        travelTime,
        additionalCosts
      });
      
      if (!entries || !Array.isArray(entries)) {
        console.log('Invalid entries data:', entries);
        return res.status(400).json({
          success: false,
          message: 'Invalid entries data'
        });
      }

      const createdEntries = [];
      
      // First, create or get a daily entry for today
      const today = new Date().toISOString().split('T')[0];
      let dailyEntry = await timeTrackingService.getDailyTimeEntry(entries[0]?.employeeId || 'default', today);
      
      if (!dailyEntry) {
        dailyEntry = await timeTrackingService.createDailyTimeEntry({
          employeeId: entries[0]?.employeeId || 'default',
          entryDate: today,
          totalHours: 0,
          breakTime: 0,
          notes: 'Auto-generated for time tracking',
          timeEntries: []
        });
      }
      
      for (const entry of entries) {
        console.log('Creating job time entry for:', entry);
        
        // Create job time entry with all required fields
        const jobTimeEntry = await timeTrackingService.createJobTimeEntry({
          dailyEntryId: dailyEntry.id,
          jobId,
          jobNumber: entry.jobNumber || '3317',
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
          
          // Line item fields (required)
          lineItemId: entry.lineItemId,
          lineItemNumber: entry.lineItemNumber,
          lineItemName: entry.lineItemName,
          lineItemCategory: entry.lineItemCategory,
          
          // Time details
          entryDate: entry.entryDate,
          startTime: entry.startTime,
          hours: entry.hours,
          rate: entry.rate,
          
          // ServiceM8 features
          billed: entry.billed !== false,
          roundingMode: entry.roundingMode || 'none',
          travelTimeIncluded: entry.travelTimeIncluded || false
        });
        
        console.log('Created job time entry:', jobTimeEntry);
        createdEntries.push(jobTimeEntry);
      }
      
      console.log('Successfully created', createdEntries.length, 'time entries');
      
      // Calculate total labor cost from time entries
      const totalLaborCost = createdEntries.reduce((sum, entry) => {
        const hours = parseFloat(entry.hours?.toString() || '0');
        const rate = parseFloat(entry.rate?.toString() || '0');
        return sum + (hours * rate);
      }, 0);
      
      // Update job with calculated labor cost and additional costs
      try {
        const job = await storage.getJob(jobId);
        if (job) {
          const updates: any = {
            calculatedLaborCost: totalLaborCost.toString(),
            totalStaffHours: createdEntries.reduce((sum, e) => sum + parseFloat(e.hours?.toString() || '0'), 0).toString()
          };
          
          // Also update additional costs if provided
          if (additionalCosts !== undefined && additionalCosts !== null) {
            updates.laborCosts = additionalCosts.toString();
          }
          
          await storage.updateJob(jobId, updates);
          console.log('Updated job labor costs:', { 
            calculatedLaborCost: totalLaborCost, 
            additionalCosts: additionalCosts || 0 
          });
        }
      } catch (error) {
        console.error('Error updating job labor costs:', error);
        // Don't fail the whole request if this fails
      }
      
      res.json({ 
        success: true, 
        data: createdEntries,
        message: `Created ${createdEntries.length} time entries for job ${jobId}`
      });
    } catch (error) {
      console.error('Error creating job time entries:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error creating time entries',
        error: error.message
      });
    }
  });

  // PUT /api/time-entries/job/:id - Update job time entry
  app.put('/api/time-entries/job/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const entry = await timeTrackingService.updateJobTimeEntry(id, updates);
      res.json({ success: true, data: entry });
    } catch (error) {
      console.error('Error updating job time entry:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error updating time entry' 
      });
    }
  });

  // DELETE /api/time-entries/job/:id - Delete job time entry
  app.delete('/api/time-entries/job/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await timeTrackingService.deleteJobTimeEntry(id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Time entry not found'
        });
      }
      
      res.json({ success: true, message: 'Time entry deleted' });
    } catch (error) {
      console.error('Error deleting job time entry:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error deleting time entry' 
      });
    }
  });

  // ========================================
  // STAFF RATE MANAGEMENT ENDPOINTS
  // ========================================

  // GET /api/staff-rates - Get staff rates
  app.get('/api/staff-rates', async (req: Request, res: Response) => {
    try {
      const { employeeId, serviceType } = req.query;
      const rates = await timeTrackingService.getStaffRates(
        employeeId as string,
        serviceType as string
      );
      
      res.json({ success: true, data: rates });
    } catch (error) {
      console.error('Error fetching staff rates:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching staff rates' 
      });
    }
  });

  // GET /api/staff-rates/:employeeId/:serviceType - Get active rate for employee/service
  app.get('/api/staff-rates/:employeeId/:serviceType', async (req: Request, res: Response) => {
    try {
      const { employeeId, serviceType } = req.params;
      const rate = await timeTrackingService.getActiveStaffRate(employeeId, serviceType);
      
      if (!rate) {
        return res.status(404).json({
          success: false,
          message: 'No active rate found for this employee and service type'
        });
      }
      
      res.json({ success: true, data: rate });
    } catch (error) {
      console.error('Error fetching staff rate:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching staff rate' 
      });
    }
  });

  // POST /api/staff-rates - Create new staff rate
  app.post('/api/staff-rates', async (req: Request, res: Response) => {
    try {
      const validation = staffRateFormSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid staff rate data',
          errors: validation.error.errors 
        });
      }

      const rate = await timeTrackingService.createStaffRate({
        ...validation.data,
        hourlyRate: validation.data.hourlyRate,
        effectiveDate: new Date(),
        isActive: true,
      });
      
      res.json({ success: true, data: rate });
    } catch (error) {
      console.error('Error creating staff rate:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error creating staff rate' 
      });
    }
  });

  // ========================================
  // EFFICIENCY REPORTING ENDPOINTS
  // ========================================

  // GET /api/efficiency/staff/:employeeId - Get staff efficiency report
  app.get('/api/efficiency/staff/:employeeId', async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.params;
      const { fromDate, toDate } = req.query;
      
      if (!fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          message: 'fromDate and toDate are required'
        });
      }

      const report = await timeTrackingService.calculateStaffEfficiency(
        employeeId,
        fromDate as string,
        toDate as string
      );
      
      res.json({ success: true, data: report });
    } catch (error) {
      console.error('Error calculating staff efficiency:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error calculating efficiency' 
      });
    }
  });

  // GET /api/efficiency/reports - Get all staff efficiency reports
  app.get('/api/efficiency/reports', async (req: Request, res: Response) => {
    try {
      const { fromDate, toDate } = req.query;
      
      if (!fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          message: 'fromDate and toDate are required'
        });
      }

      const reports = await timeTrackingService.getEfficiencyReports(
        fromDate as string,
        toDate as string
      );
      
      res.json({ success: true, data: reports });
    } catch (error) {
      console.error('Error fetching efficiency reports:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching efficiency reports' 
      });
    }
  });

  // POST /api/efficiency/calculate - Calculate efficiency for given parameters
  app.post('/api/efficiency/calculate', async (req: Request, res: Response) => {
    try {
      const { 
        totalDayHours, 
        billableHours, 
        travelHours = 0, 
        maintenanceHours = 0, 
        adminHours = 0 
      } = req.body;

      if (!totalDayHours || !billableHours) {
        return res.status(400).json({
          success: false,
          message: 'totalDayHours and billableHours are required'
        });
      }

      const metrics = timeTrackingService.calculateEfficiencyMetrics(
        totalDayHours,
        billableHours,
        travelHours,
        maintenanceHours,
        adminHours
      );
      
      res.json({ success: true, data: metrics });
    } catch (error) {
      console.error('Error calculating efficiency metrics:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error calculating efficiency' 
      });
    }
  });

  console.log('⏰ Time tracking API routes registered');
}