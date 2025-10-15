# Tree Removal Service Application

## Overview
This application is a comprehensive business management platform for Treemarkables, a New Zealand-based arborist company. It provides advanced scheduling, job management, customer relationship tools, and operational analytics. The system aims to streamline operations and enhance business efficiency for tree removal services, supporting business growth and improved service delivery. Key capabilities include a ServiceM8-style dispatch board, crew and equipment management, invoice and quote generation, photo documentation, safety reporting, route optimization, performance analytics, and intelligent workflow automation.

## User Preferences
Preferred communication style: Simple, everyday language.

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
- **Job Management**: Job Dashboard, ServiceM8-style Dispatch Board, ServiceM8-style Job Creation with dynamic checklists.
- **Customer & Sales**: Lead Management (with analytics), Customer Management, Quote Management (including speech-to-quote and Twilio voice auto-quote generation).
- **Operational Efficiency**: Crew and Equipment Management, Route Optimization, Weather Integration, Photo Documentation.
- **Reporting & Analytics**: Business Analytics (including lead source tracking), Invoice Management (with Xero integration), Safety Reporting.
- **Marketing Automation**: Marketing Planner for Facebook/Instagram ad campaigns, automated review posting, campaign scheduling, and performance analytics dashboard.
- **Integrations**: Twilio Voice, OpenAI (Whisper transcription & GPT-5 extraction), Email-to-Job-Diary, Mobile App Integration, Xero Accounting, Addy.co.nz Address Autocomplete, SendGrid, SMS Everyone NZ, Facebook/Instagram Marketing API.
- **System Settings**: ServiceM8-style Settings Interface for managing staff, materials, job categories, etc.

## External Dependencies
- **UI & Styling**: `@radix-ui/*`, `lucide-react`, `tailwindcss`, Google Fonts
- **Database & Validation**: `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `zod`
- **Other Integrations**: SendGrid, SMS Everyone NZ, OpenAI (Whisper API), Multer, Xero (`xero-node` SDK), Addy Solutions (NZ address API), Twilio, Meta Marketing API (for Facebook/Instagram).