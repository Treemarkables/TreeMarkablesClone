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

The application now serves as a complete business management platform with professional-grade features comparable to industry-standard field service management solutions. The system maintains consistent amber/orange branding throughout all interfaces and provides mobile-optimized experiences for field teams and office staff alike.