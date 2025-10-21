# Tree Removal Service Application

## Overview
This application is a comprehensive business management platform for Treemarkables, a New Zealand-based arborist company. It provides advanced scheduling, job management, customer relationship tools, and operational analytics to streamline operations and enhance business efficiency for tree removal services. Key capabilities include a ServiceM8-style dispatch board, crew and equipment management, invoice and quote generation, photo documentation, safety reporting, route optimization, performance analytics, and intelligent workflow automation. The system aims to support business growth and improve service delivery.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes
### October 21, 2025
- **Xero Job Status Workflow - FIXED**: Jobs now automatically transition from "work_order" to "completed" status when successfully sent to Xero. Previously, jobs remained in "work_order" status even after invoicing, requiring manual status updates. Updated `/api/xero/send-invoice` route to set `status: 'completed'` and `completedDate` upon successful Xero invoice creation. Also fixed Job #3360 which was stuck in "work_order" status despite being sent to Xero on October 20th.
- **Dispatch Board Loading Issue - FIXED**: Resolved issue where dispatch board showed empty job list on first click, requiring exit and re-enter to load. Root cause was missing loading gate in non-compact mode - component rendered before jobs data finished loading. Added loading and error state checks (similar to compact mode) that display skeleton loader until jobsData is available, preventing empty list render and improving error handling.
- **Description Textarea Auto-Expansion - FIXED**: Implemented auto-expanding description textarea in GlobalJobCard. The textarea now dynamically adjusts its height to show all content without internal scrolling, improving UX on mobile devices. Uses component-level ref (`descriptionTextareaRef`) and useEffect watching description value, with requestAnimationFrame for smooth height adjustment. Applied overflow-hidden and resize-none to prevent scrolling and manual resizing.

### October 20, 2025
- **Staff Schedule Timezone Bug - FIXED**: Resolved issue where staff schedule showed "0 jobs scheduled" despite having valid assignments. Root cause was timezone handling: database stores timestamps WITHOUT timezone (in NZ local time) but API returns them with 'Z' suffix. Fixed date comparison logic to extract just the date portion ("2025-10-20") from both assignment timestamps and selected date, avoiding UTC conversion that shifted dates by 13 hours during NZDT. Updated to query actual staff assignments from `staff_assignments` table via `/api/staff-assignments` endpoint (aligned with dispatch board).
- **Job Display Limit Increased - FIXED**: Increased job display limits to accommodate full job database (~3,000 jobs). Job Dashboard limit increased from 1,000 to 10,000 jobs, and Dispatch Board limit increased from 50 to 10,000 jobs. This ensures all jobs are visible in both views.
- **Create New Job Address Pre-Population Bug - FIXED**: Resolved issue where "Create New Job" form pre-filled address field with data from previously viewed job. Root cause was auto-populate effect running with stale customer data. Implemented `hasUserSelectedCustomer` flag that tracks explicit user selections versus residual state. Flag resets to false on form reset and sets to true only when user selects customer from dropdown, preventing unintended address population while preserving intentional auto-fill functionality.
- **Job Card Loading Race Condition - FIXED**: Resolved critical bug where job cards showed blank/incorrect data on first click. Root cause was form rendering before async job data loaded, displaying stale values from previous job. Implemented three-part fix: (1) **Loading Gate** - Updated loading check to gate on both `isLoadingSpecificJob` AND `!editingJob` to prevent form rendering until data exists, (2) **Form Key** - Added `key={editingJob?.id || internalMode}` to Form component to force remount and fresh state on each job selection, (3) **shouldUnregister** - Added `shouldUnregister: true` to useForm config to clear all stale values on unmount. Jobs now load correctly on first click without stale data. E2E tested: verified no blank fields or data carryover when switching between jobs.

## System Architecture
### Core Design Principles
- **UI/UX**: Mobile-first responsive design with a professional orange/blue theme, optimized for mobile viewing without horizontal scrolling. Split-screen layout for dispatch board on larger screens.
- **Security**: Role-Based Access Control (RBAC) and secure password authentication with bcrypt hashing and server-controlled session management.
- **Performance**: Optimized for fast loading on mobile through API parallelization, image lazy loading, and thumbnail generation.
- **Workflow Automation**: Intelligent process automation, event-driven architecture, and a comprehensive job diary system with a complete notification system.

### Frontend
- **Framework**: React with TypeScript (Vite)
- **Routing**: Wouter
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query with cross-device auto-sync, background polling, and 5-second cache window.
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
- **Job Management**: Job Dashboard, ServiceM8-style Dispatch Board, ServiceM8-style Job Creation with dynamic checklists, duplicate job prevention, man-hours tracking for job estimation accuracy, server-side deep search across all jobs and customer data.
- **Customer & Sales**: Lead Management (with analytics), Customer Management, Quote Management (including speech-to-quote and Twilio voice auto-quote generation).
- **Operational Efficiency**: Crew and Equipment Management, Route Optimization, Weather Integration, Photo Documentation, Timezone utility for correct scheduling display.
- **Reporting & Analytics**: Business Analytics (including lead source tracking and job estimation accuracy metrics), Invoice Management, Safety Reporting.
- **Marketing Automation**: Marketing Planner for Facebook/Instagram ad campaigns, automated review posting, campaign scheduling, and performance analytics dashboard.
- **Push Notifications**: Firebase Cloud Messaging infrastructure for real-time notifications (job assignments, schedule changes, new leads, invoice payments, quote acceptances), with user preference management.
- **System Settings**: ServiceM8-style Settings Interface for managing staff, materials, job categories, etc.

## External Dependencies
- **Database & Validation**: `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `zod`
- **Email**: SendGrid
- **SMS**: SMS Everyone NZ
- **AI/ML**: OpenAI (Whisper API for transcription & GPT-5 for extraction)
- **Accounting**: Xero (`xero-node` SDK)
- **Address Autocomplete**: Addy Solutions (NZ address API)
- **Telephony**: Twilio
- **Marketing**: Meta Marketing API (for Facebook/Instagram)
- **Notifications**: Firebase Cloud Messaging