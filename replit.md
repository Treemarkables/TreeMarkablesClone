# Tree Removal Service Application

## Overview

This is a comprehensive tree removal service business management application for Treemarkables, a New Zealand-based arborist company. The application has evolved from a marketing website into a full-featured business dashboard with advanced scheduling, job management, customer relationship tools, and operational analytics. The system includes a ServiceM8-style dispatch board for visual job scheduling, crew management, equipment tracking, invoice management, photo documentation, safety reporting, route optimization, and performance analytics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: Shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom design system following professional service industry standards
- **State Management**: TanStack Query for server state management
- **Form Handling**: React Hook Form with Zod validation

### Design System
- **Color Palette**: Professional orange/blue theme with both light and dark mode support
- **Typography**: Inter for headings, Source Sans Pro for body text, Merriweather for testimonials
- **Component Architecture**: Modular component structure with reusable UI components
- **Layout Strategy**: Mobile-first responsive design with max-width containers and consistent spacing

### Backend Architecture
- **Runtime**: Node.js with Express server
- **Language**: TypeScript throughout the stack
- **API Structure**: RESTful API design with `/api` prefix for all endpoints
- **Development**: Hot module replacement with Vite middleware integration
- **Storage Interface**: Abstracted storage layer with in-memory implementation (ready for database integration)

### Data Layer
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema**: Type-safe database schema definitions with Zod validation
- **Database**: PostgreSQL (configured but using in-memory storage currently)
- **Migrations**: Drizzle Kit for database migrations and schema management

### Business Features
- **Job Dashboard**: Central hub at `/job-dashboard` with comprehensive business management tools
- **Dispatch Board**: ServiceM8-style visual scheduling interface with time-grid (7 AM - 6 PM), staff roster, job assignments, and drag-and-drop scheduling capabilities
- **ServiceM8-Style Job Creation**: Professional job creation form with orange header design, comprehensive job details, dynamic checklist functionality, contact management, and seamless integration with dispatch boards - fully validates and creates jobs with proper status enum handling. Features inline customer creation allowing users to add new customers directly within the job form instead of being restricted to existing customer dropdown selection
- **Lead Management**: Pipeline tracking, lead scoring, conversion funnels, and automated follow-up systems
- **Customer Management**: Complete customer profiles, service history, communication logs, and relationship tracking
- **Quote Management**: Professional quote generation, analytics, approval workflows, and conversion tracking
- **Business Analytics**: Revenue tracking, performance metrics, service analytics, and comprehensive reporting
- **Weather Integration**: Real-time weather data for job planning and safety considerations
- **Crew Management**: Staff scheduling, skill tracking, certification management, and performance monitoring
- **Equipment Tracking**: Asset management, maintenance schedules, usage tracking, and availability status
- **Invoice Management**: Professional invoice generation, payment tracking, and financial reporting
- **Photo Documentation**: Job documentation, before/after photos, and visual progress tracking
- **Safety Reporting**: Incident tracking, safety protocols, risk assessments, and compliance monitoring
- **Route Optimization**: Efficient job routing, travel time calculation, and fuel cost optimization
- **ServiceM8-Style Settings Interface**: Simplified settings management with clean grid layout featuring 8 essential business setting cards (Staff, Materials & Services, Job Categories, Company Info, Security & API, Notifications, Job Templates, Preferences) - removed complex enterprise features (addons, automations, external calendars, custom fields) for streamlined user experience with quick action shortcuts. All setting cards link to appropriate placeholder pages preventing 404 errors

## External Dependencies

### Core Framework Dependencies
- **@tanstack/react-query**: Server state management and API caching
- **wouter**: Lightweight routing library
- **react-hook-form**: Form state management and validation
- **@hookform/resolvers**: Zod integration for form validation

### UI Component Libraries
- **@radix-ui/***: Comprehensive set of accessible UI primitives (accordion, dialog, dropdown, etc.)
- **lucide-react**: Icon library for consistent iconography
- **class-variance-authority**: Type-safe CSS class variant management
- **clsx & tailwind-merge**: Conditional CSS class handling

### Database & Validation
- **drizzle-orm & drizzle-kit**: Type-safe ORM and migration tools
- **@neondatabase/serverless**: PostgreSQL database driver
- **zod**: Runtime type validation and schema definition
- **drizzle-zod**: Integration between Drizzle schemas and Zod validation

### Development Tools
- **vite**: Fast build tool and development server
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production builds
- **@replit/vite-plugin-***: Replit-specific development enhancements

### Styling & Fonts
- **tailwindcss**: Utility-first CSS framework
- **autoprefixer**: CSS vendor prefixing
- **Google Fonts**: Inter, Source Sans Pro, and Merriweather font families

### Advanced Workflow Automation System (Latest Addition)
- **Intelligent Process Automation**: Complete workflow automation system with intelligent job assignment, automated communications, and business process triggers
- **Event-Driven Architecture**: Automatically triggers on real business events (job creation, status changes, quote acceptance) through integration with existing AutomatedTriggers service
- **Workflow Management UI**: Comprehensive dashboard at `/job-dashboard` → "Workflows" tab with real-time statistics, workflow rule management, trigger testing, and mobile-optimized interface
- **API Integration**: RESTful endpoints for complete workflow CRUD operations (`/api/workflows`, `/api/workflows/:id/toggle`, `/api/workflows/trigger`) with enhanced validation
- **Business Logic**: Pre-configured workflows for emergency job handling, invoice generation, customer follow-up scheduling, and intelligent crew assignment based on availability and skills
- **Real-time Operations**: Background processing for automated assignment, notification delivery, and scheduling with comprehensive logging and error handling
- **Integration Architecture**: Seamlessly integrated with existing notification service, storage interface, and business logic without disrupting current operations

### Job Diary System
- **Comprehensive Diary Management**: Complete CRUD operations for job diary entries with rich metadata support
- **Entry Types**: Multiple entry categories (note, progress, issue, milestone, weather, equipment, safety, completion) with color-coded UI
- **Advanced Features**: Private entries, filtering by type, progress tracking, weather documentation, equipment logging, time tracking
- **API Integration**: RESTful endpoints for diary management (`/api/jobs/:jobId/diary`, `/api/diary/:id`) with proper validation
- **UI Components**: Modal dialog integration, timeline view, rich form inputs, delete confirmation, responsive design
- **Real-time Updates**: Automatic cache invalidation and UI updates using TanStack Query
- **Data Persistence**: Proper storage interface with in-memory implementation ready for database scaling

The application now serves as a complete business management platform with professional-grade features comparable to industry-standard field service management solutions. The system features a vibrant, colorful design system with emerald, purple, orange, yellow, and teal color schemes that enhance user experience and visual appeal.

### ServiceM8-Style Job Card Implementation (September 2025)
- **Complete ServiceM8 Integration**: Successfully implemented professional ServiceM8-style job card modal with clean white header design
- **ServiceM8HeaderToolbar**: Complete action toolbar with Email, SMS, Call, Schedule, Queue, Form, Proposal, Profit, and More dropdown
- **Functional Scheduling**: Full scheduling modal with date/time selection, staff assignment, and notes - integrated with job status management
- **Professional Design**: Replaced orange gradient header with clean ServiceM8-style white header for professional appearance
- **Enhanced Business Logic**: Updated job status enum to include 'scheduled' status for proper job lifecycle management
- **Complete Integration**: All ServiceM8 functionality working including invoice creation, email composers, SMS composers, and proposal builders
- **Customer Avatars**: Professional customer avatar display in jobs panel with fallback initials
- **ServiceM8ActivityFeed**: Ready-to-use activity feed component for future two-column layout implementation

### Recent UI Enhancements (September 2025)
- **Vibrant Color System**: Enhanced the design with a comprehensive color palette including emerald green, purple, orange, yellow, teal, and pink gradients
- **Email Composer Enhancement**: Updated EmailComposerModal with green gradient header theme to match the "Send Invoice" action
- **SMS Invoice Functionality**: Complete SMS composer with purple/pink gradient theme, character counter (160 limit), and pre-populated invoice messaging
- **Colorful Dropdown Actions**: Invoice action dropdown now features color-coded icons (green for Send Invoice, purple for SMS Invoice, yellow for Auto Invoice, orange for Partial Invoice, teal for Customise Invoice, blue for Add Payment)
- **Enhanced Communication Modals**: Both email and SMS modals feature vibrant gradient headers with white text overlays and improved visual hierarchy