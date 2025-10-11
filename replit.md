# Tree Removal Service Application

## Overview
This application is a comprehensive business management platform for Treemarkables, a New Zealand-based arborist company. It has evolved into a full-featured business dashboard providing advanced scheduling, job management, customer relationship tools, and operational analytics. Key capabilities include a ServiceM8-style dispatch board, crew and equipment management, invoice and quote generation, photo documentation, safety reporting, route optimization, performance analytics, and intelligent workflow automation. The system aims to streamline operations and enhance business efficiency for tree removal services.

## Recent Changes (October 2025)
- **Job Hazard Analysis (JHA) System**: Implemented comprehensive pre-job risk assessment feature with customizable hazard templates, 1-5 risk rating scale, control measure checklists, multiple worker digital signatures, and structured summary generation. Accessible from Safety tab with template management via /settings/jha-templates. Includes hazard assessment workflow, signature capture, and complete assessment history with detailed reports.
- **Vehicle-Specific Inspection Templates**: Added ability to assign a default inspection template to each vehicle/equipment. When a vehicle has an assigned template, the inspection form automatically loads it without requiring manual template selection. Equipment management page now includes "Default Inspection Template" dropdown for easy assignment.
- **Double Login Authentication Fix**: Resolved race condition in AuthContext where login would require entering credentials twice. Fixed by setting query data directly after login instead of invalidating, preventing authentication mismatch detection during query refetch.
- **Vehicle Inspection System**: Implemented complete pre-start vehicle inspection feature with customizable checklists, YES/NO/N/A responses, photo capture, signature pad, registration/COF reminders, and inspection history tracking. Mobile-optimized PWA interface saves inspector names (firstName + lastName), vehicle details, and pass/fail status.
- **iOS PWA Tap-to-Record Fix**: Successfully fixed speech-to-quote recording on iOS Safari by implementing flexible MediaRecorder initialization with multiple format fallbacks. Solution checks for basic MediaRecorder support rather than specific MIME types (which iOS doesn't always report), tries audio/mp4, webm;codecs=opus, and webm in order, and gracefully falls back to browser default if options fail. Includes high-quality 128kbps recording with 48kHz sample rate, echo cancellation, and noise suppression for accurate transcription.
- **Voice-to-Text File Extension Fix**: Fixed speech-to-quote feature by updating Multer configuration to save audio files with proper extensions (.webm, .mp3, .m4a, etc.) based on MIME type. This resolves OpenAI Whisper API errors when transcribing browser-recorded audio.
- **Lead Source Analytics**: Added comprehensive lead source performance tracking in MetricsDashboard with conversion rates, profit margins, revenue analysis, and CSV export. Tracks performance across all lead sources (website, phone, referral, repeat, google, facebook, etc.) with date range filtering.
- **Diary Chat Bubble Width Update**: Increased message bubble width from 24-35% to 90% to better utilize the full width of the diary panel for improved readability.
- **Speech-to-Quote Feature**: Implemented voice-powered quote creation with browser MediaRecorder API and iOS file upload workaround. Users can record job details verbally, which are transcribed with OpenAI Whisper and auto-extracted into structured quote data using GPT-5. Features include:
  - Direct browser recording on Android/desktop devices using MediaRecorder API
  - iOS workaround: Upload Voice Memo recordings (m4a, mp3, wav, webm files up to 25MB)
  - Automatic device detection and UI adaptation for optimal user experience
  - Proper resource cleanup (MediaRecorder, streams, timers) on modal close
  - Secure server-side audio file handling with automatic cleanup
  - Filename preservation for uploaded files to ensure correct transcription processing
  - Integrated into GlobalJobCard for easy access from any job
- **Mobile App Speech-to-Quote API**: Added native endpoint `/api/mobile/speech-to-quote` for mobile app integration with API key authentication. Enables on-site quote creation through native device recording with full audio format support.
- **Twilio Voice Auto-Quote Generation**: Extended Twilio voice webhook to automatically generate quote drafts when pricing is discussed in customer calls. System detects pricing keywords ("price", "cost", "quote") or actual dollar amounts, uses GPT-5 to extract line items, and creates draft proposals linked to auto-created jobs. See TWILIO_VOICE_SETUP.md for details.
- **Twilio Voice Call Recording & Auto Job Creation**: Implemented automatic call recording system that transcribes calls with OpenAI Whisper, extracts job details with GPT-5, and auto-creates customers and jobs. Includes Twilio signature validation for webhook security. See TWILIO_VOICE_SETUP.md for configuration.
- **Email Diary Display Fixes**: Fixed two critical email diary issues:
  1. Added cache invalidation to EmailComposerModal so sent emails appear immediately in job diary
  2. Fixed extractDocumentInfo() to only detect invoice emails when explicitly "Invoice sent" (not just mentioning "invoice" in subject)
- **Invoices Page Clean Slate**: Archived 1,901 old completed jobs by changing status to 'archived' to provide clean invoices page. Only newly completed jobs will appear going forward.
- **Dispatch Board Job Sorting Fix**: Fixed job display order to show newest jobs first (descending by job number). Previously, jobs with recent activity were prioritized over newest jobs, causing new jobs to be hidden outside the 30-job display limit.
- **Profit Tracker Revenue Fix**: Fixed Profit Tracker to correctly pull revenue from proposal billing. Added missing `inArray` import in storage.ts and fixed proposals query to properly fetch sections with `includeSections=true` parameter.
- **SMS Everyone NZ Integration**: Replaced Twilio SMS with SMS Everyone NZ for local New Zealand SMS delivery. Offers 10c per SMS, no contracts, NZ-based support, and 2-way messaging.
- **Mobile PWA Safe Area Fix**: Added safe-area padding to mobile PWA to prevent iPhone notch/status bar from covering top content.
- **Email Activity Tracking**: Integrated SendGrid email tracking to monitor opens and clicks on proposals, quotes, and invoices sent to customers. Activity data is displayed inline with job diary entries.
- **Diary Entry Optimization**: Modified proposal/quote/invoice workflow to prevent duplicate diary entries. Now only creates diary entries when documents are SENT (via email/SMS), not when saved as drafts.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Core Design Principles
- **UI/UX**: Mobile-first responsive design with a professional orange/blue theme. All pages are optimized for mobile, preventing horizontal scrolling.
- **Security**: Role-Based Access Control (RBAC) restricts access for crew/staff. Secure password authentication with bcrypt hashing and server-controlled session management.
- **Performance**: Optimized for fast loading, particularly on mobile, through API parallelization, image lazy loading, and thumbnail generation.
- **Workflow Automation**: Intelligent process automation, event-driven architecture, and a comprehensive job diary system.

### Frontend
- **Framework**: React with TypeScript (Vite)
- **Routing**: Wouter
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Form Handling**: React Hook Form with Zod validation
- **PWA Support**: Full Progressive Web App features including swipeable photo carousel and pull-to-refresh.

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **API**: RESTful API (`/api`, `/api/mobile`)
- **Authentication**: Session-based (web) and API key with SHA-256 hashing (mobile).
- **File Storage**: Static file serving for audio recordings, with a new thumbnail generation system for images.

### Data Layer
- **ORM**: Drizzle ORM for PostgreSQL
- **Schema**: Type-safe definitions with Zod validation
- **Database**: PostgreSQL with indexed phone number matching.
- **Migrations**: Drizzle Kit
- **Transactions**: Support for atomic multi-step operations.

### Key Features
- **Job Management**: Job Dashboard, ServiceM8-style Dispatch Board, ServiceM8-style Job Creation with dynamic checklists.
- **Customer & Sales**: Lead Management, Customer Management, Quote Management.
- **Operational Efficiency**: Crew and Equipment Management, Route Optimization, Weather Integration, Photo Documentation.
- **Reporting & Analytics**: Business Analytics, Invoice Management, Safety Reporting.
- **Integrations**: Twilio Voice (auto call recording, job creation & quote generation), OpenAI (Whisper transcription & GPT-5 extraction for speech-to-quote and call analysis), Email-to-Job-Diary, Mobile App Integration (call recording uploads, transcription, native speech-to-quote), Xero Accounting Integration, Addy.co.nz Address Autocomplete.
- **System Settings**: ServiceM8-style Settings Interface for managing staff, materials, job categories, etc.

## External Dependencies
- **Core Framework**: `@tanstack/react-query`, `wouter`, `react-hook-form`, `@hookform/resolvers`
- **UI & Styling**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss`, `autoprefixer`, Google Fonts
- **Database & Validation**: `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `zod`, `drizzle-zod`
- **Development Tools**: `vite`, `tsx`, `esbuild`, `@replit/vite-plugin-*`
- **Other Integrations**: SendGrid, SMS Everyone NZ, OpenAI (Whisper API), Multer, Xero (`xero-node` SDK), Addy Solutions (NZ address API)