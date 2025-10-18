# Tree Removal Service Application

## Overview
This application is a comprehensive business management platform for Treemarkables, a New Zealand-based arborist company. It provides advanced scheduling, job management, customer relationship tools, and operational analytics. The system aims to streamline operations and enhance business efficiency for tree removal services, supporting business growth and improved service delivery. Key capabilities include a ServiceM8-style dispatch board, crew and equipment management, invoice and quote generation, photo documentation, safety reporting, route optimization, performance analytics, and intelligent workflow automation.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes
### October 18, 2025
- **Man-Hours Tracking System - COMPLETE**: Implemented comprehensive job estimation accuracy tracking to measure how accurately jobs are estimated. System automatically calculates estimated man-hours from staff assignments and actual man-hours from time tracking entries, then computes estimation accuracy as a percentage. Features include: database fields (`estimatedManHours`, `actualManHours`, `estimationAccuracy`, `estimationVariance`), calculation utilities in `shared/manHoursUtils.ts`, `manHoursService` for automatic updates, automatic integration with staff assignment and time tracking workflows, and Business Analytics dashboard section displaying overall accuracy percentage, accuracy distribution (Excellent/Good/Fair/Poor), total estimated vs actual hours, and over/under-estimation trends. Helps identify whether jobs are consistently over-estimated or under-estimated, enabling better future estimates and improved profitability.
- **Split-Screen Layout Implementation - COMPLETE**: Implemented fully functional split-screen layout in DispatchBoard with resizable panels (60%/40% default split). Desktop users (screens ≥1024px) can now view the dispatch board on the left and job details on the right simultaneously with an adjustable divider. Mobile users continue using the full-screen Dialog modal. Fixed critical issue where two GlobalJobCard instances were rendering simultaneously (desktop panel + mobile Dialog), preventing state updates. Solution: Wrapped mobile Dialog in `lg:hidden` wrapper to ensure only the appropriate component renders based on screen size. Users can resize panels, close job details with X button, and the left panel automatically expands to 100% when no job is selected.
- **Push Notification System - COMPLETE & TESTED**: Successfully built and tested complete Firebase Cloud Messaging infrastructure for real-time notifications. System includes: database schema (`fcm_tokens`, `notification_preferences`), storage methods, Firebase services (frontend/backend), service worker with retry logic and immediate initialization, API endpoints, and notification triggers. Notifications automatically sent for: job assignments, schedule changes, new leads, invoice payments, and quote acceptances. NotificationSettings UI (Settings → Notifications) allows users to enable notifications and manage preferences. Test notification feature confirmed working. Firebase credentials configured successfully. **Note**: Push notifications work on desktop browsers (Chrome, Firefox, Brave) but NOT on iOS (iPhone/iPad) due to Apple platform restrictions - iOS users should use desktop for notifications or rely on SMS/email alerts.
- **Timezone Fix - COMPLETE**: Fixed critical timezone bug where scheduled jobs were displaying incorrect times (10am showing as 11pm). Root cause was improper UTC conversion. Created timezone utility functions in `shared/dateUtils.ts` with three key functions: `nzTimeToUTC()` for saving user input to database, `utcToNZTime()` for converting database times for editing, and `formatNZTime()` for display. Updated DispatchBoard scheduling and Calendar display to properly convert between NZ local time and UTC. All times now display correctly in Pacific/Auckland timezone, and reminders will be sent at the correct local time.
- **Customer Name Extraction - COMPLETE**: Fixed conversation page "Create Job from Lead" dialog not extracting customer names. Added logic to derive names from email addresses when customer name is not available (e.g., "lyn.armstrong@hotmail.com" → "Lyn Armstrong"). Names are now properly capitalized and formatted.
- **Sidebar Mobile Collapse Fix - COMPLETE**: Fixed sidebar not collapsing on mobile when clicking navigation items. Root cause was using wrong state setter - shadcn Sidebar uses `openMobile`/`setOpenMobile` for mobile drawer behavior, not `open`/`setOpen`. Updated all navigation click handlers to use correct mobile state management.

### October 16, 2025
- **Default Landing Page Fix - COMPLETE**: Fixed all navigation routes to properly default to the dispatch board. After login, the app now correctly redirects to `/dispatch`. Both `/dashboard` and `/job-dashboard` now redirect to `/dispatch` for consistency. This ensures users always land on the dispatch board for faster daily workflow access, regardless of bookmarks or direct URLs.
- **Conversations Page - Action Menu Complete Fix**: The three dots menu button next to each conversation is now clearly visible with an outline border. Menu item changed from "Create New Quote" to "Create Job from Lead". Dialog now correctly shows "Create Job from Lead" title with "Create Job" button (previously showed "Create New Quote"). Contact details automatically pre-fill from conversation. All UI elements now consistently use "Job" terminology, making it easy to create jobs directly from leads on mobile devices.
- **Mobile UI Optimization - Conversations Page**: Enhanced the floating action button (FAB) for mobile devices. Button is now larger (64px × 64px), positioned higher to avoid iOS bottom bar interference, and includes a larger icon for easier touch interaction. The button now opens the create job dialog instead of showing a placeholder message.
- **Customer Data Persistence Fix**: Customer phone numbers now automatically sync from job contact information. When a job is created or updated with a contact phone, the system will update the customer's phone number if they don't have one. This ensures customer data stays complete and up-to-date.

## System Architecture
### Core Design Principles
- **UI/UX**: Mobile-first responsive design with a professional orange/blue theme, optimized for mobile viewing without horizontal scrolling.
- **Security**: Role-Based Access Control (RBAC) and secure password authentication with bcrypt hashing and server-controlled session management.
- **Performance**: Optimized for fast loading on mobile through API parallelization, image lazy loading, and thumbnail generation.
- **Workflow Automation**: Intelligent process automation, event-driven architecture, and a comprehensive job diary system with a complete notification system.

### Frontend
- **Framework**: React with TypeScript (Vite)
- **Routing**: Wouter
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query with cross-device auto-sync
  - `refetchOnWindowFocus: "always"` - Instant sync when switching between desktop/mobile tabs
  - `refetchInterval: 20000` - Background polling every 20 seconds for automatic updates
  - `staleTime: 5000` - 5-second cache window to prevent duplicate requests
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
- **Job Management**: Job Dashboard, ServiceM8-style Dispatch Board, ServiceM8-style Job Creation with dynamic checklists, duplicate job prevention (blocks same customer/address/description within 5 minutes), man-hours tracking for job estimation accuracy.
- **Customer & Sales**: Lead Management (with analytics), Customer Management, Quote Management (including speech-to-quote and Twilio voice auto-quote generation).
- **Operational Efficiency**: Crew and Equipment Management, Route Optimization, Weather Integration, Photo Documentation.
- **Reporting & Analytics**: Business Analytics (including lead source tracking and job estimation accuracy metrics), Invoice Management (with Xero integration), Safety Reporting.
- **Marketing Automation**: Marketing Planner for Facebook/Instagram ad campaigns, automated review posting, campaign scheduling, and performance analytics dashboard.
- **Push Notifications**: Firebase Cloud Messaging infrastructure with service worker, automatic notifications for job assignments/schedule changes/new leads, user preference management, and test notification capability.
- **Integrations**: Twilio Voice, OpenAI (Whisper transcription & GPT-5 extraction), Email-to-Job-Diary, Mobile App Integration, Xero Accounting, Addy.co.nz Address Autocomplete, SendGrid, SMS Everyone NZ, Facebook/Instagram Marketing API, Firebase Cloud Messaging.
- **System Settings**: ServiceM8-style Settings Interface for managing staff, materials, job categories, etc.

## External Dependencies
- **UI & Styling**: `@radix-ui/*`, `lucide-react`, `tailwindcss`, Google Fonts
- **Database & Validation**: `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `zod`
- **Other Integrations**: SendGrid, SMS Everyone NZ, OpenAI (Whisper API), Multer, Xero (`xero-node` SDK), Addy Solutions (NZ address API), Twilio, Meta Marketing API (for Facebook/Instagram).