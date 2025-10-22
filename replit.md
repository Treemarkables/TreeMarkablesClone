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
- **Job Management**: Job Dashboard, ServiceM8-style Dispatch Board and Job Creation with dynamic checklists, duplicate job prevention, man-hours tracking, server-side deep search.
- **Customer & Sales**: Lead Management (with analytics), Customer Management, Quote Management (including speech-to-quote and Twilio voice auto-quote generation).
- **Operational Efficiency**: Crew and Equipment Management, Route Optimization, Weather Integration, Photo Documentation, Timezone utility.
- **Reporting & Analytics**: Business Analytics (lead source tracking, job estimation accuracy), Invoice Management, Safety Reporting.
- **Marketing Automation**: Marketing Planner for social media campaigns, automated review posting, campaign scheduling, performance analytics.
- **Push Notifications**: Firebase Cloud Messaging for real-time alerts (job assignments, schedule changes, new leads, invoice payments, quote acceptances), with user preference management.
- **System Settings**: ServiceM8-style Settings Interface for managing staff, materials, job categories.

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