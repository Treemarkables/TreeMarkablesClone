# Tree Removal Service Application

## Overview

This is a professional tree removal service website for Treemarkables, a New Zealand-based arborist company. The application provides a modern, responsive marketing website showcasing tree removal services with a focus on hazardous tree removal, emergency services, and precision cutting. The site includes comprehensive service information, process explanations, and contact functionality to generate leads for the business.

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

### Content Strategy
- **Static Assets**: Images served from public directory and attached_assets
- **SEO Optimization**: Comprehensive meta tags, structured headings, and semantic HTML
- **Content Structure**: Service-focused sections including hero, services, process, and contact forms
- **Lead Generation**: Multiple call-to-action points directing users to contact forms

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

The application is structured for easy scaling with a clear separation between frontend marketing content and backend API capabilities, ready for future enhancements like booking systems, customer portals, or service management features.