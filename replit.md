# Tree Removal Service Application

## Overview
This application is a comprehensive business management platform for Treemarkables, a New Zealand-based arborist company. It provides advanced scheduling, job management, customer relationship tools, and operational analytics. Key capabilities include a ServiceM8-style dispatch board, crew and equipment management, invoice and quote generation, photo documentation, safety reporting, route optimization, performance analytics, and intelligent workflow automation. The system aims to streamline operations and enhance business efficiency for tree removal services, supporting business growth and improved service delivery.

## Recent Changes (October 2025)
- **Invoice Portal Loading Fix**: Fixed invoice viewer page that was failing to load due to: (1) malformed API URL - query key was creating double slash in URL (`/api/invoices//id`), changed from array format to template string format for proper URL construction, (2) missing table imports - added `customers` and `jobs` imports to routes file to fix "ReferenceError: customers is not defined" error. Invoice portal now loads correctly for customers.
- **Invoice Link Fix (CRITICAL)**: Fixed broken invoice links in customer emails. Previously, invoice emails contained links to the job ID instead of the actual invoice ID, causing "Invoice Not Found" errors. The system was creating the invoice correctly but using the wrong variable when sending emails and saving diary entries. Now uses `emailBody` (which contains the updated invoice link) instead of `body` when sending emails and creating diary entries. Invoice links now work correctly for customer payments.
- **Invoice Address Fix**: Fixed invoice template to show current job address instead of outdated customer address. Added jobAddress prop to InvoiceTemplate component that prioritizes job location over customer's stored address. Updated GlobalJobCard and EmailComposerModal to pass job address when generating invoices. This ensures invoices display the actual service location rather than the customer's default address from their profile.
- **Conversation-to-Job Customer Name Fix**: Fixed bug where customer names weren't displaying when opening jobs created from conversations. The customerId was correctly saved in database, but UI wasn't showing it due to React not properly tracking customer data changes. Wrapped editingJobCustomer in useMemo() hook in GlobalJobCard component to ensure proper change detection. Now customer name displays immediately when opening jobs created from conversations instead of showing "Search or Create Client" placeholder.
- **Speech-to-Text Input**: Added voice input functionality across all text input modules (conversations, email composer, SMS composer). Users can now click microphone button and speak to add text instead of typing. Uses Web Speech API with custom MicrophoneButton component and useSpeechToText hook. Particularly useful for mobile users and quick message composition.
- **Mobile PWA Zoom Fix**: Fixed unwanted mobile zoom when typing in input fields (dispatch board search, forms, etc.). Mobile browsers auto-zoom on inputs with font sizes below 16px. Solution: (1) Added global CSS rule forcing all inputs/textareas/selects to 16px on mobile devices, (2) Updated dispatch board mobile search from text-xs to text-base, (3) Updated GlobalJobCard inputs to use responsive sizing (text-base on mobile, text-sm on desktop). No more zoom interruptions when typing on mobile PWA.
- **Proposal Job Address Display Fix**: Added job address display to public proposal viewer (ProposalAccept page). Backend now fetches job data in parallel with proposal data, frontend passes job address to ProposalTemplate component. Address displays with MapPin icon in "Proposal For" section with fallback logic (job address → customer address).
- **Email Sender & Proposal Number Fix**: Fixed two customer-facing email issues: (1) Changed email sender address from personal email (jullianhalley@hotmail.com) to business email (info@treemarkables.co.nz) across all email sending locations to prevent customers from replying to wrong address. (2) Fixed DRAFT proposal numbers appearing in customer emails - system now automatically converts DRAFT- numbers to PROP- numbers when sending proposals, preserving original identifier (e.g., DRAFT-12345 becomes PROP-12345). Updated server/services/emailService.ts, server/index.ts, and server/routes.ts.
- **Customer Link Security Fix (CRITICAL)**: Fixed security warnings on proposal/quote/invoice links sent to customers. Previously used development domain (*.replit.dev) which triggered browser/email warnings. Now all customer-facing links use production domain (app.treemarkables.co.nz) for trusted, secure access. Updated both server-side email generation (server/routes.ts) and client-side email composer (EmailComposerModal.tsx).
- **Time Tracking Persistence Fix**: Fixed critical bug where time entries were stored in-memory (Maps) instead of database, causing data loss on server restart. Refactored TimeTrackingService to use Drizzle ORM with proper db.insert/select/update/delete operations for daily_time_entries, job_time_entries, and staff_rates tables. Also fixed date range filtering to properly support single date (eq), date range (gte/lte), and upper-bound-only (lte) queries for accurate efficiency reports.
- **Proposal Description Field Fix**: Added visible "Proposal Overview" section with Introduction/Summary field to proposal builder. Previously, job descriptions were being set in form state but not displayed in UI. Now properly shows and saves proposal-level description, pre-filled from job description when creating proposals from jobs.
- **Invoice API Performance Optimization**: Optimized invoice viewer to load 3x faster by reducing from 3 sequential API calls (360ms) to 1 combined call (80-244ms). Backend now fetches customer and job data in parallel using Promise.all() and returns embedded data in single response.
- **Marketing Automation System**: Built comprehensive Facebook/Instagram marketing automation with Meta Marketing API integration. Features include automated ad campaign creation, scheduled review posting to Facebook, campaign performance analytics, and background scheduler (checks every 5 minutes) for automatic publishing. Marketing Planner page added to sidebar under Operations & Analysis. Setup requires FACEBOOK_PAGE_ACCESS_TOKEN, FACEBOOK_AD_ACCOUNT_ID, and FACEBOOK_PAGE_ID secrets.
- **Google & Facebook Reviews Integration**: Connected review widgets on all public pages (Home, Tree Removal, Tree Pruning, Stump Grinding, Hedge Trimming) to fetch real reviews from Google Places API and Facebook Graph API. Auto-syncs every 10 minutes with fallback to local testimonials. Setup requires 4 secrets: GOOGLE_PLACES_API_KEY, GOOGLE_PLACE_ID, FACEBOOK_PAGE_ACCESS_TOKEN, FACEBOOK_PAGE_ID. See `REVIEWS_SETUP_GUIDE.md` for complete instructions.
- **Metrics Dashboard UI Optimization**: Optimized header area - removed verbose title/description card, collapsed date filter into single compact line with inline buttons, significantly reduced vertical space usage for better data visibility.
- **Lead Source Analytics Fix**: Fixed lead source performance tracking database query error. Now properly displays lead source data with archived jobs excluded and invoiced jobs included in revenue calculations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Core Design Principles
- **UI/UX**: Mobile-first responsive design with a professional orange/blue theme. All pages are optimized for mobile, preventing horizontal scrolling.
- **Security**: Role-Based Access Control (RBAC) restricts access for crew/staff. Secure password authentication with bcrypt hashing and server-controlled session management.
- **Performance**: Optimized for fast loading, particularly on mobile, through API parallelization, image lazy loading, and thumbnail generation.
- **Workflow Automation**: Intelligent process automation, event-driven architecture, and a comprehensive job diary system with a complete notification system.

### Frontend
- **Framework**: React with TypeScript (Vite)
- **Routing**: Wouter
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Form Handling**: React Hook Form with Zod validation
- **PWA Support**: Full Progressive Web App features, including mobile-optimized components and safe-area padding for iOS.

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **API**: RESTful API (`/api`, `/api/mobile`)
- **Authentication**: Session-based (web) and API key with SHA-256 hashing (mobile).
- **File Storage**: Static file serving for audio recordings, with thumbnail generation for images.

### Data Layer
- **ORM**: Drizzle ORM for PostgreSQL
- **Schema**: Type-safe definitions with Zod validation
- **Database**: PostgreSQL with indexed phone number matching.
- **Migrations**: Drizzle Kit
- **Transactions**: Support for atomic multi-step operations.

### Key Features
- **Job Management**: Job Dashboard, ServiceM8-style Dispatch Board, ServiceM8-style Job Creation with dynamic checklists.
- **Customer & Sales**: Lead Management (with analytics), Customer Management, Quote Management (including speech-to-quote and Twilio voice auto-quote generation).
- **Operational Efficiency**: Crew and Equipment Management (with vehicle-specific inspection templates and pre-start inspection system), Route Optimization, Weather Integration, Photo Documentation.
- **Reporting & Analytics**: Business Analytics (including lead source tracking), Invoice Management (with Xero integration), Safety Reporting (Job Hazard Analysis system).
- **Marketing Automation**: Marketing Planner for Facebook/Instagram ad campaigns, automated review posting, campaign scheduling with background automation (5-minute checks), and performance analytics dashboard.
- **Integrations**: Twilio Voice (auto call recording, job creation & quote generation), OpenAI (Whisper transcription & GPT-5 extraction), Email-to-Job-Diary, Mobile App Integration, Xero Accounting Integration, Addy.co.nz Address Autocomplete, SendGrid (email tracking), SMS Everyone NZ, Facebook/Instagram Marketing API.
- **System Settings**: ServiceM8-style Settings Interface for managing staff, materials, job categories, etc.

## External Dependencies
- **UI & Styling**: `@radix-ui/*`, `lucide-react`, `tailwindcss`, Google Fonts
- **Database & Validation**: `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `zod`
- **Other Integrations**: SendGrid, SMS Everyone NZ, OpenAI (Whisper API), Multer, Xero (`xero-node` SDK), Addy Solutions (NZ address API), Twilio.