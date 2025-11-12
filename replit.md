# Tree Removal Service Application

## Overview
This application is a comprehensive business management platform for Treemarkables, a New Zealand-based arborist company. It provides advanced scheduling, job management, customer relationship tools, and operational analytics to streamline operations and enhance business efficiency for tree removal services. The system aims to support business growth and improve service delivery through features like a ServiceM8-style dispatch board, crew and equipment management, invoice and quote generation, photo documentation, safety reporting, route optimization, performance analytics, and intelligent workflow automation.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Core Design Principles
- **UI/UX**: Mobile-first responsive design with a professional orange/blue theme, optimized for mobile viewing. Features split-screen for larger displays.
- **Security**: Role-Based Access Control (RBAC), bcrypt for password hashing, and server-controlled session management.
- **Performance**: Optimized for mobile with API parallelization, image lazy loading, and thumbnail generation.
- **Workflow Automation**: Intelligent process automation, event-driven architecture, and a comprehensive job diary with a notification system.
- **Timezone Standard**: ALL date/time operations use Pacific/Auckland (NZ time) exclusively via shared/dateUtils.ts utilities (formatNZTime, utcToNZTime, nzTimeToUTC) for customer communications.

### Frontend
- **Framework**: React with TypeScript (Vite)
- **Routing**: Wouter
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (cross-device auto-sync, background polling, 5-second cache)
- **Form Handling**: React Hook Form with Zod validation
- **PWA Support**: Full Progressive Web App features, including mobile-optimized components.

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **API**: RESTful API (`/api`, `/api/mobile`)
- **Authentication**: Session-based (web) and API key with SHA-256 hashing (mobile).
- **File Storage**: Static file serving, with thumbnail generation for images.

### Data Layer
- **ORM**: Drizzle ORM for PostgreSQL
- **Schema**: Type-safe definitions with Zod validation
- **Database**: PostgreSQL with indexed phone number matching.
- **Migrations**: Drizzle Kit
- **Transactions**: Support for atomic multi-step operations.

### Key Features
- **Job Management**: Job Dashboard, ServiceM8-style Dispatch Board and Job Creation with dynamic checklists, duplicate job prevention, man-hours tracking, server-side deep search, multi-select staff time entry with auto-rate matching.
- **Customer & Sales**: Lead Management (with analytics), Customer Management, Quote Management (including speech-to-quote and Twilio voice auto-quote generation).
- **Communication Tracking**: Gmail email reply capture (IMAP polling every 5 minutes), SMS reply capture (polling every 60 seconds), automatic job diary entries for all customer communications.
- **Operational Efficiency**: Crew and Equipment Management, Route Optimization, Weather Integration, Photo Documentation, NZ timezone utilities.
- **Reporting & Analytics**: Business Analytics (lead source tracking, job estimation accuracy), Invoice Management, Safety Reporting.
- **Marketing Automation**: Marketing Planner for social media campaigns, automated review posting, campaign scheduling, performance analytics.
- **Push Notifications**: Firebase Cloud Messaging for real-time alerts (job assignments, schedule changes, new leads, invoice payments, quote acceptances), with user preference management.
- **Customer Notifications**: User-controlled job booking notifications via sendClientNotification checkbox - automatic triggers disabled to respect user preference.
- **System Settings**: ServiceM8-style Settings Interface for managing staff, materials, job categories.

## External Dependencies
- **Database & Validation**: `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `zod`
- **Email**: Resend (via Replit connector integration for sending), Gmail IMAP (for receiving/reply capture)
- **Email Parsing**: `imap`, `mailparser` (for Gmail IMAP email parsing)
- **SMS**: SMS Everyone NZ
- **AI/ML**: OpenAI (Whisper API for transcription & GPT-5 for extraction)
- **Accounting**: Xero (`xero-node` SDK)
- **Address Autocomplete**: Addy Solutions (NZ address API)
- **Telephony**: Twilio
- **Marketing**: Meta Marketing API (for Facebook/Instagram)
- **Notifications**: Firebase Cloud Messaging
- **Timezone**: date-fns-tz (for Pacific/Auckland conversions)

## Recent Changes (Nov 2025)
### Email Service Migration (12 Nov 2025)
- **BREAKING**: Migrated from SendGrid to Resend for transactional emails
- Removed SendGrid package (`@sendgrid/mail`) from dependencies
- Implemented Resend via Replit connector integration with automatic API key management
- Created `server/resendClient.ts` for uncacheable Resend client generation (follows Replit connector best practices)
- Updated `server/services/emailService.ts` to use Resend API while maintaining backward compatibility
- All email functionality (invoices, quotes, proposals, notifications) now uses Resend
- Reason for migration: SendGrid free trial expired and required 3-day identity verification wait
- **FIX (12 Nov 2025)**: Removed all hardcoded `from:` email addresses throughout codebase (server/index.ts, server/routes.ts) that were overriding the Resend connector configuration. Email service now correctly uses configured `from_email` from Resend integration (`info@updates.treemarkables.co.nz`) instead of hardcoded `info@treemarkables.co.nz`
- **SendGrid API Removal (12 Nov 2025)**: Disabled SendGrid Activity API endpoint that was causing errors after Resend migration. Endpoint now returns empty activity data instead of calling defunct SendGrid API. Note: Resend doesn't support email open/click tracking via API.

### Job-Specific Email Reply Capture - RESTORED (12 Nov 2025)
- **RESTORED**: Job-specific email reply-to addresses functionality that existed with SendGrid
- All job-related emails now use `job-{jobNumber}@jobs.treemarkables.co.nz` as reply-to address
- Customer replies automatically appear in job card diaries (NOT in user's personal inbox)
- **Architecture**:
  - Extended `EmailParams` interface with optional `jobNumber` field
  - Added `formatJobReplyAddress()` helper in emailService.ts
  - Updated all job-related email sending: proposals, invoices, quotes, employee notifications
  - Webhook endpoint (`/api/webhooks/email`) handles both SendGrid (legacy) and Resend inbound formats
  - Resend webhook fetches full email content via API (metadata-only in webhook payload)
  - Job number extracted from TO address pattern: `job-(\d+)@jobs.treemarkables.co.nz`
  - Automatic diary entry creation with notification for customer replies
- **DNS Setup Required**: User must configure Resend Inbound Email receiving domain `jobs.treemarkables.co.nz`:
  1. Add MX records pointing to Resend's inbound servers
  2. Configure Resend webhook URL: `https://{repl-url}/api/webhooks/email`
  3. Set `RESEND_WEBHOOK_SECRET` environment variable for signature verification
  4. Verify domain in Resend dashboard
- **Fallback**: Default reply-to remains `info@treemarkables.nz` for non-job emails

### Gmail Email Reply Capture (12 Nov 2025)
- **NEW FEATURE**: Automatic email reply capture via Gmail IMAP integration
- Created `server/services/gmailReplyService.ts` to fetch incoming customer email replies from Gmail inbox
- Created `server/services/emailReplyPoller.ts` for background polling (checks every 5 minutes)
- Email replies automatically matched to jobs by customer email address, added to job diary
- **Architecture**:
  - Uses Gmail App Password authentication with IMAP protocol (`imap`, `mailparser` packages)
  - Emails marked as "read" ONLY after successful database insert to prevent data loss
  - Duplicate prevention via Message-ID tracking in job diary metadata (JSONB query)
  - Filters out emails from treemarkables.co.nz/nz domains (outgoing emails)
  - Cleans email body text by removing quoted replies and signatures
  - Stores raw and cleaned body text for debugging
- **Polling Strategy**: 5-minute interval (vs 1-minute SMS polling) to avoid Gmail IMAP throttling
- **Job Matching**: Finds customer by email address → selects most recent job → creates diary entry
- Gmail credentials: `GMAIL_USER=accounts@treemarkables.nz`, `GMAIL_APP_PASSWORD` (secret)
- Known limitation: Matches to newest job only - multi-job customers may need subject-based job number parsing (future enhancement)

### Notification & Timezone Fixes
- **Critical**: Disabled automatic `job_scheduled` notifications in `automatedTriggers.ts` - customer notifications now ONLY send when user explicitly checks `sendClientNotification` checkbox in GlobalJobCard
- **Timezone standardization**: Updated all customer-facing date/time formatting in `notificationService.ts`, `emailService.ts`, and `smsService.ts` to use `formatNZTime()` utility from `shared/dateUtils.ts`
- **Multi-select time tracking**: RecordedTimeModal features popover-based staff selection with auto-rate matching by employee first name
- All email/SMS notifications to customers now explicitly show Pacific/Auckland timezone with "(NZ time)" label for clarity