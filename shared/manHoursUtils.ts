/**
 * Man-Hours Tracking & Estimation Accuracy Utilities
 * 
 * Functions to calculate estimated vs actual man-hours for job estimation accuracy
 */

export interface ManHoursCalculation {
  estimatedManHours: number;
  actualManHours: number;
  estimationAccuracy: number; // Percentage (0-100)
  estimationVariance: number; // actual - estimated
  status: 'under' | 'over' | 'exact' | 'unknown';
}

/**
 * Calculate estimated man-hours from staff assignments
 * Formula: Sum of (number of staff × scheduled hours for each assignment)
 */
export function calculateEstimatedManHours(staffAssignments: Array<{
  startTime: Date | string;
  endTime: Date | string;
}>): number {
  if (!staffAssignments || staffAssignments.length === 0) {
    return 0;
  }

  let totalManHours = 0;

  for (const assignment of staffAssignments) {
    const start = new Date(assignment.startTime);
    const end = new Date(assignment.endTime);
    const hoursPerPerson = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    // Each assignment is 1 person
    totalManHours += hoursPerPerson;
  }

  return Math.round(totalManHours * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate actual man-hours from time tracking entries
 * Formula: Sum of all hours logged by all employees
 */
export function calculateActualManHours(timeEntries: Array<{
  hours: number | string;
}>): number {
  if (!timeEntries || timeEntries.length === 0) {
    return 0;
  }

  const totalHours = timeEntries.reduce((sum, entry) => {
    const hours = typeof entry.hours === 'string' ? parseFloat(entry.hours) : entry.hours;
    return sum + (isNaN(hours) ? 0 : hours);
  }, 0);

  return Math.round(totalHours * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate estimation accuracy metrics
 * 
 * Accuracy = (1 - |estimated - actual| / estimated) × 100
 * Variance = actual - estimated
 */
export function calculateEstimationAccuracy(
  estimatedManHours: number,
  actualManHours: number
): ManHoursCalculation {
  // If no estimate exists, we can't calculate accuracy
  if (!estimatedManHours || estimatedManHours === 0) {
    return {
      estimatedManHours,
      actualManHours,
      estimationAccuracy: 0,
      estimationVariance: 0,
      status: 'unknown'
    };
  }

  const variance = actualManHours - estimatedManHours;
  const absoluteDifference = Math.abs(variance);
  const accuracy = (1 - (absoluteDifference / estimatedManHours)) * 100;

  // Ensure accuracy doesn't go below 0% or above 100%
  const boundedAccuracy = Math.max(0, Math.min(100, accuracy));

  // Determine status
  let status: 'under' | 'over' | 'exact' | 'unknown' = 'unknown';
  if (variance > 0.5) {
    status = 'over'; // Took longer than expected
  } else if (variance < -0.5) {
    status = 'under'; // Took less time than expected
  } else {
    status = 'exact'; // Within acceptable range
  }

  return {
    estimatedManHours: Math.round(estimatedManHours * 100) / 100,
    actualManHours: Math.round(actualManHours * 100) / 100,
    estimationAccuracy: Math.round(boundedAccuracy * 100) / 100,
    estimationVariance: Math.round(variance * 100) / 100,
    status
  };
}

/**
 * Format man-hours for display
 */
export function formatManHours(hours: number): string {
  if (!hours || hours === 0) {
    return '0 hours';
  }

  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  if (minutes === 0) {
    return `${wholeHours} ${wholeHours === 1 ? 'hour' : 'hours'}`;
  }

  return `${wholeHours}h ${minutes}m`;
}

/**
 * Get accuracy status color for UI
 */
export function getAccuracyStatusColor(accuracy: number): {
  text: string;
  bg: string;
  border: string;
} {
  if (accuracy >= 90) {
    return {
      text: 'text-green-700',
      bg: 'bg-green-100',
      border: 'border-green-300'
    };
  } else if (accuracy >= 75) {
    return {
      text: 'text-blue-700',
      bg: 'bg-blue-100',
      border: 'border-blue-300'
    };
  } else if (accuracy >= 60) {
    return {
      text: 'text-yellow-700',
      bg: 'bg-yellow-100',
      border: 'border-yellow-300'
    };
  } else {
    return {
      text: 'text-red-700',
      bg: 'bg-red-100',
      border: 'border-red-300'
    };
  }
}
