import { storage } from '../server/storage';

async function updateVisibleJobs() {
  console.log('🔧 Fixing visible jobs in dispatch board...');
  
  // Job 3032 - Completed
  const job3032 = await storage.getJobByJobNumber('3032');
  if (job3032) {
    await storage.updateJob(job3032.id, {
      description: "Professional pruning of mature kauri trees to improve structural integrity and safety. Customer requested crown thinning to reduce wind resistance after recent storm damage. Specialized equipment required for height access. Heritage tree protection protocols followed.",
      customerName: "Auckland Heritage Foundation",
      jobAddress: "24 Island road, Gisborne",
      priority: "high",
      serviceType: "tree-pruning",
      estimatedValue: 3200.00,
      estimatedDuration: 8
    });
    console.log('✅ Updated Job 3032: Heritage kauri pruning');
  }

  // Job 3025 - Unsuccessful 
  const job3025 = await storage.getJobByJobNumber('3025');
  if (job3025) {
    await storage.updateJob(job3025.id, {
      description: "Emergency response for fallen pine tree blocking access road. Customer requested immediate removal but unsafe weather conditions prevented completion. Site assessment completed, rescheduled for better conditions.",
      customerName: "Makorori Beach Resort",
      jobAddress: "14 Makorori Beach Road Makorori 4073",
      priority: "urgent",
      serviceType: "emergency-removal",
      estimatedValue: 2800.00,
      estimatedDuration: 6
    });
    console.log('✅ Updated Job 3025: Unsuccessful emergency removal');
  }

  // Job 3028 - Completed
  const job3028 = await storage.getJobByJobNumber('3028');
  if (job3028) {
    await storage.updateJob(job3028.id, {
      description: "Complete removal of three diseased elm trees threatening property foundation. Trees showed clear signs of Dutch elm disease. Stump grinding included to prevent disease spread. Customer very satisfied with thorough cleanup.",
      customerName: "Riverside Property Management",
      jobAddress: "9 King St Gisborne Gisborne 4010",
      priority: "medium",
      serviceType: "tree-removal",
      estimatedValue: 5500.00,
      estimatedDuration: 12
    });
    console.log('✅ Updated Job 3028: Disease elm removal');
  }

  // Job 3023 - Completed
  const job3023 = await storage.getJobByJobNumber('3023');
  if (job3023) {
    await storage.updateJob(job3023.id, {
      description: "Hedge trimming and ornamental tree shaping for commercial property. Regular maintenance contract covering 15 trees and 200m of hedge. Professional finish required for high-visibility location.",
      customerName: "Downtown Business Centre",
      jobAddress: "45 Grey Street, Gisborne Central",
      priority: "low",
      serviceType: "hedge-trimming",
      estimatedValue: 1200.00,
      estimatedDuration: 4
    });
    console.log('✅ Updated Job 3023: Commercial hedge trimming');
  }

  console.log('🎉 All visible jobs updated successfully!');
}

updateVisibleJobs().then(() => process.exit(0)).catch(console.error);