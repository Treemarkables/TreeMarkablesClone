CREATE TABLE "activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar,
	"lead_id" varchar,
	"job_id" varchar,
	"type" text NOT NULL,
	"direction" text,
	"subject" text,
	"content" text,
	"attachments" text[],
	"outcome" text,
	"scheduled_for" timestamp,
	"completed_at" timestamp,
	"created_by" text,
	"automation_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_by" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "assistant_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"employee_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"report_type" text NOT NULL,
	"configuration" jsonb NOT NULL,
	"visualization_type" text NOT NULL,
	"is_public" boolean DEFAULT false,
	"created_by" varchar NOT NULL,
	"schedule" text,
	"recipients" text[],
	"last_generated" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" text DEFAULT 'Treemarkables' NOT NULL,
	"business_address" text DEFAULT '',
	"business_phone" text DEFAULT '',
	"business_email" text DEFAULT '',
	"business_website" text DEFAULT '',
	"business_logo" text DEFAULT '',
	"lead_assignment_method" text DEFAULT 'round_robin',
	"auto_follow_up_days" integer DEFAULT 3,
	"quote_pricing_model" text DEFAULT 'standard',
	"quote_validity_days" integer DEFAULT 30,
	"auto_quote_approval" boolean DEFAULT false,
	"job_auto_scheduling" boolean DEFAULT false,
	"job_buffer_time" integer DEFAULT 30,
	"cloud_sync_enabled" boolean DEFAULT true,
	"backup_frequency" text DEFAULT 'daily',
	"data_retention_days" integer DEFAULT 365,
	"auto_backup_time" text DEFAULT '02:00',
	"export_format" text DEFAULT 'csv',
	"metrics_start_date" timestamp,
	"servicem8_enabled" boolean DEFAULT false,
	"servicem8_api_key" text DEFAULT '',
	"google_calendar_enabled" boolean DEFAULT false,
	"email_integration_enabled" boolean DEFAULT false,
	"payment_gateway_enabled" boolean DEFAULT false,
	"payment_provider" text DEFAULT 'stripe',
	"mailchimp_enabled" boolean DEFAULT false,
	"mailchimp_api_key" text DEFAULT '',
	"mailchimp_audience_id" text DEFAULT '',
	"mailchimp_auto_sync" boolean DEFAULT true,
	"cache_duration" integer DEFAULT 300,
	"image_quality" integer DEFAULT 80,
	"real_time_updates_interval" integer DEFAULT 30,
	"auto_refresh_enabled" boolean DEFAULT true,
	"max_concurrent_jobs" integer DEFAULT 50,
	"offline_mode_enabled" boolean DEFAULT true,
	"gps_tracking_enabled" boolean DEFAULT true,
	"location_accuracy" text DEFAULT 'high',
	"mobile_data_sync" boolean DEFAULT true,
	"field_photo_quality" integer DEFAULT 85,
	"two_factor_required" boolean DEFAULT false,
	"session_timeout" integer DEFAULT 480,
	"password_expiration" integer DEFAULT 90,
	"audit_logging" boolean DEFAULT true,
	"default_gross_margin_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"daily_revenue_target" numeric(10, 2) DEFAULT '3500',
	"invoice_payment_days" integer DEFAULT 7,
	"xero_default_bank_account_code" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "call_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direction" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"from_number" text NOT NULL,
	"to_number" text NOT NULL,
	"duration" integer,
	"recording_url" text,
	"transcription" text,
	"transcription_summary" text,
	"sentiment" text,
	"job_id" varchar,
	"customer_id" varchar,
	"lead_id" varchar,
	"employee_id" varchar,
	"job_diary_entry_id" varchar,
	"caller_name" text,
	"caller_email" text,
	"notes" text,
	"tags" text[],
	"is_archived" boolean DEFAULT false,
	"call_started_at" timestamp,
	"call_ended_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar,
	"customer_id" varchar,
	"phone_number" text NOT NULL,
	"direction" text NOT NULL,
	"status" text,
	"duration" integer,
	"recording_url" text,
	"transcript_text" text,
	"summary" text,
	"intent" text,
	"sentiment" text,
	"quality_score" numeric(3, 2),
	"action_items" text[],
	"call_cost" numeric(6, 4),
	"twilio_call_sid" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text,
	"platform" text,
	"budget" numeric(10, 2),
	"spent" numeric(10, 2) DEFAULT '0',
	"start_date" timestamp,
	"end_date" timestamp,
	"target_audience" jsonb,
	"content" jsonb,
	"metrics" jsonb,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"leads_generated" integer DEFAULT 0,
	"cost_per_lead" numeric(10, 2),
	"roi" numeric(8, 2),
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "checklist_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"email_enabled" boolean DEFAULT true,
	"sms_enabled" boolean DEFAULT true,
	"marketing_opt_in" boolean DEFAULT false,
	"job_notifications" boolean DEFAULT true,
	"quote_notifications" boolean DEFAULT true,
	"reminder_notifications" boolean DEFAULT true,
	"emergency_notifications" boolean DEFAULT true,
	"preferred_notification_time" text,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"timezone" text DEFAULT 'Pacific/Auckland',
	"language" text DEFAULT 'en',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "communication_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"platform" text,
	"trigger_conditions" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"platform" text NOT NULL,
	"type" text NOT NULL,
	"subject" text,
	"content" text NOT NULL,
	"variables" text[] DEFAULT '{}',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"type" text NOT NULL,
	"thread_id" varchar,
	"external_id" text,
	"from" text NOT NULL,
	"from_email" text,
	"from_phone" text,
	"from_handle" text,
	"subject" text,
	"content" text NOT NULL,
	"content_type" text DEFAULT 'text',
	"to" text[] DEFAULT '{}',
	"cc" text[] DEFAULT '{}',
	"bcc" text[] DEFAULT '{}',
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"media_urls" text[] DEFAULT '{}',
	"is_read" boolean DEFAULT false NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"direction" text DEFAULT 'inbound' NOT NULL,
	"category" text,
	"tags" text[] DEFAULT '{}',
	"lead_id" varchar,
	"customer_id" varchar,
	"job_id" varchar,
	"assigned_to" varchar,
	"handled_by" varchar,
	"response_required" boolean DEFAULT false,
	"response_deadline" timestamp,
	"last_response_at" timestamp,
	"follow_up_date" timestamp,
	"platform_data" jsonb DEFAULT '{}'::jsonb,
	"sent_at" timestamp NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_signals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_name" text NOT NULL,
	"signal" text NOT NULL,
	"description" text,
	"price" numeric(10, 2),
	"service" text,
	"source" text,
	"impact" text,
	"action_required" boolean DEFAULT false,
	"action_taken" text,
	"data" jsonb,
	"detected_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requirement_id" varchar NOT NULL,
	"completed_by" text NOT NULL,
	"completed_at" timestamp NOT NULL,
	"status" text NOT NULL,
	"score" integer,
	"findings" text[] DEFAULT '{}',
	"corrective_actions" text[] DEFAULT '{}',
	"evidence" text[] DEFAULT '{}',
	"next_review_date" timestamp,
	"notes" text,
	"auditor_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_requirements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"type" text NOT NULL,
	"frequency" text NOT NULL,
	"regulatory_body" text,
	"due_date" timestamp NOT NULL,
	"last_completed" timestamp,
	"next_due" timestamp NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_to" text NOT NULL,
	"requirements" text[] DEFAULT '{}',
	"attachments" text[] DEFAULT '{}',
	"notes" text,
	"compliance_score" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"direction" text NOT NULL,
	"from_name" text,
	"from_contact" text,
	"to_name" text,
	"to_contact" text,
	"staff_id" varchar,
	"subject" text,
	"platform" text,
	"external_id" text,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"delivery_status" text,
	"attachments" text[] DEFAULT '{}',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar,
	"customer_id" varchar,
	"title" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'medium',
	"source" text NOT NULL,
	"service_type" text,
	"estimated_value" numeric(10, 2),
	"urgency" text,
	"property_type" text,
	"last_message_at" timestamp,
	"last_message_by" text,
	"unread_count" integer DEFAULT 0,
	"tags" text[] DEFAULT '{}',
	"assigned_to" varchar,
	"converted_to_quote_id" varchar,
	"conversion_date" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_auth" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_import_batches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_type" text NOT NULL,
	"file_name" text,
	"total_records" integer DEFAULT 0,
	"successful_records" integer DEFAULT 0,
	"failed_records" integer DEFAULT 0,
	"duplicates_skipped" integer DEFAULT 0,
	"error_details" jsonb,
	"import_settings" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"mobile" text,
	"normalized_phone" text,
	"address" text,
	"city" text,
	"region" text,
	"notes" text,
	"source" text,
	"import_source" text DEFAULT 'manual',
	"import_batch_id" varchar,
	"external_id" text,
	"servicem8_uuid" text,
	"lifetime_value" numeric(10, 2) DEFAULT '0',
	"total_jobs" integer DEFAULT 0,
	"last_contact_date" timestamp,
	"preferred_contact_method" text,
	"tags" text[],
	"is_active" boolean DEFAULT true,
	"is_vip_member" boolean DEFAULT false,
	"vip_member_since" timestamp,
	"vip_discount_percent" numeric(5, 2),
	"invoice_cc_email" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_briefings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "daily_briefings_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "daily_job_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"date" text NOT NULL,
	"note" text NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"user_id" varchar,
	"is_default" boolean DEFAULT false,
	"layout" jsonb NOT NULL,
	"widgets" jsonb NOT NULL,
	"filters" jsonb,
	"refresh_interval" integer DEFAULT 300,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"company_name" text DEFAULT 'Treemarkables LTD',
	"company_address" text DEFAULT '213 Stanley road, Gisborne',
	"company_email" text DEFAULT 'quotes@treemarkables.nz',
	"company_phone" text DEFAULT '027 216 6882',
	"gst_number" text DEFAULT '131-047-592-GST004',
	"header_layout" jsonb,
	"footer_text" text,
	"payment_terms" text DEFAULT 'Payment due within 7 days',
	"section_config" jsonb,
	"block_config" jsonb,
	"primary_color" text DEFAULT '#f97316',
	"secondary_color" text DEFAULT '#3b82f6',
	"logo_url" text,
	"logo_size" integer DEFAULT 40,
	"logo_alignment" text DEFAULT 'left',
	"header_color" text DEFAULT '#ffffff',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" text NOT NULL,
	"event_type" text NOT NULL,
	"recipient" text,
	"timestamp" timestamp NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"link_url" text,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"subject" text NOT NULL,
	"html_content" text NOT NULL,
	"text_content" text,
	"variables" text[] DEFAULT '{}',
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"attach_invoice_pdf" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"password" text,
	"position" text NOT NULL,
	"role" text DEFAULT 'crew' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"skill_level" text DEFAULT 'beginner' NOT NULL,
	"certifications" text[] DEFAULT '{}',
	"licences" text[] DEFAULT '{}',
	"skills" text[] DEFAULT '{}',
	"hourly_rate" numeric(10, 2),
	"charge_out_rate" numeric(10, 2),
	"cost_line_item_number" text,
	"charge_out_line_item_number" text,
	"available_hours" text,
	"emergency_contact" text,
	"emergency_contact_phone" text,
	"notes" text,
	"hire_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"brand" text,
	"model" text,
	"year" integer,
	"status" text DEFAULT 'available' NOT NULL,
	"condition" text DEFAULT 'good' NOT NULL,
	"last_maintenance_date" timestamp,
	"next_maintenance_date" timestamp,
	"maintenance_interval_days" integer DEFAULT 90,
	"hours_used" numeric(10, 2) DEFAULT '0',
	"purchase_price" numeric(10, 2),
	"current_value" numeric(10, 2),
	"daily_rental_cost" numeric(10, 2),
	"current_location" text,
	"assigned_to" varchar,
	"serial_number" text,
	"registration_number" text,
	"insurance_policy_number" text,
	"notes" text,
	"photos" text[] DEFAULT '{}',
	"registration_expiry_date" timestamp,
	"cof_expiry_date" timestamp,
	"default_inspection_template_id" varchar,
	"licence_required" text,
	"requires_pre_start" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_checkouts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equipment_id" varchar NOT NULL,
	"checked_out_by" text NOT NULL,
	"checked_out_to" text,
	"job_id" varchar,
	"checkout_time" timestamp DEFAULT now(),
	"expected_return_time" timestamp,
	"actual_return_time" timestamp,
	"checkout_condition" text DEFAULT 'good',
	"return_condition" text,
	"hours_used" numeric(8, 2),
	"mileage_start" integer,
	"mileage_end" integer,
	"fuel_level_start" integer,
	"fuel_level_end" integer,
	"notes" text,
	"damage_report" text,
	"photos" text[] DEFAULT '{}',
	"status" text DEFAULT 'checked_out',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment_inductions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar NOT NULL,
	"employee_name" text NOT NULL,
	"equipment_type" text,
	"template_id" varchar,
	"template_name" text,
	"induction_date" timestamp DEFAULT now() NOT NULL,
	"inducted_by" varchar NOT NULL,
	"inductor_name" text NOT NULL,
	"notes" text,
	"employee_signature" text,
	"trainer_signature" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "equipment_maintenance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equipment_id" varchar NOT NULL,
	"maintenance_type" text NOT NULL,
	"description" text NOT NULL,
	"performed_by" text,
	"cost" numeric(10, 2),
	"parts_replaced" text[] DEFAULT '{}',
	"next_service_due" timestamp,
	"notes" text,
	"photos" text[] DEFAULT '{}',
	"invoice_number" text,
	"warranty_info" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fcm_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar NOT NULL,
	"token" text NOT NULL,
	"device_info" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "fcm_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "financial_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"period_type" text NOT NULL,
	"total_income" numeric(12, 2) DEFAULT '0',
	"total_expenses" numeric(12, 2) DEFAULT '0',
	"labor_costs" numeric(12, 2) DEFAULT '0',
	"material_costs" numeric(12, 2) DEFAULT '0',
	"equipment_costs" numeric(12, 2) DEFAULT '0',
	"operational_costs" numeric(12, 2) DEFAULT '0',
	"marketing_costs" numeric(12, 2) DEFAULT '0',
	"gross_profit" numeric(12, 2) DEFAULT '0',
	"net_profit" numeric(12, 2) DEFAULT '0',
	"profit_margin" numeric(5, 2) DEFAULT '0',
	"cash_flow" numeric(12, 2) DEFAULT '0',
	"accounts_receivable" numeric(12, 2) DEFAULT '0',
	"accounts_payable" numeric(12, 2) DEFAULT '0',
	"outstanding_invoices" integer DEFAULT 0,
	"average_collection_period" numeric(8, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "generated_document_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generated_document_id" varchar NOT NULL,
	"section_title" text,
	"item_type" text NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1',
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"unit" text DEFAULT 'each',
	"sort_order" integer DEFAULT 0,
	"is_selected" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "generated_document_photos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generated_document_id" varchar NOT NULL,
	"section_title" text,
	"photo_url" text NOT NULL,
	"caption" text,
	"alt_text" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "generated_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"job_id" varchar,
	"customer_id" varchar,
	"quote_id" varchar,
	"document_type" text NOT NULL,
	"document_number" text NOT NULL,
	"status" text DEFAULT 'draft',
	"customer_name" text NOT NULL,
	"customer_email" text,
	"customer_phone" text,
	"customer_address" text,
	"title" text,
	"description" text,
	"subtotal" numeric(10, 2),
	"gst_amount" numeric(10, 2),
	"total_amount" numeric(10, 2),
	"pdf_url" text,
	"pdf_generated" boolean DEFAULT false,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"accepted_at" timestamp,
	"rejected_at" timestamp,
	"valid_until" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "generated_documents_document_number_unique" UNIQUE("document_number")
);
--> statement-breakpoint
CREATE TABLE "induction_checklist_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"step" text NOT NULL,
	"requires_photo" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"category" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "induction_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"induction_id" varchar NOT NULL,
	"checklist_item_id" varchar,
	"step" text NOT NULL,
	"category" text,
	"requires_photo" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"notes" text,
	"photos" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "induction_responses_induction_id_checklist_item_id_unique" UNIQUE("induction_id","checklist_item_id")
);
--> statement-breakpoint
CREATE TABLE "induction_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"equipment_type" text,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inspection_checklist_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"question" text NOT NULL,
	"requires_comment" boolean DEFAULT false NOT NULL,
	"requires_photo" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"category" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inspection_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" varchar NOT NULL,
	"checklist_item_id" varchar,
	"question" text NOT NULL,
	"category" text,
	"requires_comment" boolean DEFAULT false NOT NULL,
	"requires_photo" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"response" text NOT NULL,
	"comment" text,
	"photos" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "inspection_responses_inspection_id_checklist_item_id_unique" UNIQUE("inspection_id","checklist_item_id")
);
--> statement-breakpoint
CREATE TABLE "inspection_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"vehicle_type" text,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"category" text NOT NULL,
	"description" text,
	"compatible_equipment" text[] DEFAULT '{}',
	"current_stock" integer DEFAULT 0 NOT NULL,
	"minimum_stock" integer DEFAULT 1 NOT NULL,
	"maximum_stock" integer DEFAULT 100 NOT NULL,
	"reorder_point" integer DEFAULT 5 NOT NULL,
	"unit_cost" numeric(10, 2),
	"unit_price" numeric(10, 2),
	"supplier" text,
	"supplier_part_number" text,
	"unit" text DEFAULT 'each',
	"weight" numeric(8, 2),
	"dimensions" text,
	"storage_location" text,
	"last_order_date" timestamp,
	"last_used_date" timestamp,
	"expiration_date" timestamp,
	"notes" text,
	"photos" text[] DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "inventory_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_id" varchar NOT NULL,
	"transaction_type" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(10, 2),
	"total_cost" numeric(10, 2),
	"job_id" varchar,
	"equipment_id" varchar,
	"employee_name" text,
	"supplier" text,
	"invoice_number" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"unit" text DEFAULT 'each',
	"category" text,
	"labor_type" text,
	"employee_id" varchar,
	"service_id" varchar,
	"material_id" varchar,
	"unit_cost" numeric(10, 2),
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"section_type" text NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '',
	"images" text[] DEFAULT '{}',
	"sort_order" integer NOT NULL,
	"is_visible" boolean DEFAULT true,
	"styling" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"job_id" varchar,
	"invoice_number" text NOT NULL,
	"job_title" text NOT NULL,
	"address" text,
	"contact_name" text,
	"issue_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" text NOT NULL,
	"items" jsonb NOT NULL,
	"description" text,
	"notes" text,
	"paid_at" timestamp,
	"paid_notes" text,
	"sent_date" timestamp,
	"xero_invoice_id" text,
	"xero_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "jha_assessments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar,
	"assessment_number" text,
	"date" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"location" text,
	"gps_coordinates" text,
	"activity_description" text,
	"ppe_required" text[],
	"team_leader" text,
	"team_leader_id" varchar,
	"summary" text,
	"overall_risk_rating" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"photos" text[] DEFAULT '{}',
	"comments" text,
	"created_by" varchar,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "jha_assessments_assessment_number_unique" UNIQUE("assessment_number")
);
--> statement-breakpoint
CREATE TABLE "jha_control_measure_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hazard_template_id" varchar,
	"description" text NOT NULL,
	"hierarchy_level" integer DEFAULT 3 NOT NULL,
	"risk_reduction" integer DEFAULT 1,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jha_hazard_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jha_risk_control_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"hierarchy_level" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jha_signatures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" varchar NOT NULL,
	"worker_name" text NOT NULL,
	"worker_id" varchar,
	"signature_data_url" text NOT NULL,
	"signed_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jha_step_controls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"step_id" varchar NOT NULL,
	"control_measure_template_id" varchar,
	"description" text NOT NULL,
	"hierarchy_level" integer DEFAULT 3,
	"is_implemented" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jha_steps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" varchar NOT NULL,
	"step_number" integer NOT NULL,
	"step_name" text,
	"hazard_name" text NOT NULL,
	"hazard_description" text,
	"hazard_template_id" varchar,
	"initial_risk_rating" integer NOT NULL,
	"residual_risk_rating" integer,
	"risk_control" text,
	"responsible_person" text,
	"responsible_person_id" varchar,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_diary_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"entry_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"content" text,
	"author_name" text NOT NULL,
	"author_role" text,
	"photos" text[],
	"photo_url" text,
	"weather_conditions" text,
	"equipment_used" text[],
	"time_spent" integer,
	"progress" integer,
	"tags" text[],
	"location" text,
	"is_private" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_staff_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"employee_id" varchar NOT NULL,
	"schedule_event_id" varchar,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"role" text,
	"day_role" text,
	"status" text DEFAULT 'assigned' NOT NULL,
	"notification_sent" boolean DEFAULT false NOT NULL,
	"notification_sent_at" timestamp,
	"confirmed" boolean DEFAULT false NOT NULL,
	"confirmed_at" timestamp,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"service_type" text NOT NULL,
	"default_title" text NOT NULL,
	"default_description" text,
	"base_price" numeric(10, 2),
	"price_per_hour" numeric(10, 2),
	"material_costs" numeric(10, 2),
	"price_model" text DEFAULT 'fixed',
	"estimated_duration" integer,
	"required_skills" text[] DEFAULT '{}',
	"required_equipment" text[] DEFAULT '{}',
	"crew_size" integer DEFAULT 2,
	"default_priority" text DEFAULT 'medium',
	"safety_requirements" text[] DEFAULT '{}',
	"procedures" text,
	"risk_level" text DEFAULT 'medium' NOT NULL,
	"special_instructions" text,
	"required_permits" boolean DEFAULT false,
	"weather_dependent" boolean DEFAULT true,
	"pre_job_checklist" text[] DEFAULT '{}',
	"post_job_checklist" text[] DEFAULT '{}',
	"equipment_checklist" text[] DEFAULT '{}',
	"category_tags" text[] DEFAULT '{}',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar,
	"quote_id" varchar,
	"job_number" text NOT NULL,
	"title" text,
	"description" text,
	"include_description_in_quotes_proposals" boolean DEFAULT true,
	"lead_source" text,
	"address" text DEFAULT 'Address not specified' NOT NULL,
	"scheduled_date" timestamp,
	"scheduled_end_date" timestamp,
	"scheduled_start_time" text,
	"scheduled_end_time" text,
	"completed_date" timestamp,
	"work_order_at" timestamp,
	"status" text DEFAULT 'quote' NOT NULL,
	"priority" text,
	"assigned_team" text[],
	"assigned_to" text[],
	"estimated_duration" integer,
	"actual_duration" integer,
	"equipment" text[],
	"special_instructions" text,
	"before_photos" text[],
	"after_photos" text[],
	"total_amount" numeric(10, 2),
	"cost_of_goods" numeric(10, 2),
	"labor_costs" numeric(10, 2),
	"materials_costs" numeric(10, 2),
	"other_costs" numeric(10, 2),
	"gross_margin" numeric(5, 2),
	"gross_margin_calculated" boolean DEFAULT false,
	"profit_margin" numeric(5, 2),
	"labor_hours" numeric(8, 2),
	"hourly_rate" numeric(8, 2),
	"estimated_man_hours" numeric(8, 2),
	"actual_man_hours" numeric(8, 2),
	"estimation_accuracy" numeric(5, 2),
	"estimation_variance" numeric(8, 2),
	"actual_labor_costs" numeric(10, 2),
	"actual_materials_costs" numeric(10, 2),
	"equipment_costs" numeric(10, 2),
	"subcontractor_costs" numeric(10, 2),
	"permit_costs" numeric(10, 2),
	"travel_costs" numeric(10, 2),
	"disposal_costs" numeric(10, 2),
	"misc_expenses" numeric(10, 2),
	"labor_costs_complete" boolean DEFAULT false,
	"materials_costs_complete" boolean DEFAULT false,
	"equipment_costs_complete" boolean DEFAULT false,
	"subcontractor_costs_complete" boolean DEFAULT false,
	"other_expenses_complete" boolean DEFAULT false,
	"all_expenses_complete" boolean DEFAULT false,
	"staff_time_entries" jsonb,
	"total_staff_hours" numeric(8, 2),
	"calculated_labor_cost" numeric(10, 2),
	"assigned_staff_ids" text[],
	"staff_assignments" jsonb,
	"invoice_blocked" boolean DEFAULT true,
	"margin_meets_threshold" boolean DEFAULT false,
	"minimum_margin_threshold" numeric(5, 2) DEFAULT '25.00',
	"invoice_eligible" boolean DEFAULT false,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"equipment_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"role_a_completed_at" timestamp,
	"role_a_completed_by" varchar,
	"role_b_completed_at" timestamp,
	"role_b_completed_by" varchar,
	"notes" text,
	"internal_notes" text,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposal_title" text,
	"proposal_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposal_sent" boolean DEFAULT false,
	"proposal_sent_date" timestamp,
	"quote_presentation_method" text,
	"quote_presented_date" timestamp,
	"weather_dependent" boolean DEFAULT false,
	"permit_required" boolean DEFAULT false,
	"insurance_claim" boolean DEFAULT false,
	"rescheduled_reason" text,
	"metrics_eligible" boolean DEFAULT false,
	"metrics_start_date" timestamp,
	"billing_address" text,
	"billing_name_override" text,
	"city" text,
	"region" text,
	"invoice_description" text,
	"billing_contact_email" text,
	"billing_contact_phone" text,
	"billing_contact_mobile" text,
	"same_as_job_address" boolean DEFAULT true,
	"job_contact_first_name" text,
	"job_contact_last_name" text,
	"job_contact_email" text,
	"job_contact_phone" text,
	"job_contact_mobile" text,
	"tenant_contact_first_name" text,
	"tenant_contact_last_name" text,
	"tenant_contact_email" text,
	"tenant_contact_phone" text,
	"tenant_contact_mobile" text,
	"tax_mode" text DEFAULT 'tax_exclusive',
	"tax_rate" numeric(5, 2) DEFAULT '15.00',
	"subtotal" numeric(10, 2) DEFAULT '0.00',
	"gst_amount" numeric(10, 2) DEFAULT '0.00',
	"total_including_gst" numeric(10, 2) DEFAULT '0.00',
	"paid_amount" numeric(10, 2) DEFAULT '0.00',
	"balance_due" numeric(10, 2) DEFAULT '0.00',
	"xero_invoice_id" text,
	"xero_status" text,
	"sent_to_xero_date" timestamp,
	"unsuccessful_reason" text,
	"unsuccessful_notes" text,
	"unsuccessful_date" timestamp,
	"in_queue" boolean DEFAULT false,
	"queue_reason" text,
	"loom_video_url" text,
	"customer_confirmed" boolean DEFAULT false,
	"customer_confirmed_at" timestamp,
	"customer_confirmation_method" text,
	"eta_notification_requested" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_activity_at" timestamp,
	CONSTRAINT "jobs_job_number_unique" UNIQUE("job_number")
);
--> statement-breakpoint
CREATE TABLE "kpi_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"calculation" text NOT NULL,
	"data_source" text NOT NULL,
	"target_value" numeric(10, 2),
	"warning_threshold" numeric(10, 2),
	"critical_threshold" numeric(10, 2),
	"unit" text,
	"is_active" boolean DEFAULT true,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar,
	"name" text,
	"email" text,
	"phone" text,
	"address" text,
	"service_requested" text,
	"urgency" text,
	"status" text NOT NULL,
	"source" text,
	"notes" text,
	"estimated_value" numeric(10, 2),
	"follow_up_date" timestamp,
	"lost_reason" text,
	"lost_reason_details" text,
	"assigned_to" text,
	"lead_source" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"platform" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp,
	"published_at" timestamp,
	"objective" text,
	"budget" numeric(10, 2),
	"budget_type" text,
	"ad_creative" jsonb,
	"targeting" jsonb,
	"review_id" text,
	"review_text" text,
	"review_author" text,
	"review_rating" integer,
	"review_source" text,
	"meta_campaign_id" text,
	"meta_ad_set_id" text,
	"meta_ad_id" text,
	"meta_post_id" text,
	"reach" integer DEFAULT 0,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"engagement" integer DEFAULT 0,
	"spent" numeric(10, 2) DEFAULT '0',
	"conversions" integer DEFAULT 0,
	"created_by" varchar,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_number" text NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"cost" numeric(10, 2) DEFAULT '0.00',
	"price_includes_tax" boolean DEFAULT false,
	"tax_rate" text NOT NULL,
	"category" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mulch_drops" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"drop_notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"photos" text[] DEFAULT '{}',
	"notes" text,
	"source" text DEFAULT 'manual',
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "near_miss_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"control_type" text,
	"assigned_to_user_id" varchar,
	"due_date" timestamp,
	"status" text DEFAULT 'open' NOT NULL,
	"linked_sop_id" varchar,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "near_miss_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" varchar NOT NULL,
	"type" text NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "near_miss_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_number" text NOT NULL,
	"reporter_user_id" varchar NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"job_id" varchar,
	"location_address" text,
	"location_lat" numeric(10, 7),
	"location_lng" numeric(10, 7),
	"incident_datetime" timestamp NOT NULL,
	"category" text NOT NULL,
	"potential_severity" text NOT NULL,
	"description" text NOT NULL,
	"immediate_action_taken" text,
	"equipment_involved" text[] DEFAULT '{}',
	"contributing_factors" text[] DEFAULT '{}',
	"people_involved" jsonb DEFAULT '[]'::jsonb,
	"toolbox_talk_flag" boolean DEFAULT true,
	"proposed_control" text,
	"reporter_signature_svg" text,
	"reporter_signed_at" timestamp,
	"submitted_at" timestamp,
	"effectiveness_review_date" timestamp,
	"effectiveness_review_complete" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "near_miss_reports_report_number_unique" UNIQUE("report_number")
);
--> statement-breakpoint
CREATE TABLE "near_miss_witnesses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" varchar NOT NULL,
	"witness_user_id" varchar,
	"witness_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"signature_svg" text,
	"witness_comment" text,
	"signed_at" timestamp,
	"signed_lat" numeric(10, 7),
	"signed_lng" numeric(10, 7),
	"signed_device" text,
	"report_hash_at_signing" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar NOT NULL,
	"job_assignments" boolean DEFAULT true NOT NULL,
	"schedule_changes" boolean DEFAULT true NOT NULL,
	"job_status_updates" boolean DEFAULT false NOT NULL,
	"new_leads" boolean DEFAULT false NOT NULL,
	"invoice_payments" boolean DEFAULT false NOT NULL,
	"quote_accepted" boolean DEFAULT false NOT NULL,
	"customer_messages" boolean DEFAULT true NOT NULL,
	"team_messages" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "notification_preferences_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE "notification_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" varchar NOT NULL,
	"recipient_email" text,
	"recipient_phone" text,
	"notification_type" text NOT NULL,
	"subject" text,
	"message" text NOT NULL,
	"metadata" jsonb,
	"send_at" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"error" text,
	"job_id" varchar,
	"assignment_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"user_id" varchar,
	"lead_id" varchar,
	"job_id" varchar,
	"customer_id" varchar,
	"quote_id" varchar,
	"proposal_id" varchar,
	"diary_entry_id" varchar,
	"metadata" jsonb,
	"action_url" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_outbound_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar,
	"customer_id" varchar,
	"proposal_id" varchar,
	"proposal_number" text,
	"recipient_name" text,
	"recipient_phone" text,
	"recipient_email" text,
	"message" text NOT NULL,
	"channel" text DEFAULT 'sms' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_date" timestamp NOT NULL,
	"period" text NOT NULL,
	"total_revenue" numeric(12, 2) DEFAULT '0',
	"total_jobs" integer DEFAULT 0,
	"total_quotes" integer DEFAULT 0,
	"quotes_accepted" integer DEFAULT 0,
	"quotes_rejected" integer DEFAULT 0,
	"average_job_value" numeric(10, 2) DEFAULT '0',
	"average_quote_value" numeric(10, 2) DEFAULT '0',
	"conversion_rate" numeric(5, 2) DEFAULT '0',
	"customer_acquisition_cost" numeric(10, 2) DEFAULT '0',
	"customer_lifetime_value" numeric(10, 2) DEFAULT '0',
	"gross_margin" numeric(5, 2) DEFAULT '0',
	"net_margin" numeric(5, 2) DEFAULT '0',
	"equipment_utilization" numeric(5, 2) DEFAULT '0',
	"average_response_time" numeric(8, 2) DEFAULT '0',
	"customer_satisfaction_score" numeric(3, 1) DEFAULT '0',
	"repeat_customer_rate" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar,
	"customer_id" varchar,
	"job_diary_entry_id" varchar,
	"proposal_section_id" varchar,
	"url" text NOT NULL,
	"filename" text NOT NULL,
	"original_name" text,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"type" text NOT NULL,
	"category" text DEFAULT 'general',
	"captured_at" timestamp NOT NULL,
	"captured_by" text NOT NULL,
	"location" text,
	"gps_latitude" real,
	"gps_longitude" real,
	"gps_accuracy" real,
	"gps_address" text,
	"notes" text,
	"tags" text[] DEFAULT '{}',
	"is_public" boolean DEFAULT false,
	"is_featured" boolean DEFAULT false,
	"show_to_customer" boolean DEFAULT true,
	"processing_status" text DEFAULT 'uploaded',
	"thumbnail_url" text,
	"medium_url" text,
	"exif_data" jsonb,
	"weather_conditions" text,
	"equipment_visible" text[] DEFAULT '{}',
	"safety_issues" text[] DEFAULT '{}',
	"quality_score" integer,
	"ai_description" text,
	"before_after_pair_id" varchar,
	"sequence_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "price_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_name" text NOT NULL,
	"base_price" numeric(10, 2) NOT NULL,
	"price_unit" text,
	"complexity" text,
	"urgency_multiplier" numeric(4, 2) DEFAULT '1.0',
	"seasonal_multiplier" numeric(4, 2) DEFAULT '1.0',
	"equipment_cost" numeric(8, 2) DEFAULT '0',
	"labor_hours" numeric(5, 2),
	"material_cost" numeric(8, 2) DEFAULT '0',
	"profit_margin_target" numeric(5, 2) DEFAULT '25.0',
	"competitive_adjustment" numeric(5, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"valid_from" timestamp DEFAULT now(),
	"valid_until" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_line_item_choices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line_item_id" varchar NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"is_default" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"section_id" varchar,
	"source_type" text NOT NULL,
	"source_id" varchar,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"unit" text DEFAULT 'each',
	"category" text,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_optional" boolean DEFAULT false,
	"pricing_type" text DEFAULT 'normal' NOT NULL,
	"selected_choice_id" varchar,
	"fixed_price" numeric(10, 2),
	"selected" boolean DEFAULT true NOT NULL,
	"price_includes_tax" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"section_type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"images" text[] DEFAULT '{}',
	"sort_order" integer NOT NULL,
	"is_visible" boolean DEFAULT true,
	"styling" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar,
	"quote_id" varchar,
	"customer_id" varchar NOT NULL,
	"proposal_number" text NOT NULL,
	"title" text NOT NULL,
	"introduction" text,
	"conclusion" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"delivery_method" text,
	"sent_date" timestamp,
	"viewed_date" timestamp,
	"response_date" timestamp,
	"expiry_date" timestamp,
	"customer_signature" text,
	"signed_date" timestamp,
	"template_used" text,
	"branding" jsonb,
	"block_config" jsonb,
	"total_amount" numeric(10, 2) DEFAULT '0.00',
	"subtotal" numeric(10, 2) DEFAULT '0.00',
	"gst_amount" numeric(10, 2) DEFAULT '0.00',
	"tax_rate" numeric(5, 2) DEFAULT '15.00',
	"discount_amount" numeric(10, 2) DEFAULT '0.00',
	"discount_type" text DEFAULT 'fixed',
	"potential_value" numeric(10, 2) DEFAULT '0.00',
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "proposals_proposal_number_unique" UNIQUE("proposal_number")
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar,
	"job_id" varchar,
	"customer_id" varchar,
	"quote_number" text NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"valid_until" timestamp,
	"status" text NOT NULL,
	"sent_date" timestamp,
	"viewed_date" timestamp,
	"response_date" timestamp,
	"rejection_reason" text,
	"competitor_name" text,
	"competitor_price" numeric(10, 2),
	"price_adjustment_reason" text,
	"line_items" jsonb,
	"terms" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"follow_up_status" text DEFAULT 'pending',
	"follow_up_count" integer DEFAULT 0,
	"last_follow_up_date" timestamp,
	"next_follow_up_date" timestamp,
	"follow_up_notes" text,
	"presentation_method" text,
	CONSTRAINT "quotes_quote_number_unique" UNIQUE("quote_number")
);
--> statement-breakpoint
CREATE TABLE "report_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" varchar,
	"viewed_by" varchar,
	"viewed_at" timestamp NOT NULL,
	"export_format" text,
	"execution_time" numeric(8, 3),
	"data_points_returned" integer,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "review_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"token" varchar(64) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"sent_by" text,
	"sent_via" text,
	"customer_name" text NOT NULL,
	"customer_email" text,
	"customer_phone" text,
	"job_number" text,
	"job_address" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "review_requests_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "review_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"posted_to_google" boolean DEFAULT false,
	"posted_to_facebook" boolean DEFAULT false,
	"google_post_status" text,
	"facebook_post_status" text,
	"google_posted_at" timestamp,
	"facebook_posted_at" timestamp,
	"internal_status" text DEFAULT 'pending_review',
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"internal_notes" text,
	"submitted_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar,
	"job_id" varchar,
	"platform" text NOT NULL,
	"rating" integer NOT NULL,
	"review_text" text,
	"reviewer_name" text,
	"review_date" timestamp,
	"response" text,
	"response_date" timestamp,
	"sentiment" text,
	"keywords" text[],
	"is_public" boolean DEFAULT true,
	"platform_review_id" text,
	"photo_urls" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "risk_assessments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar,
	"assessment_date" timestamp DEFAULT now(),
	"assessed_by" text NOT NULL,
	"overall_risk" text NOT NULL,
	"weather_risk" text,
	"equipment_risk" text,
	"site_conditions" text NOT NULL,
	"hazards" text[] DEFAULT '{}',
	"control_measures" text[] DEFAULT '{}',
	"required_ppe" text[] DEFAULT '{}',
	"recommendations" text,
	"approved_by" text,
	"approved_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "safety_incidents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_number" text NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'reported' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"location" text NOT NULL,
	"job_id" varchar,
	"reported_by" text NOT NULL,
	"reported_at" timestamp DEFAULT now(),
	"involved_persons" text[] DEFAULT '{}',
	"witnesses" text[] DEFAULT '{}',
	"injuries_description" text,
	"immediate_actions" text NOT NULL,
	"root_cause" text,
	"preventive_actions" text,
	"follow_up_required" boolean DEFAULT false,
	"follow_up_date" timestamp,
	"assigned_to" text,
	"photos" text[] DEFAULT '{}',
	"cost" numeric(10, 2),
	"regulatory_notification" boolean DEFAULT false,
	"regulatory_reference" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "safety_incidents_incident_number_unique" UNIQUE("incident_number")
);
--> statement-breakpoint
CREATE TABLE "schedule_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"job_id" varchar,
	"customer_id" varchar,
	"lead_id" varchar,
	"assigned_employees" text[] DEFAULT '{}',
	"required_skills" text[] DEFAULT '{}',
	"equipment" text[] DEFAULT '{}',
	"location" text,
	"address" text,
	"travel_time" integer,
	"estimated_duration" integer,
	"priority" text DEFAULT 'medium' NOT NULL,
	"weather_dependent" boolean DEFAULT true NOT NULL,
	"color" text DEFAULT '#3B82F6',
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"service_type" text NOT NULL,
	"description" text NOT NULL,
	"address" text NOT NULL,
	"preferred_date" timestamp,
	"urgency" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"base_price" numeric(10, 2) NOT NULL,
	"base_cost" numeric(10, 2) DEFAULT '0.00',
	"unit" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"variables" text[] DEFAULT '{}',
	"description" text,
	"max_length" integer DEFAULT 306,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"content_type" text,
	"caption" text,
	"hashtags" text[],
	"image_url" text,
	"scheduled_date" timestamp,
	"published_date" timestamp,
	"status" text,
	"engagement" jsonb,
	"reach" integer,
	"impressions" integer,
	"clicks" integer,
	"platform_post_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"team_leader_id" varchar,
	"members" text[],
	"specialties" text[],
	"max_capacity" integer DEFAULT 4,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "template_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar,
	"section_id" varchar,
	"item_type" text NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1',
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2),
	"unit" text DEFAULT 'each',
	"sort_order" integer DEFAULT 0,
	"is_optional" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "template_photos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar,
	"section_id" varchar,
	"photo_url" text NOT NULL,
	"thumbnail_url" text,
	"caption" text,
	"alt_text" text,
	"sort_order" integer DEFAULT 0,
	"is_visible" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "template_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"section_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0,
	"is_visible" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tree_markers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"label" text,
	"notes" text,
	"marker_type" text DEFAULT 'tree',
	"color" text DEFAULT '#22c55e',
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vehicle_inspections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"vehicle_name" text NOT NULL,
	"vehicle_registration" text,
	"template_id" varchar,
	"template_name" text,
	"inspection_date" timestamp DEFAULT now() NOT NULL,
	"inspected_by" varchar NOT NULL,
	"inspector_name" text NOT NULL,
	"speedometer_reading" integer,
	"status" text DEFAULT 'pass' NOT NULL,
	"overall_notes" text,
	"signature" text,
	"device_info" text,
	"location" text,
	"photos" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "xero_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"tenant_name" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id_token" text,
	"scope" text,
	"is_active" boolean DEFAULT true,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "xero_connections_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "xero_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_account_code" text DEFAULT '200' NOT NULL,
	"tax_type" text DEFAULT 'OUTPUT2' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_time_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar NOT NULL,
	"employee_name" text NOT NULL,
	"entry_date" text NOT NULL,
	"total_day_hours" numeric(4, 2) NOT NULL,
	"billable_hours" numeric(4, 2) DEFAULT '0',
	"maintenance_hours" numeric(4, 2) DEFAULT '0',
	"travel_hours" numeric(4, 2) DEFAULT '0',
	"admin_hours" numeric(4, 2) DEFAULT '0',
	"break_hours" numeric(4, 2) DEFAULT '0',
	"job_efficiency" numeric(5, 2),
	"utilization_rate" numeric(5, 2),
	"productivity_rate" numeric(5, 2),
	"xero_project_id" text,
	"synced_to_xero" boolean DEFAULT false,
	"xero_sync_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_time_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_entry_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"job_number" text NOT NULL,
	"employee_id" varchar NOT NULL,
	"employee_name" text NOT NULL,
	"line_item_id" text NOT NULL,
	"line_item_number" text NOT NULL,
	"line_item_name" text NOT NULL,
	"line_item_category" text NOT NULL,
	"service_type" text,
	"service_name" text,
	"entry_date" text NOT NULL,
	"start_time" text,
	"hours" numeric(4, 2) NOT NULL,
	"rate" numeric(6, 2) NOT NULL,
	"service_line_item_created" boolean DEFAULT false,
	"labor_line_item_created" boolean DEFAULT false,
	"service_line_item_id" text,
	"labor_line_item_id" text,
	"billed" boolean DEFAULT false,
	"rounding_mode" text DEFAULT 'none',
	"travel_time_included" boolean DEFAULT false,
	"xero_time_id" text,
	"synced_to_xero" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staff_rates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar NOT NULL,
	"employee_name" text NOT NULL,
	"service_type" text NOT NULL,
	"hourly_rate" numeric(6, 2) NOT NULL,
	"effective_date" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_job_diary_entry_id_job_diary_entries_id_fk" FOREIGN KEY ("job_diary_entry_id") REFERENCES "public"."job_diary_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_preferences" ADD CONSTRAINT "communication_preferences_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_records" ADD CONSTRAINT "compliance_records_requirement_id_compliance_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."compliance_requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_converted_to_quote_id_quotes_id_fk" FOREIGN KEY ("converted_to_quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_auth" ADD CONSTRAINT "customer_auth_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_import_batch_id_customer_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."customer_import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_job_notes" ADD CONSTRAINT "daily_job_notes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_checkouts" ADD CONSTRAINT "equipment_checkouts_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_checkouts" ADD CONSTRAINT "equipment_checkouts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_inductions" ADD CONSTRAINT "equipment_inductions_template_id_induction_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."induction_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_maintenance" ADD CONSTRAINT "equipment_maintenance_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fcm_tokens" ADD CONSTRAINT "fcm_tokens_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_document_line_items" ADD CONSTRAINT "generated_document_line_items_generated_document_id_generated_documents_id_fk" FOREIGN KEY ("generated_document_id") REFERENCES "public"."generated_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_document_photos" ADD CONSTRAINT "generated_document_photos_generated_document_id_generated_documents_id_fk" FOREIGN KEY ("generated_document_id") REFERENCES "public"."generated_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_template_id_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "induction_checklist_items" ADD CONSTRAINT "induction_checklist_items_template_id_induction_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."induction_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "induction_responses" ADD CONSTRAINT "induction_responses_induction_id_equipment_inductions_id_fk" FOREIGN KEY ("induction_id") REFERENCES "public"."equipment_inductions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "induction_responses" ADD CONSTRAINT "induction_responses_checklist_item_id_induction_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."induction_checklist_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_checklist_items" ADD CONSTRAINT "inspection_checklist_items_template_id_inspection_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."inspection_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_responses" ADD CONSTRAINT "inspection_responses_inspection_id_vehicle_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."vehicle_inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_responses" ADD CONSTRAINT "inspection_responses_checklist_item_id_inspection_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."inspection_checklist_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_sections" ADD CONSTRAINT "invoice_sections_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jha_assessments" ADD CONSTRAINT "jha_assessments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jha_assessments" ADD CONSTRAINT "jha_assessments_team_leader_id_employees_id_fk" FOREIGN KEY ("team_leader_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jha_assessments" ADD CONSTRAINT "jha_assessments_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jha_control_measure_templates" ADD CONSTRAINT "jha_control_measure_templates_hazard_template_id_jha_hazard_templates_id_fk" FOREIGN KEY ("hazard_template_id") REFERENCES "public"."jha_hazard_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jha_signatures" ADD CONSTRAINT "jha_signatures_assessment_id_jha_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."jha_assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jha_signatures" ADD CONSTRAINT "jha_signatures_worker_id_employees_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jha_step_controls" ADD CONSTRAINT "jha_step_controls_step_id_jha_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."jha_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jha_step_controls" ADD CONSTRAINT "jha_step_controls_control_measure_template_id_jha_control_measure_templates_id_fk" FOREIGN KEY ("control_measure_template_id") REFERENCES "public"."jha_control_measure_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jha_steps" ADD CONSTRAINT "jha_steps_assessment_id_jha_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."jha_assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jha_steps" ADD CONSTRAINT "jha_steps_hazard_template_id_jha_hazard_templates_id_fk" FOREIGN KEY ("hazard_template_id") REFERENCES "public"."jha_hazard_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jha_steps" ADD CONSTRAINT "jha_steps_responsible_person_id_employees_id_fk" FOREIGN KEY ("responsible_person_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_diary_entries" ADD CONSTRAINT "job_diary_entries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_miss_actions" ADD CONSTRAINT "near_miss_actions_report_id_near_miss_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."near_miss_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_miss_actions" ADD CONSTRAINT "near_miss_actions_assigned_to_user_id_employees_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_miss_attachments" ADD CONSTRAINT "near_miss_attachments_report_id_near_miss_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."near_miss_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_miss_attachments" ADD CONSTRAINT "near_miss_attachments_uploaded_by_employees_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_miss_reports" ADD CONSTRAINT "near_miss_reports_reporter_user_id_employees_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_miss_reports" ADD CONSTRAINT "near_miss_reports_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_miss_witnesses" ADD CONSTRAINT "near_miss_witnesses_report_id_near_miss_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."near_miss_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_miss_witnesses" ADD CONSTRAINT "near_miss_witnesses_witness_user_id_employees_id_fk" FOREIGN KEY ("witness_user_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_outbound_messages" ADD CONSTRAINT "pending_outbound_messages_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_outbound_messages" ADD CONSTRAINT "pending_outbound_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_job_diary_entry_id_job_diary_entries_id_fk" FOREIGN KEY ("job_diary_entry_id") REFERENCES "public"."job_diary_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_proposal_section_id_proposal_sections_id_fk" FOREIGN KEY ("proposal_section_id") REFERENCES "public"."proposal_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_line_item_choices" ADD CONSTRAINT "proposal_line_item_choices_line_item_id_proposal_line_items_id_fk" FOREIGN KEY ("line_item_id") REFERENCES "public"."proposal_line_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ADD CONSTRAINT "proposal_line_items_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ADD CONSTRAINT "proposal_line_items_section_id_proposal_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."proposal_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ADD CONSTRAINT "proposal_line_items_selected_choice_id_proposal_line_item_choices_id_fk" FOREIGN KEY ("selected_choice_id") REFERENCES "public"."proposal_line_item_choices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_sections" ADD CONSTRAINT "proposal_sections_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_analytics" ADD CONSTRAINT "report_analytics_report_id_business_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."business_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_submissions" ADD CONSTRAINT "review_submissions_request_id_review_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."review_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_submissions" ADD CONSTRAINT "review_submissions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_submissions" ADD CONSTRAINT "review_submissions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_line_items" ADD CONSTRAINT "template_line_items_template_id_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_line_items" ADD CONSTRAINT "template_line_items_section_id_template_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."template_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_photos" ADD CONSTRAINT "template_photos_template_id_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_photos" ADD CONSTRAINT "template_photos_section_id_template_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."template_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_sections" ADD CONSTRAINT "template_sections_template_id_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_markers" ADD CONSTRAINT "tree_markers_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_inspections" ADD CONSTRAINT "vehicle_inspections_vehicle_id_equipment_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_inspections" ADD CONSTRAINT "vehicle_inspections_template_id_inspection_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."inspection_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_time_entries" ADD CONSTRAINT "job_time_entries_daily_entry_id_daily_time_entries_id_fk" FOREIGN KEY ("daily_entry_id") REFERENCES "public"."daily_time_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "call_records_job_id_idx" ON "call_records" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "call_records_customer_id_idx" ON "call_records" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "call_records_lead_id_idx" ON "call_records" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "call_records_from_number_idx" ON "call_records" USING btree ("from_number");--> statement-breakpoint
CREATE INDEX "call_records_to_number_idx" ON "call_records" USING btree ("to_number");--> statement-breakpoint
CREATE INDEX "call_records_created_at_idx" ON "call_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "customers_normalized_phone_idx" ON "customers" USING btree ("normalized_phone");--> statement-breakpoint
CREATE INDEX "tree_markers_job_id_idx" ON "tree_markers" USING btree ("job_id");