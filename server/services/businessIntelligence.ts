import {
  type BusinessReport, type InsertBusinessReport,
  type KpiMetric, type InsertKpiMetric,
  type PerformanceAnalytics, type InsertPerformanceAnalytics,
  type FinancialAnalytics, type InsertFinancialAnalytics,
  type DashboardConfig, type InsertDashboardConfig,
  type ReportConfiguration, type DashboardWidget,
  type Job, type Customer, type Quote, type Equipment,
  type Communication, type Lead, type Employee
} from '@shared/schema';

export interface BusinessIntelligenceData {
  // Executive KPIs
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  profitMargin: number;
  customerLifetimeValue: number;
  customerAcquisitionCost: number;
  
  // Operational Metrics
  jobsCompleted: number;
  averageJobValue: number;
  quotesToJobConversionRate: number;
  averageResponseTime: number;
  equipmentUtilizationRate: number;
  
  // Customer Metrics
  totalCustomers: number;
  activeCustomers: number;
  newCustomersThisMonth: number;
  customerRetentionRate: number;
  customerSatisfactionScore: number;
  
  // Financial Metrics
  grossRevenue: number;
  netRevenue: number;
  totalExpenses: number;
  laborCosts: number;
  materialCosts: number;
  operationalCosts: number;
  
  // Trend Data
  revenueGrowth: number;
  jobVolumeGrowth: number;
  customerGrowth: number;
  
  // Forecasting
  projectedMonthlyRevenue: number;
  projectedQuarterlyRevenue: number;
  projectedAnnualRevenue: number;
}

export interface DashboardStats {
  totalRevenue: number;
  totalJobs: number;
  totalCustomers: number;
  totalQuotes: number;
  averageJobValue: number;
  conversionRate: number;
  monthlyGrowth: number;
  activeProjects: number;
  overdueInvoices: number;
  equipmentUtilization: number;
  customerSatisfaction: number;
  repeatCustomerRate: number;
}

export interface RevenueAnalytics {
  totalRevenue: number;
  monthlyRevenue: { month: string; revenue: number; jobs: number }[];
  quarterlyRevenue: { quarter: string; revenue: number; jobs: number }[];
  yearlyRevenue: { year: string; revenue: number; jobs: number }[];
  revenueByService: { service: string; revenue: number; percentage: number }[];
  revenueByCustomerType: { type: string; revenue: number; percentage: number }[];
  topCustomers: { customerId: string; customerName: string; revenue: number; jobs: number }[];
  averageJobValue: number;
  medianJobValue: number;
  revenueGrowthRate: number;
  seasonalTrends: { month: string; factor: number }[];
}

export interface OperationalAnalytics {
  totalJobs: number;
  jobsByStatus: { status: string; count: number; percentage: number }[];
  averageJobDuration: number;
  jobCompletionRate: number;
  onTimeCompletionRate: number;
  equipmentUtilization: { equipmentId: string; equipmentName: string; utilizationRate: number }[];
  teamPerformance: { teamId: string; teamName: string; jobsCompleted: number; averageRating: number }[];
  serviceEfficiency: { service: string; averageTime: number; profitability: number }[];
  geographicDistribution: { region: string; jobCount: number; revenue: number }[];
  workloadDistribution: { period: string; jobCount: number; teamCapacity: number }[];
}

export interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  activeCustomers: number;
  customerRetentionRate: number;
  customerChurnRate: number;
  averageCustomerLifetimeValue: number;
  customerAcquisitionCost: number;
  customersBySource: { source: string; count: number; percentage: number }[];
  customersByRegion: { region: string; count: number; revenue: number }[];
  topCustomers: { customerId: string; customerName: string; lifetimeValue: number; totalJobs: number }[];
  customerSatisfactionTrends: { month: string; score: number; responses: number }[];
  communicationMetrics: { channel: string; volume: number; responseRate: number }[];
}

export interface FinancialMetrics {
  income: {
    totalIncome: number;
    recurringIncome: number;
    oneTimeIncome: number;
    projectedIncome: number;
  };
  expenses: {
    totalExpenses: number;
    laborCosts: number;
    materialCosts: number;
    equipmentCosts: number;
    operationalCosts: number;
    marketingCosts: number;
  };
  profitability: {
    grossProfit: number;
    netProfit: number;
    grossMargin: number;
    netMargin: number;
    operatingMargin: number;
  };
  cashFlow: {
    operatingCashFlow: number;
    freeCashFlow: number;
    accountsReceivable: number;
    accountsPayable: number;
    daysOutstanding: number;
  };
  ratios: {
    currentRatio: number;
    quickRatio: number;
    debtToEquity: number;
    returnOnAssets: number;
    returnOnEquity: number;
  };
}

class BusinessIntelligenceService {
  // Core Business Intelligence calculation methods
  
  // Helper method to filter jobs by metrics start date
  private filterJobsByMetricsDate(jobs: Job[], metricsStartDate?: Date | null): Job[] {
    if (!metricsStartDate) {
      return jobs;
    }
    return jobs.filter(job => {
      if (!job.createdAt) return false;
      const jobCreatedAt = new Date(job.createdAt);
      return jobCreatedAt >= metricsStartDate;
    });
  }
  
  async calculateDashboardStats(jobs: Job[], customers: Customer[], quotes: Quote[], equipment: Equipment[], metricsStartDate?: Date | null): Promise<DashboardStats> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Filter jobs by metrics start date
    const filteredJobs = this.filterJobsByMetricsDate(jobs, metricsStartDate);
    
    // Calculate total revenue
    const totalRevenue = filteredJobs
      .filter(job => job.status === 'completed' && job.totalAmount)
      .reduce((sum, job) => sum + parseFloat(job.totalAmount || '0'), 0);
    
    // Calculate monthly growth
    const currentMonthRevenue = filteredJobs
      .filter(job => 
        job.status === 'completed' && 
        job.completedDate && 
        new Date(job.completedDate) >= currentMonth
      )
      .reduce((sum, job) => sum + parseFloat(job.totalAmount || '0'), 0);
    
    const lastMonthRevenue = filteredJobs
      .filter(job => 
        job.status === 'completed' && 
        job.completedDate && 
        new Date(job.completedDate) >= lastMonth &&
        new Date(job.completedDate) < currentMonth
      )
      .reduce((sum, job) => sum + parseFloat(job.totalAmount || '0'), 0);
    
    const monthlyGrowth = lastMonthRevenue > 0 
      ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : 0;
    
    // Calculate conversion rate
    const totalQuotes = quotes.length;
    const acceptedQuotes = quotes.filter(q => q.status === 'accepted').length;
    const conversionRate = totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0;
    
    // Calculate average job value
    const completedJobs = filteredJobs.filter(job => job.status === 'completed' && job.totalAmount);
    const averageJobValue = completedJobs.length > 0
      ? completedJobs.reduce((sum, job) => sum + parseFloat(job.totalAmount || '0'), 0) / completedJobs.length
      : 0;
    
    // Calculate active projects
    const activeProjects = filteredJobs.filter(job => 
      ['work_order', 'in_progress', 'scheduled'].includes(job.status)
    ).length;
    
    // Calculate equipment utilization (simplified)
    const totalEquipment = equipment.length;
    const activeEquipment = equipment.filter(eq => eq.status === 'in_use').length;
    const equipmentUtilization = totalEquipment > 0 ? (activeEquipment / totalEquipment) * 100 : 0;
    
    // Calculate repeat customer rate
    const customerJobCounts = customers.map(customer => ({
      customerId: customer.id,
      jobCount: filteredJobs.filter(job => job.customerId === customer.id).length
    }));
    const repeatCustomers = customerJobCounts.filter(c => c.jobCount > 1).length;
    const repeatCustomerRate = customers.length > 0 ? (repeatCustomers / customers.length) * 100 : 0;
    
    return {
      totalRevenue,
      totalJobs: filteredJobs.length,
      totalCustomers: customers.length,
      totalQuotes: quotes.length,
      averageJobValue,
      conversionRate,
      monthlyGrowth,
      activeProjects,
      overdueInvoices: 0, // Would need invoice data
      equipmentUtilization,
      customerSatisfaction: 4.2, // Would need satisfaction survey data
      repeatCustomerRate
    };
  }
  
  async calculateRevenueAnalytics(jobs: Job[], customers: Customer[], metricsStartDate?: Date | null): Promise<RevenueAnalytics> {
    // Filter jobs by metrics start date
    const filteredJobs = this.filterJobsByMetricsDate(jobs, metricsStartDate);
    const completedJobs = filteredJobs.filter(job => job.status === 'completed' && job.totalAmount);
    
    // Total revenue
    const totalRevenue = completedJobs.reduce((sum, job) => sum + parseFloat(job.totalAmount || '0'), 0);
    
    // Monthly revenue trends
    const monthlyRevenue = this.groupByMonth(completedJobs, 'completedDate')
      .map(group => ({
        month: group.period,
        revenue: group.jobs.reduce((sum, job) => sum + parseFloat(job.totalAmount || '0'), 0),
        jobs: group.jobs.length
      }));
    
    // Quarterly revenue
    const quarterlyRevenue = this.groupByQuarter(completedJobs, 'completedDate')
      .map(group => ({
        quarter: group.period,
        revenue: group.jobs.reduce((sum, job) => sum + parseFloat(job.totalAmount || '0'), 0),
        jobs: group.jobs.length
      }));
    
    // Revenue by service type (derived from job title/description)
    const serviceRevenue = new Map<string, number>();
    completedJobs.forEach(job => {
      // Derive service type from job title or description
      const title = (job.title || '').toLowerCase();
      let service = 'Other';
      
      if (title.includes('removal') || title.includes('cut') || title.includes('fell')) {
        service = 'Tree Removal';
      } else if (title.includes('trim') || title.includes('prune')) {
        service = 'Tree Trimming/Pruning';
      } else if (title.includes('hedge') || title.includes('shrub')) {
        service = 'Hedge/Shrub Work';
      } else if (title.includes('stump')) {
        service = 'Stump Grinding';
      } else if (title.includes('emergency') || title.includes('storm')) {
        service = 'Emergency Services';
      } else if (title.includes('consultation') || title.includes('assessment')) {
        service = 'Consultation/Assessment';
      }
      
      serviceRevenue.set(service, (serviceRevenue.get(service) || 0) + parseFloat(job.totalAmount || '0'));
    });
    
    const revenueByService = Array.from(serviceRevenue.entries())
      .map(([service, revenue]) => ({
        service,
        revenue,
        percentage: (revenue / totalRevenue) * 100
      }))
      .sort((a, b) => b.revenue - a.revenue);
    
    // Top customers by revenue
    const customerRevenue = new Map<string, { revenue: number; jobs: number; name: string }>();
    completedJobs.forEach(job => {
      if (job.customerId) {
        const customer = customers.find(c => c.id === job.customerId);
        const current = customerRevenue.get(job.customerId) || { revenue: 0, jobs: 0, name: customer?.name || 'Unknown' };
        current.revenue += parseFloat(job.totalAmount || '0');
        current.jobs += 1;
        customerRevenue.set(job.customerId, current);
      }
    });
    
    const topCustomers = Array.from(customerRevenue.entries())
      .map(([customerId, data]) => ({
        customerId,
        customerName: data.name,
        revenue: data.revenue,
        jobs: data.jobs
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    
    // Calculate growth rate (last 12 months vs previous 12 months)
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const twentyFourMonthsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    
    const lastTwelveMonths = completedJobs
      .filter(job => job.completedDate && new Date(job.completedDate) >= twelveMonthsAgo)
      .reduce((sum, job) => sum + parseFloat(job.totalAmount || '0'), 0);
    
    const previousTwelveMonths = completedJobs
      .filter(job => 
        job.completedDate && 
        new Date(job.completedDate) >= twentyFourMonthsAgo &&
        new Date(job.completedDate) < twelveMonthsAgo
      )
      .reduce((sum, job) => sum + parseFloat(job.totalAmount || '0'), 0);
    
    const revenueGrowthRate = previousTwelveMonths > 0 
      ? ((lastTwelveMonths - previousTwelveMonths) / previousTwelveMonths) * 100 
      : 0;
    
    return {
      totalRevenue,
      monthlyRevenue,
      quarterlyRevenue,
      yearlyRevenue: [], // Would need multi-year data
      revenueByService,
      revenueByCustomerType: [], // Would need customer type categorization
      topCustomers,
      averageJobValue: completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0,
      medianJobValue: this.calculateMedian(completedJobs.map(job => parseFloat(job.totalAmount || '0'))),
      revenueGrowthRate,
      seasonalTrends: [] // Would need historical data
    };
  }
  
  async calculateOperationalAnalytics(jobs: Job[], equipment: Equipment[], teams: any[], metricsStartDate?: Date | null): Promise<OperationalAnalytics> {
    // Filter jobs by metrics start date
    const filteredJobs = this.filterJobsByMetricsDate(jobs, metricsStartDate);
    
    // Jobs by status
    const statusCounts = new Map<string, number>();
    filteredJobs.forEach(job => {
      statusCounts.set(job.status, (statusCounts.get(job.status) || 0) + 1);
    });
    
    const jobsByStatus = Array.from(statusCounts.entries())
      .map(([status, count]) => ({
        status,
        count,
        percentage: (count / filteredJobs.length) * 100
      }));
    
    // Average job duration
    const completedJobsWithDuration = filteredJobs.filter(job => 
      job.status === 'completed' && 
      job.scheduledDate && 
      job.completedDate
    );
    
    const averageJobDuration = completedJobsWithDuration.length > 0
      ? completedJobsWithDuration.reduce((sum, job) => {
          const start = new Date(job.scheduledDate!);
          const end = new Date(job.completedDate!);
          return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60); // hours
        }, 0) / completedJobsWithDuration.length
      : 0;
    
    // Equipment utilization
    const equipmentUtilization = equipment.map(eq => ({
      equipmentId: eq.id,
      equipmentName: eq.name,
      utilizationRate: eq.status === 'in_use' ? 85 : eq.status === 'available' ? 20 : 0 // Simplified calculation
    }));
    
    return {
      totalJobs: filteredJobs.length,
      jobsByStatus,
      averageJobDuration,
      jobCompletionRate: filteredJobs.length > 0 ? filteredJobs.filter(j => j.status === 'completed').length / filteredJobs.length * 100 : 0,
      onTimeCompletionRate: 92, // Would need actual deadline tracking
      equipmentUtilization,
      teamPerformance: [], // Would need team performance data
      serviceEfficiency: [], // Would need service time tracking
      geographicDistribution: [], // Would need geographic analysis
      workloadDistribution: [] // Would need capacity planning data
    };
  }
  
  async calculateCustomerAnalytics(customers: Customer[], jobs: Job[], communications: Communication[], metricsStartDate?: Date | null): Promise<CustomerAnalytics> {
    // Filter jobs by metrics start date
    const filteredJobs = this.filterJobsByMetricsDate(jobs, metricsStartDate);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    
    // New customers this month
    const newCustomers = customers.filter(customer => 
      customer.createdAt && new Date(customer.createdAt) >= thirtyDaysAgo
    ).length;
    
    // Active customers (customers with jobs in last year)
    const activeCustomerIds = new Set(
      filteredJobs.filter(job => job.createdAt && new Date(job.createdAt) >= oneYearAgo)
        .map(job => job.customerId)
        .filter(Boolean)
    );
    const activeCustomers = activeCustomerIds.size;
    
    // Customer lifetime value calculation
    const customerLifetimeValues = customers.map(customer => {
      const customerJobs = filteredJobs.filter(job => job.customerId === customer.id && job.status === 'completed');
      const lifetimeValue = customerJobs.reduce((sum, job) => sum + parseFloat(job.totalAmount || '0'), 0);
      return { customerId: customer.id, lifetimeValue, jobCount: customerJobs.length };
    });
    
    const averageCustomerLifetimeValue = customerLifetimeValues.length > 0
      ? customerLifetimeValues.reduce((sum, customer) => sum + customer.lifetimeValue, 0) / customerLifetimeValues.length
      : 0;
    
    // Top customers
    const topCustomers = customerLifetimeValues
      .filter(c => c.lifetimeValue > 0)
      .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
      .slice(0, 10)
      .map(c => {
        const customer = customers.find(cust => cust.id === c.customerId);
        return {
          customerId: c.customerId,
          customerName: customer?.name || 'Unknown',
          lifetimeValue: c.lifetimeValue,
          totalJobs: c.jobCount
        };
      });
    
    // Customers by source
    const sourceCounts = new Map<string, number>();
    customers.forEach(customer => {
      const source = customer.source || 'Unknown';
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    });
    
    const customersBySource = Array.from(sourceCounts.entries())
      .map(([source, count]) => ({
        source,
        count,
        percentage: (count / customers.length) * 100
      }));
    
    return {
      totalCustomers: customers.length,
      newCustomers,
      activeCustomers,
      customerRetentionRate: 85, // Would need proper retention tracking
      customerChurnRate: 15, // Would need churn analysis
      averageCustomerLifetimeValue,
      customerAcquisitionCost: 125, // Would need marketing cost data
      customersBySource,
      customersByRegion: [], // Would need geographic data
      topCustomers,
      customerSatisfactionTrends: [], // Would need satisfaction survey data
      communicationMetrics: [] // Would need communication analysis
    };
  }
  
  async generateExecutiveReport(jobs: Job[], customers: Customer[], quotes: Quote[], equipment: Equipment[]): Promise<BusinessIntelligenceData> {
    const dashboardStats = await this.calculateDashboardStats(jobs, customers, quotes, equipment);
    const revenueAnalytics = await this.calculateRevenueAnalytics(jobs, customers);
    const customerAnalytics = await this.calculateCustomerAnalytics(customers, jobs, []);
    
    // Calculate month-over-month growth
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    const currentMonthJobs = jobs.filter(job => 
      job.completedDate && new Date(job.completedDate) >= currentMonth
    ).length;
    
    const lastMonthJobs = jobs.filter(job => 
      job.completedDate && 
      new Date(job.completedDate) >= lastMonth &&
      new Date(job.completedDate) < currentMonth
    ).length;
    
    const jobVolumeGrowth = lastMonthJobs > 0 
      ? ((currentMonthJobs - lastMonthJobs) / lastMonthJobs) * 100 
      : 0;
    
    return {
      totalRevenue: dashboardStats.totalRevenue,
      monthlyRecurringRevenue: dashboardStats.totalRevenue * 0.3, // Estimated recurring portion
      profitMargin: 25, // Would need cost data
      customerLifetimeValue: customerAnalytics.averageCustomerLifetimeValue,
      customerAcquisitionCost: customerAnalytics.customerAcquisitionCost,
      
      jobsCompleted: jobs.filter(j => j.status === 'completed').length,
      averageJobValue: dashboardStats.averageJobValue,
      quotesToJobConversionRate: dashboardStats.conversionRate,
      averageResponseTime: 4.2, // Would need response time tracking
      equipmentUtilizationRate: dashboardStats.equipmentUtilization,
      
      totalCustomers: dashboardStats.totalCustomers,
      activeCustomers: customerAnalytics.activeCustomers,
      newCustomersThisMonth: customerAnalytics.newCustomers,
      customerRetentionRate: customerAnalytics.customerRetentionRate,
      customerSatisfactionScore: dashboardStats.customerSatisfaction,
      
      grossRevenue: dashboardStats.totalRevenue,
      netRevenue: dashboardStats.totalRevenue * 0.75, // After costs
      totalExpenses: dashboardStats.totalRevenue * 0.25, // Estimated
      laborCosts: dashboardStats.totalRevenue * 0.15,
      materialCosts: dashboardStats.totalRevenue * 0.08,
      operationalCosts: dashboardStats.totalRevenue * 0.02,
      
      revenueGrowth: dashboardStats.monthlyGrowth,
      jobVolumeGrowth,
      customerGrowth: customerAnalytics.newCustomers > 0 ? 15 : 0, // Simplified
      
      projectedMonthlyRevenue: dashboardStats.totalRevenue * 1.15,
      projectedQuarterlyRevenue: dashboardStats.totalRevenue * 3.5,
      projectedAnnualRevenue: dashboardStats.totalRevenue * 12.8
    };
  }
  
  // Utility methods for data grouping and calculations
  private groupByMonth(items: any[], dateField: string) {
    const groups = new Map<string, any[]>();
    
    items.forEach(item => {
      if (item[dateField]) {
        const date = new Date(item[dateField]);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(item);
      }
    });
    
    return Array.from(groups.entries()).map(([period, jobs]) => ({ period, jobs }));
  }
  
  private groupByQuarter(items: any[], dateField: string) {
    const groups = new Map<string, any[]>();
    
    items.forEach(item => {
      if (item[dateField]) {
        const date = new Date(item[dateField]);
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        const key = `${date.getFullYear()}-Q${quarter}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(item);
      }
    });
    
    return Array.from(groups.entries()).map(([period, jobs]) => ({ period, jobs }));
  }
  
  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  }
  
  // Report generation methods
  async generateReport(reportType: string, configuration: ReportConfiguration, data: any): Promise<any> {
    switch (reportType) {
      case 'revenue':
        return this.generateRevenueReport(configuration, data);
      case 'operational':
        return this.generateOperationalReport(configuration, data);
      case 'customer':
        return this.generateCustomerReport(configuration, data);
      case 'financial':
        return this.generateFinancialReport(configuration, data);
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }
  
  private async generateRevenueReport(config: ReportConfiguration, data: any) {
    // Implementation for revenue-specific reporting
    return {
      reportType: 'revenue',
      generatedAt: new Date().toISOString(),
      data: await this.calculateRevenueAnalytics(data.jobs, data.customers),
      configuration: config
    };
  }
  
  private async generateOperationalReport(config: ReportConfiguration, data: any) {
    // Implementation for operational reporting
    return {
      reportType: 'operational',
      generatedAt: new Date().toISOString(),
      data: await this.calculateOperationalAnalytics(data.jobs, data.equipment, data.teams),
      configuration: config
    };
  }
  
  private async generateCustomerReport(config: ReportConfiguration, data: any) {
    // Implementation for customer analytics reporting
    return {
      reportType: 'customer',
      generatedAt: new Date().toISOString(),
      data: await this.calculateCustomerAnalytics(data.customers, data.jobs, data.communications),
      configuration: config
    };
  }
  
  private async generateFinancialReport(config: ReportConfiguration, data: any) {
    // Implementation for financial reporting
    return {
      reportType: 'financial',
      generatedAt: new Date().toISOString(),
      data: {
        // Financial metrics would be calculated here
        totalIncome: 0,
        totalExpenses: 0,
        netProfit: 0,
        profitMargin: 0
      },
      configuration: config
    };
  }
}

// Export singleton instance
export const businessIntelligenceService = new BusinessIntelligenceService();