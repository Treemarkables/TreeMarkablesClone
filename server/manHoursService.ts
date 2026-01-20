import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  calculateEstimatedManHours,
  calculateActualManHours,
  calculateEstimationAccuracy,
  type ManHoursCalculation
} from "@shared/manHoursUtils";

/**
 * Man-Hours Tracking Service
 * 
 * Manages calculation and updates of estimated vs actual man-hours for job estimation accuracy tracking
 */
export class ManHoursService {
  /**
   * Recalculate and update estimated man-hours for a job based on staff assignments
   */
  async updateEstimatedManHours(jobId: string): Promise<void> {
    try {
      // Get all staff assignments for this job
      const assignments = await db
        .select()
        .from(schema.jobStaffAssignments)
        .where(eq(schema.jobStaffAssignments.jobId, jobId));

      // Calculate estimated man-hours
      const estimatedManHours = calculateEstimatedManHours(assignments);

      // Get current job data for actual man-hours
      const [job] = await db
        .select()
        .from(schema.jobs)
        .where(eq(schema.jobs.id, jobId));

      if (!job) {
        console.warn(`Job ${jobId} not found for man-hours update`);
        return;
      }

      // Calculate accuracy if we have both estimated and actual
      const actualManHours = job.actualManHours ? parseFloat(job.actualManHours as string) : 0;
      const metrics = calculateEstimationAccuracy(estimatedManHours, actualManHours);

      // Update job with new estimated man-hours and accuracy
      await db
        .update(schema.jobs)
        .set({
          estimatedManHours: estimatedManHours.toString(),
          estimationAccuracy: metrics.estimationAccuracy.toString(),
          estimationVariance: metrics.estimationVariance.toString(),
          updatedAt: new Date()
        })
        .where(eq(schema.jobs.id, jobId));

      console.log(`✓ Updated estimated man-hours for job ${jobId}: ${estimatedManHours} hours`);
    } catch (error) {
      console.error(`Error updating estimated man-hours for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Recalculate and update actual man-hours for a job based on time tracking entries
   */
  async updateActualManHours(jobId: string): Promise<void> {
    try {
      // Get all time tracking entries for this job
      const timeEntries = await db
        .select()
        .from(schema.jobTimeEntries)
        .where(eq(schema.jobTimeEntries.jobId, jobId));

      // Calculate actual man-hours
      const actualManHours = calculateActualManHours(timeEntries);

      // Get current job data for estimated man-hours
      const [job] = await db
        .select()
        .from(schema.jobs)
        .where(eq(schema.jobs.id, jobId));

      if (!job) {
        console.warn(`Job ${jobId} not found for man-hours update`);
        return;
      }

      // Calculate accuracy if we have both estimated and actual
      const estimatedManHours = job.estimatedManHours ? parseFloat(job.estimatedManHours as string) : 0;
      const metrics = calculateEstimationAccuracy(estimatedManHours, actualManHours);

      // Update job with new actual man-hours and accuracy
      await db
        .update(schema.jobs)
        .set({
          actualManHours: actualManHours.toString(),
          estimationAccuracy: metrics.estimationAccuracy.toString(),
          estimationVariance: metrics.estimationVariance.toString(),
          updatedAt: new Date()
        })
        .where(eq(schema.jobs.id, jobId));

      console.log(`✓ Updated actual man-hours for job ${jobId}: ${actualManHours} hours`);
    } catch (error) {
      console.error(`Error updating actual man-hours for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get complete man-hours metrics for a job
   */
  async getJobManHoursMetrics(jobId: string): Promise<ManHoursCalculation | null> {
    try {
      const [job] = await db
        .select()
        .from(schema.jobs)
        .where(eq(schema.jobs.id, jobId));

      if (!job) {
        return null;
      }

      const estimatedManHours = job.estimatedManHours ? parseFloat(job.estimatedManHours as string) : 0;
      const actualManHours = job.actualManHours ? parseFloat(job.actualManHours as string) : 0;

      return calculateEstimationAccuracy(estimatedManHours, actualManHours);
    } catch (error) {
      console.error(`Error getting man-hours metrics for job ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Get overall estimation accuracy metrics across all completed jobs
   */
  async getOverallEstimationMetrics(fromDate?: Date, toDate?: Date): Promise<{
    totalJobs: number;
    jobsWithEstimates: number;
    averageAccuracy: number;
    accuracyDistribution: {
      excellent: number; // >= 90%
      good: number; // >= 75%
      fair: number; // >= 60%
      poor: number; // < 60%
    };
    totalEstimatedHours: number;
    totalActualHours: number;
    overestimatedJobs: number;
    underestimatedJobs: number;
  }> {
    try {
      // Get all completed jobs with man-hours data
      let jobs = await db
        .select()
        .from(schema.jobs)
        .where(eq(schema.jobs.status, 'completed'));

      // Filter by date range if provided (using completedDate)
      if (fromDate || toDate) {
        jobs = jobs.filter(job => {
          if (!job.completedDate) return false;
          const completedDate = new Date(job.completedDate);
          if (fromDate && completedDate < fromDate) return false;
          if (toDate && completedDate > toDate) return false;
          return true;
        });
      }

      // Filter jobs that have both estimated and actual man-hours
      const jobsWithData = jobs.filter(job => 
        job.estimatedManHours && 
        job.actualManHours && 
        parseFloat(job.estimatedManHours as string) > 0
      );

      if (jobsWithData.length === 0) {
        return {
          totalJobs: jobs.length,
          jobsWithEstimates: 0,
          averageAccuracy: 0,
          accuracyDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
          totalEstimatedHours: 0,
          totalActualHours: 0,
          overestimatedJobs: 0,
          underestimatedJobs: 0
        };
      }

      // Calculate metrics
      let totalAccuracy = 0;
      let totalEstimated = 0;
      let totalActual = 0;
      let overestimated = 0;
      let underestimated = 0;
      const distribution = { excellent: 0, good: 0, fair: 0, poor: 0 };

      for (const job of jobsWithData) {
        const estimated = parseFloat(job.estimatedManHours as string);
        const actual = parseFloat(job.actualManHours as string);
        const accuracy = job.estimationAccuracy ? parseFloat(job.estimationAccuracy as string) : 0;

        totalAccuracy += accuracy;
        totalEstimated += estimated;
        totalActual += actual;

        // Track over/under estimation
        if (actual > estimated) {
          overestimated++;
        } else if (actual < estimated) {
          underestimated++;
        }

        // Accuracy distribution
        if (accuracy >= 90) {
          distribution.excellent++;
        } else if (accuracy >= 75) {
          distribution.good++;
        } else if (accuracy >= 60) {
          distribution.fair++;
        } else {
          distribution.poor++;
        }
      }

      return {
        totalJobs: jobs.length,
        jobsWithEstimates: jobsWithData.length,
        averageAccuracy: totalAccuracy / jobsWithData.length,
        accuracyDistribution: distribution,
        totalEstimatedHours: totalEstimated,
        totalActualHours: totalActual,
        overestimatedJobs: overestimated,
        underestimatedJobs: underestimated
      };
    } catch (error) {
      console.error('Error calculating overall estimation metrics:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const manHoursService = new ManHoursService();
