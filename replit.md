# Tree Removal Service Application

## Overview
This application is a comprehensive business management platform for Treemarkables, a New Zealand-based arborist company. It has evolved into a full-featured business dashboard providing advanced scheduling, job management, customer relationship tools, and operational analytics. Key capabilities include a ServiceM8-style dispatch board, crew and equipment management, invoice and quote generation, photo documentation, safety reporting, route optimization, performance analytics, and intelligent workflow automation. The system aims to streamline operations and enhance business efficiency for tree removal services.

## Recent Changes (October 2025)
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
- **Integrations**: Email-to-Job-Diary, Mobile App Integration (call recording uploads, transcription), Xero Accounting Integration, Addy.co.nz Address Autocomplete.
- **System Settings**: ServiceM8-style Settings Interface for managing staff, materials, job categories, etc.

## External Dependencies
- **Core Framework**: `@tanstack/react-query`, `wouter`, `react-hook-form`, `@hookform/resolvers`
- **UI & Styling**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss`, `autoprefixer`, Google Fonts
- **Database & Validation**: `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `zod`, `drizzle-zod`
- **Development Tools**: `vite`, `tsx`, `esbuild`, `@replit/vite-plugin-*`
- **Other Integrations**: SendGrid, SMS Everyone NZ, OpenAI (Whisper API), Multer, Xero (`xero-node` SDK), Addy Solutions (NZ address API)