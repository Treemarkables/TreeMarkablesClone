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
- **Timezone Standard**: All date/time operations use Pacific/Auckland (NZ time) exclusively.

### Frontend
- **Framework**: React with TypeScript (Vite)
- **UI Components**: Shadcn/ui (Radix UI primitives), Tailwind CSS
- **State Management**: TanStack Query (cross-device auto-sync, background polling, 5-second cache)
- **Form Handling**: React Hook Form with Zod validation
- **PWA Support**: Full Progressive Web App features.

### Backend
- **Runtime**: Node.js with Express and TypeScript
- **API**: RESTful API (`/api`, `/api/mobile`)
- **Authentication**: Session-based (web) and API key with SHA-256 hashing (mobile).
- **File Storage**: Static file serving with thumbnail generation.

### Data Layer
- **ORM**: Drizzle ORM for PostgreSQL
- **Schema**: Type-safe definitions with Zod validation
- **Database**: PostgreSQL with indexed phone number matching.
- **Migrations**: Drizzle Kit

### Key Features
- **Job Management**: Job Dashboard, ServiceM8-style Dispatch Board, dynamic checklists, man-hours tracking, server-side deep search, multi-select staff time entry.
- **Customer & Sales**: Lead Management, Customer Management, Quote Management (including speech-to-quote, Twilio voice auto-quote generation, interactive proposal option selection), VIP Membership system. Invoice CC Email functionality.
- **Communication Tracking**: Gmail/SMS reply capture, automatic job diary entries for customer communications.
- **Operational Efficiency**: Crew and Equipment Management, Route Optimization, Weather Integration, Photo Documentation.
- **Reporting & Analytics**: Business Analytics (lead source tracking, job estimation accuracy, quote presentation conversion rates), Invoice Management, Safety Reporting, Service-level margin tracking, Crew Efficiency reporting.
- **Marketing Automation**: Marketing Planner, automated review posting, campaign scheduling, Mailchimp integration.
- **Push Notifications**: Firebase Cloud Messaging for real-time alerts.
- **Call Records**: Historical call record log linked to jobs and customers.
- **Mulch Drops**: Dedicated page for tracking mulch delivery orders with AI extraction for "From Facebook" pastes.
- **Gantt Day View**: Horizontal Gantt timeline per crew member in CalendarGrid day view, with an "Unassigned" swim lane for drag-and-drop scheduling.
- **Dispatch Queue**: Jobs can be parked in a queue with reasons (e.g., Weather Hold, Awaiting Permit).
- **AI Smart Dispatch**: AI-powered scheduling proposal generation considering unscheduled work, crew licenses, and equipment requirements.
- **Equipment Register**: Management of equipment with required licenses.
- **Staff Licences & Tickets**: Staff profiles include NZ-specific licenses for AI matching.
- **Daily Revenue Target**: Configurable daily revenue target displayed in the Dispatch Board.
- **Proactive Business Reminders**: Hourly reminders for pending quotes, unassigned jobs, uninvoiced jobs, and stale leads.
- **AI Chat Assistant**: Floating chat assistant using GPT-4o with function calling to query live business data and voice input.
- **Visual Invoice Block Builder**: Drag-and-drop interface for customizing invoice layouts.
- **Near Miss Reporting**: Full near-miss incident capture flow with multi-step wizard (incident details, controls & factors, corrective actions, witness sign-off), SVG signature canvas, severity/status tracking, PDF export, and automatic 30-day effectiveness review reminders. Routes: `/near-miss-report`, `/near-miss-history`.

## External Dependencies
- **Database & Validation**: `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `zod`
- **Email**: Resend (sending), Gmail IMAP (receiving/reply capture)
- **SMS**: SMS Everyone NZ
- **AI/ML**: OpenAI (Whisper API for transcription & GPT-5 for extraction)
- **Address Autocomplete**: Addy Solutions (NZ address API)
- **Telephony**: Twilio (call recording, Whisper transcription, Twilio Voice SDK for iOS CallKit)
- **Native iOS**: Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`)
- **Marketing**: Meta Marketing API (Facebook/Instagram), Mailchimp Marketing API
- **Notifications**: Firebase Cloud Messaging
- **Timezone**: date-fns-tz