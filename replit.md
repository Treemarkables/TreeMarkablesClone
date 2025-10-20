# Tree Removal Service Application

## Overview
This application is a comprehensive business management platform for Treemarkables, a New Zealand-based arborist company. It provides advanced scheduling, job management, customer relationship tools, and operational analytics to streamline operations and enhance business efficiency for tree removal services. Key capabilities include a ServiceM8-style dispatch board, crew and equipment management, invoice and quote generation, photo documentation, safety reporting, route optimization, performance analytics, and intelligent workflow automation. The system aims to support business growth and improve service delivery.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes
### October 20, 2025
- **Create New Job Address Pre-Population Bug - FIXED**: Resolved issue where "Create New Job" form pre-filled address field with data from previously viewed job. Root cause was auto-populate effect running with stale customer data. Implemented `hasUserSelectedCustomer` flag that tracks explicit user selections versus residual state. Flag resets to false on form reset and sets to true only when user selects customer from dropdown, preventing unintended address population while preserving intentional auto-fill functionality.
- **Job Card Loading Race Condition - FIXED**: Resolved issue where job cards opened blank on first click due to async data fetching. Added loading spinner that displays while specific job data loads from `/api/jobs/:id` endpoint (60-150ms). Extracted `isLoadingSpecificJob` from useQuery and added conditional rendering to prevent blank forms. Job details now populate immediately after data loads without requiring modal reopening.

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