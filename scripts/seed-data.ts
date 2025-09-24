#!/usr/bin/env tsx

/**
 * Seed script to populate database with realistic job descriptions and diary entries
 * This will create sample data to demonstrate the full functionality of the dispatch board
 */

import { pool } from "../server/db";
import { storage } from "../server/storage";

async function seedData() {
  console.log("🌱 Starting database seed process...");

  try {
    // Get existing customers first
    const customers = await storage.getAllCustomers();
    console.log(`📋 Found ${customers.length} existing customers`);

    if (customers.length === 0) {
      console.log("⚠️ No customers found. Creating sample customers first...");
      
      // Create sample customers
      const sampleCustomers = [
        {
          name: "Sarah Mitchell",
          email: "sarah@mitchell-properties.co.nz",
          phone: "+64 21 555 0123",
          address: "33 Harisman Road",
          city: "Makauri",
          region: "Gisborne",
          postalCode: "4071"
        },
        {
          name: "David Chen",
          email: "david.chen@email.co.nz",
          phone: "+64 27 555 0456",
          address: "142 Marine Parade",
          city: "Napier",
          region: "Hawke's Bay",
          postalCode: "4110"
        },
        {
          name: "Wellington City Council",
          email: "parks@wcc.govt.nz",
          phone: "+64 4 499 4444",
          address: "101 Wakefield Street",
          city: "Wellington",
          region: "Wellington",
          postalCode: "6011"
        }
      ];

      for (const customerData of sampleCustomers) {
        await storage.createCustomer(customerData);
        console.log(`✅ Created customer: ${customerData.name}`);
      }
    }

    // Refresh customer list
    const updatedCustomers = await storage.getAllCustomers();
    const customer1 = updatedCustomers[0];
    const customer2 = updatedCustomers[1] || updatedCustomers[0];
    const customer3 = updatedCustomers[2] || updatedCustomers[0];

    console.log("🌳 Creating realistic tree service jobs...");

    // Create completed tree removal job
    const job1 = await storage.createJob({
      customerId: customer1.id,
      jobNumber: "3016",
      title: "Large Oak Tree Removal - Harisman Road",
      description: "Emergency removal of 25-meter oak tree damaged in recent storms. Tree was leaning dangerously over customer's house and neighboring property. Requires crane operation and careful sectional removal to avoid property damage. Customer reported creaking sounds and visible root damage after heavy rainfall.",
      address: "33 Harisman Road, Makauri, Gisborne 4071",
      status: "completed",
      priority: "high",
      serviceType: "Tree Removal",
      estimatedValue: 4500.00,
      actualCost: 4200.00,
      scheduledDate: new Date("2024-09-20T08:00:00Z"),
      completedDate: new Date("2024-09-20T16:30:00Z"),
      assignedTeam: ["Jake Williams", "Maria Santos"],
      leadSource: "Emergency Call",
      notes: "Customer extremely satisfied with professional service. Cleanup completed to their high standards.",
      beforePhotos: ["tree-before-1.jpg", "tree-before-2.jpg"],
      afterPhotos: ["tree-after-1.jpg", "tree-after-2.jpg", "cleanup-complete.jpg"],
      checklist: [
        { item: "Site safety assessment", completed: true },
        { item: "Traffic management setup", completed: true },
        { item: "Crane positioning", completed: true },
        { item: "Tree sectional removal", completed: true },
        { item: "Stump grinding", completed: true },
        { item: "Complete site cleanup", completed: true },
        { item: "Customer walkthrough", completed: true }
      ]
    });

    // Create tree pruning job
    const job2 = await storage.createJob({
      customerId: customer2.id,
      jobNumber: "3017",
      title: "Commercial Pruning - Marine Parade Trees",
      description: "Annual maintenance pruning of 12 mature pohutukawa trees along Marine Parade waterfront. Height reduction and canopy thinning required for public safety and storm resilience. Council maintenance contract work requiring certified arborists and traffic management.",
      address: "142 Marine Parade, Napier, Hawke's Bay 4110",
      status: "in_progress",
      priority: "medium",
      serviceType: "Tree Pruning",
      estimatedValue: 2800.00,
      scheduledDate: new Date("2024-09-25T07:00:00Z"),
      assignedTeam: ["Tom Bradley", "Jake Williams"],
      leadSource: "Council Contract",
      notes: "Annual contract work. Requires traffic management permits and certified disposal."
    });

    // Create Wellington job
    const job3 = await storage.createJob({
      customerId: customer3.id,
      jobNumber: "3018",
      title: "Storm Damage Assessment - Civic Square",
      description: "Post-storm damage assessment and emergency tree work in Wellington's Civic Square. Multiple trees showing stress from recent severe weather including broken branches and root exposure. Requires immediate safety evaluation and remedial work.",
      address: "101 Wakefield Street, Wellington 6011",
      status: "scheduled",
      priority: "high",
      serviceType: "Emergency Assessment",
      estimatedValue: 1500.00,
      scheduledDate: new Date("2024-09-26T06:00:00Z"),
      assignedTeam: ["Jake Williams"],
      leadSource: "Council Emergency",
      notes: "Priority emergency response required. Council contract."
    });

    console.log("📝 Creating comprehensive diary entries...");

    // Comprehensive diary entries for completed job
    const diaryEntries = [
      {
        jobId: job1.id,
        entryType: "milestone",
        title: "Job Commenced",
        content: "Arrived on site at 8:00 AM. Conducted thorough safety assessment with customer Sarah Mitchell. Tree showing significant storm damage with 15-degree lean toward house. Root system compromised on eastern side.",
        authorName: "Jake Williams",
        authorRole: "Lead Arborist",
        isPrivate: false,
        metadata: JSON.stringify({
          weatherConditions: "Clear, 18°C, light winds",
          equipmentUsed: ["35ft ladder", "safety harnesses", "measuring equipment"],
          timeSpent: 45,
          photos: ["site-assessment-1.jpg", "root-damage.jpg"]
        })
      },
      {
        jobId: job1.id,
        entryType: "progress",
        title: "Crane Setup Complete",
        content: "Crane positioned and stabilized. Traffic management in place on Harisman Road. All safety protocols confirmed. Customer and neighbors notified of work schedule. Beginning sectional removal from top down.",
        authorName: "Maria Santos",
        authorRole: "Crane Operator",
        isPrivate: false,
        metadata: JSON.stringify({
          equipmentUsed: ["25-ton crane", "traffic cones", "safety barriers"],
          timeSpent: 90,
          progress: 25,
          photos: ["crane-setup.jpg", "traffic-management.jpg"]
        })
      },
      {
        jobId: job1.id,
        entryType: "communication",
        title: "Customer Update Call",
        content: "Spoke with Sarah Mitchell at 11:30 AM to provide progress update. Explained we're ahead of schedule and expect completion by 3:30 PM. Customer very pleased with our professional approach and minimal disruption.",
        authorName: "Jake Williams",
        authorRole: "Lead Arborist",
        isPrivate: false,
        metadata: JSON.stringify({
          communicationType: "phone",
          phoneNumber: customer1.phone,
          duration: "8 minutes",
          customerSatisfaction: "excellent"
        })
      },
      {
        jobId: job1.id,
        entryType: "safety",
        title: "Safety Incident - Minor",
        content: "Branch fell outside designated drop zone due to unexpected wind gust at 1:15 PM. No injuries or property damage. Adjusted cutting technique and increased safety perimeter. Work resumed after 15-minute safety review.",
        authorName: "Jake Williams",
        authorRole: "Lead Arborist", 
        isPrivate: false,
        metadata: JSON.stringify({
          incidentType: "near miss",
          actionTaken: "increased safety perimeter",
          timeSpent: 15,
          weatherFactor: "unexpected wind gust"
        })
      },
      {
        jobId: job1.id,
        entryType: "progress",
        title: "Main Trunk Removal Complete",
        content: "Successfully removed main trunk sections. Stump now ready for grinding. All major debris cleared from property. Customer expressed amazement at precision and care taken to protect garden and driveway.",
        authorName: "Maria Santos",
        authorRole: "Crane Operator",
        isPrivate: false,
        metadata: JSON.stringify({
          progress: 80,
          timeSpent: 180,
          equipmentUsed: ["crane", "chainsaw", "rigging ropes"],
          photos: ["trunk-sections.jpg", "protected-garden.jpg"]
        })
      },
      {
        jobId: job1.id,
        entryType: "completion",
        title: "Job Completed Successfully",
        content: "Stump grinding completed, all debris removed, site cleaned to customer's satisfaction. Final walkthrough with Sarah Mitchell confirmed all work meets expectations. Customer provided excellent feedback and indicated willingness to recommend our services.",
        authorName: "Jake Williams",
        authorRole: "Lead Arborist",
        isPrivate: false,
        metadata: JSON.stringify({
          completionTime: "4:30 PM",
          customerSatisfaction: "excellent",
          finalPhotos: ["stump-ground.jpg", "clean-site.jpg", "happy-customer.jpg"],
          invoiceAmount: 4200.00,
          paymentStatus: "paid"
        })
      },
      {
        jobId: job1.id,
        entryType: "communication",
        title: "Follow-up Email Sent",
        content: "Sent follow-up email with before/after photos, completion certificate, and care instructions for remaining trees. Included invoice and requested Google review. Customer replied within 2 hours with 5-star review and referral contact.",
        authorName: "Office Admin",
        authorRole: "Customer Service",
        isPrivate: false,
        metadata: JSON.stringify({
          communicationType: "email",
          emailAddress: customer1.email,
          attachments: ["completion-photos.pdf", "tree-care-guide.pdf", "invoice-3016.pdf"],
          responseTime: "2 hours",
          reviewReceived: true,
          referralGenerated: true
        })
      }
    ];

    // Create diary entries for the completed job
    for (const entry of diaryEntries) {
      await storage.createJobDiaryEntry(entry);
      console.log(`✅ Created diary entry: ${entry.title}`);
    }

    // Add some diary entries for job in progress
    const job2DiaryEntries = [
      {
        jobId: job2.id,
        entryType: "milestone",
        title: "Contract Work Commenced",
        content: "Started annual pruning contract for Napier City Council. Weather conditions ideal for tree work. All 12 pohutukawa trees assessed and work plan confirmed with council representative.",
        authorName: "Tom Bradley",
        authorRole: "Senior Arborist",
        isPrivate: false,
        metadata: JSON.stringify({
          weatherConditions: "Sunny, 22°C, calm",
          treesAssessed: 12,
          councilContact: "Parks Manager",
          permitNumbers: ["TP2024-0156"]
        })
      },
      {
        jobId: job2.id,
        entryType: "progress",
        title: "Trees 1-4 Completed",
        content: "Completed pruning of first 4 pohutukawa trees. Height reduced by 2-3 meters and deadwood removed. Traffic management working well with minimal disruption to Marine Parade traffic.",
        authorName: "Jake Williams",
        authorRole: "Arborist",
        isPrivate: false,
        metadata: JSON.stringify({
          treesCompleted: 4,
          progress: 33,
          heightReduction: "2-3 meters",
          timeSpent: 240,
          trafficImpact: "minimal"
        })
      }
    ];

    for (const entry of job2DiaryEntries) {
      await storage.createJobDiaryEntry(entry);
      console.log(`✅ Created diary entry: ${entry.title}`);
    }

    console.log("🎉 Database seeding completed successfully!");
    console.log(`📊 Created:`);
    console.log(`   • 3 realistic tree service jobs`);
    console.log(`   • 1 completed job with full documentation`);
    console.log(`   • 7 comprehensive diary entries with communications`);
    console.log(`   • 2 jobs in progress/scheduled`);
    console.log(`   • Complete before/after photos references`);
    console.log(`   • Safety incidents and resolution tracking`);

  } catch (error) {
    console.error("❌ Error during database seeding:", error);
    throw error;
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the seed script
seedData()
  .then(() => {
    console.log("✅ Seed script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Seed script failed:", error);
    process.exit(1);
  });

export { seedData };