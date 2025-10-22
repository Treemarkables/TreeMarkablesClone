import { pool } from "../server/db";

async function addComplianceItemsToAllTemplates() {
  console.log('🚗 Adding COF, Registration, and RUC checks to all prestart templates...\n');
  
  try {
    // Get all active templates
    const templatesResult = await pool.query(
      'SELECT id, name, vehicle_type FROM inspection_templates WHERE is_active = true'
    );
    
    const templates = templatesResult.rows;
    console.log(`Found ${templates.length} active templates\n`);
    
    if (templates.length === 0) {
      console.log('⚠️  No active templates found. Please create templates first.');
      return;
    }
    
    // Define the three compliance items to add
    const complianceItems = [
      {
        question: 'COF (Certificate of Fitness) - Current and displayed',
        category: 'Compliance Documents',
        requiresComment: true,
        requiresPhoto: false,
      },
      {
        question: 'Registration - Current and displayed',
        category: 'Compliance Documents',
        requiresComment: true,
        requiresPhoto: false,
      },
      {
        question: 'RUC (Road User Charges) - Current and displayed',
        category: 'Compliance Documents',
        requiresComment: true,
        requiresPhoto: false,
      },
    ];
    
    let totalAdded = 0;
    
    // For each template, add the compliance items
    for (const template of templates) {
      console.log(`📋 Processing template: ${template.name} (${template.vehicle_type || 'no type'})`);
      
      // Get the highest sort order for this template
      const sortOrderResult = await pool.query(
        'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM inspection_checklist_items WHERE template_id = $1',
        [template.id]
      );
      let nextSortOrder = sortOrderResult.rows[0].max_order + 1;
      
      // Check if these items already exist (by question text)
      const existingItemsResult = await pool.query(
        `SELECT question FROM inspection_checklist_items 
         WHERE template_id = $1 AND (
           question ILIKE '%COF%Certificate of Fitness%' OR 
           question ILIKE '%Registration%Current and displayed%' OR
           question ILIKE '%RUC%Road User Charges%'
         )`,
        [template.id]
      );
      
      const existingQuestions = new Set(existingItemsResult.rows.map(r => r.question));
      
      // Add each compliance item if it doesn't exist
      for (const item of complianceItems) {
        if (existingQuestions.has(item.question)) {
          console.log(`  ⏭️  Skipped (already exists): ${item.question}`);
          continue;
        }
        
        await pool.query(
          `INSERT INTO inspection_checklist_items 
           (template_id, question, category, requires_comment, requires_photo, sort_order, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [template.id, item.question, item.category, item.requiresComment, item.requiresPhoto, nextSortOrder]
        );
        
        console.log(`  ✅ Added: ${item.question}`);
        totalAdded++;
        nextSortOrder++;
      }
      
      console.log('');
    }
    
    console.log(`\n✨ Complete! Added ${totalAdded} compliance items across ${templates.length} templates.\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
addComplianceItemsToAllTemplates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
