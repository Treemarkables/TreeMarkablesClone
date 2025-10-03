# Tree Removal Service Application

## Overview

This application is a comprehensive business management platform for Treemarkables, a New Zealand-based arborist company. It has evolved from a marketing website into a full-featured business dashboard providing advanced scheduling, job management, customer relationship tools, and operational analytics. Key capabilities include a ServiceM8-style dispatch board, crew and equipment management, invoice and quote generation, photo documentation, safety reporting, route optimization, performance analytics, and intelligent workflow automation. The system aims to streamline operations and enhance business efficiency for tree removal services.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript (Vite build tool)
- **Routing**: Wouter
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS (custom design system, professional orange/blue theme, light/dark mode)
- **State Management**: TanStack Query
- **Form Handling**: React Hook Form with Zod validation
- **Design System**: Mobile-first responsive design, Inter, Source Sans Pro, and Merriweather fonts. All pages fully optimized for mobile with responsive layouts preventing horizontal scrolling.

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **API**: RESTful API (`/api` prefix, `/api/mobile` for mobile endpoints)
- **Authentication**: Session-based (web) + API key with SHA-256 hashing (mobile)
- **File Storage**: Static file serving for audio recordings (`/uploads/recordings/`)
- **Development**: Hot module replacement (Vite middleware)
- **Storage Interface**: PostgreSQL with Drizzle ORM

### Data Layer
- **ORM**: Drizzle ORM (PostgreSQL)
- **Schema**: Type-safe definitions with Zod validation
- **Database**: PostgreSQL with indexed phone number matching (normalizedPhone column)
- **Migrations**: Drizzle Kit
- **Transactions**: Database transaction support for atomic multi-step operations

### Business Features
- **Job Dashboard**: Central hub at `/job-dashboard`.
- **Dispatch Board**: ServiceM8-style visual scheduling (6 AM - 7 PM, drag-and-drop, 15min-8hr increments).
- **ServiceM8-Style Job Creation**: Professional form with dynamic checklists, contact management, inline customer creation, and proper status handling.
- **Lead Management**: Pipeline tracking, scoring, and follow-up.
- **Customer Management**: Profiles, service history, communication logs.
- **Quote Management**: Generation, analytics, approval workflows.
- **Business Analytics**: Revenue, performance, service metrics, reporting.
- **Weather Integration**: Real-time data for job planning.
- **Crew Management**: Scheduling, skill tracking, certifications.
- **Equipment Tracking**: Asset management, maintenance, usage.
- **Invoice Management**: Generation, payment tracking, financial reporting.
- **Photo Documentation**: Before/after, visual progress.
- **Safety Reporting**: Incident tracking, protocols, risk assessments.
- **Route Optimization**: Efficient routing, travel time, fuel costs.
- **ServiceM8-Style Settings Interface**: Streamlined settings management with quick action shortcuts for Staff, Materials & Services, Job Categories, Company Info, Security & API, Notifications, Job Templates, Preferences.
- **Intelligent Process Automation**: Workflow system with intelligent job assignment, automated communications, and business process triggers.
- **Event-Driven Architecture**: Triggers on job creation, status changes, quote acceptance.
- **Workflow Management UI**: Dashboard at `/job-dashboard` → "Workflows" tab.
- **Job Diary System**: Comprehensive CRUD for diary entries (note, progress, issue, milestone, weather, equipment, safety, completion) with rich metadata and filtering.
- **Secure Password Authentication System**: Role-based (admin/crew) server-controlled session authentication with bcrypt hashing. Environment-aware login.
- **Email-to-Job-Diary Integration**: Email webhook intelligently routes customer replies with job/quote references directly to job diaries as "email" type entries.
- **Mobile App Integration**: Native mobile API with Bearer token authentication for call recording uploads, OpenAI Whisper transcription, customer phone matching, and automated job creation with diary logging. Includes comprehensive API documentation.
- **Progressive Web App (PWA)**: Full PWA support with swipeable photo carousel, pull-to-refresh functionality, and iPhone-optimized layouts. All pages (Job Dashboard, Analytics, Invoices, Integrations, Safety, Workflows) are fully responsive with no horizontal scrolling.
- **Xero Accounting Integration**: Custom Connection integration with Xero for automated invoice syncing (client credentials flow, $5-10 NZD/month subscription). Features include automatic token refresh, contact provisioning, GST handling, and real-time sync status tracking. Accessible via Integrations page and Invoices page with one-click "Send to Xero" functionality.

## External Dependencies

### Core Framework
- `@tanstack/react-query`
- `wouter`
- `react-hook-form`
- `@hookform/resolvers`

### UI & Styling
- `@radix-ui/*`
- `lucide-react`
- `class-variance-authority`
- `clsx`, `tailwind-merge`
- `tailwindcss`, `autoprefixer`
- Google Fonts (Inter, Source Sans Pro, Merriweather)

### Database & Validation
- `drizzle-orm`, `drizzle-kit`
- `@neondatabase/serverless` (PostgreSQL driver)
- `zod`, `drizzle-zod`

### Development Tools
- `vite`
- `tsx`
- `esbuild`
- `@replit/vite-plugin-*`

### Other Integrations
- SendGrid (for email webhooks)
- OpenAI (Whisper API for call transcription)
- Multer (audio file upload handling, 50 MB limit)
- Xero (`xero-node` SDK for accounting integration)