# Tree Removal Service Application

## Overview
This application is a comprehensive business management platform for Treemarkables, a New Zealand-based arborist company. It aims to streamline operations, enhance business efficiency, and support growth for tree removal services. Key capabilities include advanced scheduling, job management, customer relationship tools, operational analytics, and intelligent workflow automation, all designed to improve service delivery and business management.

## User Preferences
- Preferred communication style: Simple, everyday language.
- Currency: Always display prices in NZD (New Zealand Dollars), not USD.
- **Call flow (PERMANENT — never suggest alternatives)**: Customers call Julian's private 027 number ONLY. The carrier unconditionally forwards every call to the Twilio number. Twilio records, transcribes, and calls the 027 number back to connect the live call. Customers are never aware of Twilio and never interact with it directly. Never recommend giving customers a Twilio number. This is the only arrangement that will ever be used.

## System Architecture
### Core Design Principles
- **UI/UX**: Mobile-first responsive design with a professional orange/blue theme, supporting split-screen for larger displays.
- **Security**: Role-Based Access Control (RBAC), bcrypt for password hashing, and server-controlled session management.
- **Performance**: Optimized for mobile with API parallelization, image lazy loading, and thumbnail generation.
- **Workflow Automation**: Intelligent process automation, event-driven architecture, and a comprehensive job diary with a notification system.
- **Timezone Standard**: All date/time operations use Pacific/Auckland (NZ time) exclusively via shared/dateUtils.ts utilities for customer communications.

### Frontend
- **Framework**: React with TypeScript (Vite)
- **Routing**: Wouter
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (cross-device auto-sync, background polling, 5-second cache)
- **Form Handling**: React Hook Form with Zod validation
- **PWA Support**: Full Progressive Web App features.

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **API**: RESTful API (`/api`, `/api/mobile`)
- **Authentication**: Session-based (web) and API key with SHA-256 hashing (mobile).
- **File Storage**: Static file serving, with thumbnail generation.

### Data Layer
- **ORM**: Drizzle ORM for PostgreSQL
- **Schema**: Type-safe definitions with Zod validation
- **Database**: PostgreSQL with indexed phone number matching.
- **Migrations**: Drizzle Kit
- **Transactions**: Support for atomic multi-step operations.

### Key Features
- **Job Management**: Job Dashboard, ServiceM8-style Dispatch Board, dynamic checklists, duplicate job prevention, man-hours tracking, server-side deep search, multi-select staff time entry with auto-rate matching.
- **Customer & Sales**: Lead Management (with analytics), Customer Management, Quote Management (including speech-to-quote, Twilio voice auto-quote generation, and presentation method tracking for conversion analysis), Interactive Proposal Option Selection (customers can click to select pricing choices before accepting), VIP Membership system (manually assigned crown badge, member-since date, discount %, visible in customer list, job card, and ProposalBuilder). Invoice CC Email: customers have an optional `invoiceCcEmail` field (set in the Clients edit dialog) that is automatically pre-populated in the CC field when sending an invoice email via EmailComposerModal.
- **Communication Tracking**: Gmail email reply capture, SMS reply capture, automatic job diary entries for all customer communications.
- **Operational Efficiency**: Crew and Equipment Management, Route Optimization, Weather Integration, Photo Documentation, NZ timezone utilities.
- **Reporting & Analytics**: Business Analytics (lead source tracking, job estimation accuracy, quote presentation conversion rates), Invoice Management, Safety Reporting, Service-level margin tracking, Crew Efficiency reporting.
- **Marketing Automation**: Marketing Planner, automated review posting, campaign scheduling, performance analytics, Mailchimp integration for customer sync.
- **Push Notifications**: Firebase Cloud Messaging for real-time alerts (job assignments, schedule changes, new leads, invoice payments, quote acceptances) with user preference management.
- **Customer Notifications**: User-controlled job booking notifications via sendClientNotification checkbox.
- **System Settings**: ServiceM8-style Settings Interface for managing staff, materials, job categories.
- **Call Records**: Historical call record log viewable in the Communications tab, with linking to jobs and customers.
- **Mulch Drops**: Dedicated page for tracking mulch delivery orders (name, phone, address, drop-location notes, photos, status: Pending/Delivered/Cancelled). Includes "From Facebook" paste-and-extract flow using the AI extraction endpoint. Mobile-optimised card list with photo upload (camera capture), status toggle, and CRUD dialogs. Route: `/mulch-drops`. DB table: `mulch_drops`.
- **Dispatch Queue**: Jobs can be parked in a queue with a reason (Weather Hold, Awaiting Permit, Customer Not Ready, Awaiting Quote Approval, Materials Needed, Crew Unavailable, Other). Queue button (inbox icon) on every job card in DispatchBoard. "Queue" tab in the filter bar shows all queued jobs. Queued jobs show an amber badge with the reason. Schema fields: `inQueue boolean default false`, `queueReason text nullable` on the `jobs` table.
- **AI Smart Dispatch**: New page at `/ai-scheduler` (sidebar: "AI Smart Dispatch"). Owner selects a date, clicks "Generate Proposal" — GPT-4o analyses unscheduled work orders, available crew licences, and equipment licence requirements. Returns a schedule proposal with start/end times, crew assignments, equipment, licence match details, and conflict warnings. Confirm schedule → sets `scheduledDate`, `scheduledStartTime`, `scheduledEndTime`, `assignedTeam` on each job; creates draft customer confirmation messages in `pending_outbound_messages` and a notification. Re-propose available. Backend: `POST /api/scheduling/propose`, `POST /api/scheduling/confirm`, `GET /api/scheduling/revenue/:date`.
- **Equipment Register**: Settings card → `/settings/equipment-register`. View all equipment and set `licenceRequired` text field per item (NZ standard licences dropdown + custom). Used by AI Smart Dispatch to enforce crew qualification checks. Schema: `licence_required text` on `equipment` table.
- **Staff Licences & Tickets**: New "Licences & Tickets" section in Staff edit dialog (in StaffManagement.tsx). NZ-specific licence list (EWP, Class 2/4/5, Chainsaw Unit Standard, etc.) stored in `licences text[]` on `employees` table. Used by AI Smart Dispatch for crew-to-equipment matching.
- **Daily Revenue Target**: `dailyRevenueTarget decimal` on `business_settings` table (default $3,500 NZD). Set via Settings → Preferences. Drives the per-day revenue progress bar in the Dispatch Board job cards panel and the AI Smart Dispatch revenue target.
- **Revenue Progress Bar (Dispatch Board)**: Shows scheduled revenue vs daily target for the selected date in the job cards panel header. Amber when below target, green when at/above target. Fetches from `GET /api/scheduling/revenue/:date`.
- **Proactive Business Reminders**: Hourly background checker (`server/services/reminderChecker.ts`) creates notifications for: (1) Quotes sent 3+ days ago with no response, (2) Jobs scheduled tomorrow with no crew assigned, (3) Completed jobs not invoiced after 7+ days, (4) Leads with no activity for 24+ hours. De-duplicates by checking if same type+entity notification was already created in last 24h.
- **AI Chat Assistant**: Floating "Ask AI" button (bottom-right, visible to authenticated users on all pages). Opens a chat panel with `AIAssistantChat.tsx`. Backend agentic loop in `server/services/aiAssistant.ts` uses GPT-4o with function calling to query live business data (job counts, upcoming jobs, pending quotes, stale leads, uninvoiced jobs, revenue summary). Conversation history stored in `assistant_messages` DB table per session. Supports voice input via Whisper API. Route: `POST /api/assistant/chat`.
- **Visual Invoice Block Builder**: Settings card → `/settings/invoice-builder`. Full drag-and-drop invoice layout builder. Left panel: block palette (11 block types: Header, Company Info, Bill To, Invoice Details, Job Description, Line Items, Totals, Payment, Divider, Custom Text, Footer). Center: sortable canvas with live block previews, drag handles, show/hide toggles, and remove buttons. Right panel: Inspector with per-block-type configuration (logo alignment, column labels, colour pickers, toggles, etc.). Saves `block_config` JSONB to `document_templates` via `PUT /api/templates/:id`. Schema: `block_config jsonb` on `document_templates` table. Types: `InvoiceBlock`, `InvoiceBlockType`, `InvoiceBlockConfig*` in `shared/schema.ts`. Default layout: `DEFAULT_INVOICE_BLOCKS` constant.

## Auto-Save Architecture (GlobalJobCard)
The job form uses a multi-layered save system to ensure data is never silently lost:

### How Auto-Save Works
- `form.watch()` tracks field changes in `changedFieldsRef` (only auto-save-eligible fields)
- Changes are debounced 1.5 seconds then sent as a partial PUT to `/api/jobs/:id` (only changed fields)
- After a successful save, `form.reset(values, { keepValues: true })` advances the baseline so `isDirty` reflects changes since the last save, not since page load

### Email Field Protection (Multi-Layer Defense)
Fields like `jobContactEmail` and `billingContactEmail` have special protection at every layer:

1. **Client — handleSave create mode**: `formData.jobContactEmail` is only overwritten from `newCustomerEmail` if `newCustomerEmail` has a real value — prevents blanking the field when customer email is empty
2. **Client — createJobMutation.onSuccess**: Immediately populates the React Query cache with the full job response (including email) BEFORE switching to edit mode, so the form reset useEffect never sees undefined
3. **Client — cache optimistic update**: On auto-save success, `queryClient.setQueryData` updates the cache immediately with the saved values before `invalidateQueries` fires, preventing race conditions
4. **Client — loading window capture**: Field edits made during the 500ms form-load guard are tracked and saved via a deferred auto-save once the guard clears
5. **Client — auto-save failure**: Toast notification shown listing which fields weren't saved; `changedFieldsRef` preserved for retry
6. **Server — RC6 early guard**: In the PUT route, any empty `jobContactEmail` or `billingContactEmail` is stripped from `processedBody` BEFORE Zod validation, so Zod can never accidentally allow an empty value through
7. **Server — existing safeguard**: Post-validation check preserves non-empty DB values if the request tries to overwrite with empty (defense-in-depth)
8. **RC12 — Stable Form key**: `<Form key={jobId || createdJobId || internalMode}>` replaces the previous `key={editingJob?.id || internalMode}`. `editingJob?.id` can briefly go null during a React Query refetch cycle, toggling the key between "edit" and the UUID on every refetch, causing "Maximum update depth exceeded" for any job. The new key uses stable props/state that never change during the card's lifecycle.
9. **RC13 — ETA checkbox PUT storm fix**: Radix UI Checkbox dispatches synthetic click events on its hidden `<input>` element that bubble up through any parent `div onClick`, causing `handleToggle` to fire twice (once from `onCheckedChange`, once from the bubbled synthetic click). Removed `onClick` from the outer div wrapper and moved click handlers onto the Bell icon and label text (siblings of the Checkbox). Radix's internal events can't reach sibling handlers, so each user click triggers exactly one `handleToggle` call. Also removed the now-unnecessary `e.stopPropagation()` from the Checkbox's `onClick`.

### Proposal Email Extraction
`EmailComposerModal` receives `customEmail` prop with the live form value for `jobContactEmail`, so proposal/quote emails are always pre-populated from the most current form state, even if the cache is stale.

## External Dependencies
- **Database & Validation**: `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `zod`
- **Email**: Resend (for sending), Gmail IMAP (for receiving/reply capture), `imap`, `mailparser`
- **SMS**: SMS Everyone NZ
- **AI/ML**: OpenAI (Whisper API for transcription & GPT-5 for extraction)
- **Address Autocomplete**: Addy Solutions (NZ address API)
- **Telephony**: Twilio (call recording, Whisper transcription, Twilio Voice SDK for iOS CallKit). Call flow: customers ring the owner's personal mobile → carrier forwards to the Twilio number → Twilio records, transcribes, and optionally rings the iOS app via SDK. Customers never interact with Twilio directly.
- **Native iOS**: Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`) — `capacitor.config.ts` at project root; native Swift plugin in `ios-native/`; build guide in `IOS_BUILD_GUIDE.md`
- **Marketing**: Meta Marketing API (for Facebook/Instagram), Mailchimp Marketing API
- **Notifications**: Firebase Cloud Messaging
- **Timezone**: date-fns-tz