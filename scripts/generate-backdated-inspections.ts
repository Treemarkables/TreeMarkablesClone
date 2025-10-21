import { db } from "../server/db";
import { equipment, vehicleInspections, inspectionResponses, inspectionChecklistItems } from "@shared/schema";
import { eq } from "drizzle-orm";

// Helper to get Monday-Friday dates going back from today
function getWorkdayDates(count: number): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  today.setHours(7, 30, 0, 0); // 7:30 AM start time
  
  let currentDate = new Date(today);
  
  while (dates.length < count) {
    const dayOfWeek = currentDate.getDay();
    // Only Monday (1) through Friday (5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      dates.push(new Date(currentDate));
    }
    // Go back one day
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  return dates.reverse(); // Oldest to newest
}

// Generate realistic responses for inspection items
function generateResponse(question: string, isSafetyCritical: boolean): {
  response: 'YES' | 'NO' | 'N/A';
  comment?: string;
} {
  // 95% pass rate for most items
  const passRate = 0.95;
  const naRate = 0.02; // 2% N/A rate
  
  const rand = Math.random();
  
  if (rand < naRate) {
    return {
      response: 'N/A',
      comment: 'Not applicable for this vehicle configuration'
    };
  } else if (rand < passRate) {
    return { response: 'YES' };
  } else {
    // Failed check - add realistic comment
    const failComments = [
      'Minor issue - scheduled for maintenance',
      'Needs attention - logged for next service',
      'Noted - will monitor',
      'Wear visible - replacement planned'
    ];
    return {
      response: 'NO',
      comment: failComments[Math.floor(Math.random() * failComments.length)]
    };
  }
}

async function main() {
  console.log('🚀 Starting backdated inspection generation...');
  
  // Get or create equipment records
  const vehicles = [
    { name: 'Bucket truck', type: 'bucket_truck', templateId: 'bucket-truck-template', templateName: 'Bucket Truck Pre-Start' },
    { name: 'Big Blue', type: 'truck', templateId: 'big-blue-template', templateName: 'Big Blue Pre-Start' },
    { name: '4x4 Truck', type: 'truck', templateId: '4x4-truck-template', templateName: '4x4 Truck Pre-Start' }
  ];
  
  const vehicleRecords = [];
  
  for (const vehicle of vehicles) {
    // Check if vehicle exists
    let vehicleRecord = await db.query.equipment.findFirst({
      where: eq(equipment.name, vehicle.name)
    });
    
    if (!vehicleRecord) {
      console.log(`Creating equipment record for ${vehicle.name}...`);
      const [created] = await db.insert(equipment).values({
        name: vehicle.name,
        type: vehicle.type,
        status: 'operational',
        condition: 'good'
      }).returning();
      vehicleRecord = created;
    }
    
    vehicleRecords.push({
      ...vehicleRecord,
      templateId: vehicle.templateId,
      templateName: vehicle.templateName
    });
  }
  
  console.log('✅ Vehicle records ready');
  
  // Generate 50 inspections for each vehicle
  const inspectorName = 'Jullian Halley';
  const inspectorSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; // Minimal signature placeholder
  
  const workdayDates = getWorkdayDates(50);
  
  let totalInspections = 0;
  
  for (const vehicle of vehicleRecords) {
    console.log(`\n📝 Generating 50 inspections for ${vehicle.name}...`);
    
    // Get checklist items for this template
    const checklistItems = await db.query.inspectionChecklistItems.findMany({
      where: eq(inspectionChecklistItems.templateId, vehicle.templateId),
      orderBy: (items, { asc }) => [asc(items.sortOrder)]
    });
    
    if (checklistItems.length === 0) {
      console.warn(`⚠️ No checklist items found for template ${vehicle.templateId}`);
      continue;
    }
    
    // Batch create inspections in groups of 10
    for (let batchStart = 0; batchStart < workdayDates.length; batchStart += 10) {
      const batchEnd = Math.min(batchStart + 10, workdayDates.length);
      const batchDates = workdayDates.slice(batchStart, batchEnd);
      
      const inspectionBatch = [];
      
      for (let i = 0; i < batchDates.length; i++) {
        const inspectionDate = batchDates[i];
        const globalIndex = batchStart + i;
        
        // Vary speedometer reading slightly
        const baseOdometer = 45000 + (globalIndex * 120); // Realistic progression
        const speedometerReading = baseOdometer + Math.floor(Math.random() * 50);
        
        // All inspections pass (status: 'pass')
        const hasFailures = Math.random() < 0.05; // 5% fail rate
        
        inspectionBatch.push({
          vehicleId: vehicle.id,
          vehicleName: vehicle.name,
          vehicleRegistration: vehicle.name === 'Bucket truck' ? 'ABC123' : 
                             vehicle.name === 'Big Blue' ? 'DEF456' : 'GHI789',
          templateId: vehicle.templateId,
          templateName: vehicle.templateName,
          inspectionDate,
          inspectedBy: inspectorName,
          inspectorName: inspectorName,
          speedometerReading,
          status: hasFailures ? 'fail' : 'pass',
          overallNotes: hasFailures ? 'Minor issues noted - safe to operate' : 'All checks passed',
          signature: inspectorSignature
        });
      }
      
      // Insert batch of inspections
      const createdInspections = await db.insert(vehicleInspections).values(inspectionBatch).returning();
      
      // Create responses for each inspection in this batch
      const allResponses = [];
      
      for (const inspection of createdInspections) {
        for (const item of checklistItems) {
          const { response, comment } = generateResponse(item.question, item.requiresComment || false);
          
          allResponses.push({
            inspectionId: inspection.id,
            checklistItemId: item.id,
            question: item.question,
            category: item.category,
            response,
            comment,
            sortOrder: item.sortOrder,
            photos: [] // No photos for backdated inspections
          });
        }
      }
      
      // Batch insert all responses for this inspection batch
      await db.insert(inspectionResponses).values(allResponses);
      
      totalInspections += createdInspections.length;
      console.log(`  ✓ Generated ${batchEnd}/50 inspections for ${vehicle.name}`);
    }
    
    console.log(`✅ Completed 50 inspections for ${vehicle.name}`);
  }
  
  console.log(`\n🎉 Successfully generated ${totalInspections} backdated inspections!`);
  console.log(`   Inspector: ${inspectorName}`);
  console.log(`   Date range: ${workdayDates[0].toLocaleDateString()} to ${workdayDates[workdayDates.length - 1].toLocaleDateString()}`);
}

main()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
