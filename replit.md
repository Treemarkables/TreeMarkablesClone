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
- **Design System**: Mobile-first responsive design, Inter, Source Sans Pro, and Merriweather fonts.

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **API**: RESTful API (`/api` prefix)
- **Development**: Hot module replacement (Vite middleware)
- **Storage Interface**: Abstracted layer with in-memory implementation (ready for database integration)

### Data Layer
- **ORM**: Drizzle ORM (PostgreSQL)
- **Schema**: Type-safe definitions with Zod validation
- **Database**: PostgreSQL (configured, currently using in-memory)
- **Migrations**: Drizzle Kit

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