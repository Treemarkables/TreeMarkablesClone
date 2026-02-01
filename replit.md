# Tree Removal Service Application

## Overview
This application is a comprehensive business management platform for Treemarkables, a New Zealand-based arborist company. It aims to streamline operations, enhance business efficiency, and support growth for tree removal services. Key capabilities include advanced scheduling, job management, customer relationship tools, operational analytics, and intelligent workflow automation, all designed to improve service delivery and business management.

## User Preferences
- Preferred communication style: Simple, everyday language.
- Currency: Always display prices in NZD (New Zealand Dollars), not USD.

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
- **Customer & Sales**: Lead Management (with analytics), Customer Management, Quote Management (including speech-to-quote, Twilio voice auto-quote generation, and presentation method tracking for conversion analysis).
- **Communication Tracking**: Gmail email reply capture, SMS reply capture, automatic job diary entries for all customer communications.
- **Operational Efficiency**: Crew and Equipment Management, Route Optimization, Weather Integration, Photo Documentation, NZ timezone utilities.
- **Reporting & Analytics**: Business Analytics (lead source tracking, job estimation accuracy, quote presentation conversion rates), Invoice Management, Safety Reporting, Service-level margin tracking, Crew Efficiency (Xero Payroll integration).
- **Marketing Automation**: Marketing Planner, automated review posting, campaign scheduling, performance analytics, Mailchimp integration for customer sync.
- **Push Notifications**: Firebase Cloud Messaging for real-time alerts (job assignments, schedule changes, new leads, invoice payments, quote acceptances) with user preference management.
- **Customer Notifications**: User-controlled job booking notifications via sendClientNotification checkbox.
- **System Settings**: ServiceM8-style Settings Interface for managing staff, materials, job categories.
- **Call Recording**: VoIP call recording with AI transcription via Hero Internet NZ, including sentiment analysis and call summaries, with auto-matching to customers/jobs and embedded audio players in job diary.

## External Dependencies
- **Database & Validation**: `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `zod`
- **Email**: Resend (for sending), Gmail IMAP (for receiving/reply capture), `imap`, `mailparser`
- **SMS**: SMS Everyone NZ
- **AI/ML**: OpenAI (Whisper API for transcription & GPT-5 for extraction)
- **Accounting**: Xero (`xero-node` SDK)
- **Address Autocomplete**: Addy Solutions (NZ address API)
- **Telephony**: Twilio, Hero Internet NZ
- **Marketing**: Meta Marketing API (for Facebook/Instagram), Mailchimp Marketing API
- **Notifications**: Firebase Cloud Messaging
- **Timezone**: date-fns-tz