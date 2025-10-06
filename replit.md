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
- **Design System**: Mobile-first responsive design, Inter, Source Sans Pro, and Merriweather fonts. All pages fully optimized for mobile with responsive layouts preventing horizontal scrolling.

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **API**: RESTful API (`/api` prefix, `/api/mobile` for mobile endpoints)
- **Authentication**: Session-based (web) + API key with SHA-256 hashing (mobile)
- **File Storage**: Static file serving for audio recordings (`/uploads/recordings/`)
- **Development**: Hot module replacement (Vite middleware)
- **Storage Interface**: PostgreSQL with Drizzle ORM

### Data Layer
- **ORM**: Drizzle ORM (PostgreSQL)
- **Schema**: Type-safe definitions with Zod validation
- **Database**: PostgreSQL with indexed phone number matching (normalizedPhone column)
- **Migrations**: Drizzle Kit
- **Transactions**: Database transaction support for atomic multi-step operations

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
- **Mobile App Integration**: Native mobile API with Bearer token authentication for call recording uploads, OpenAI Whisper transcription, customer phone matching, and automated job creation with diary logging. Includes comprehensive API documentation.
- **Progressive Web App (PWA)**: Full PWA support with swipeable photo carousel, pull-to-refresh functionality, and iPhone-optimized layouts. All pages (Job Dashboard, Analytics, Invoices, Integrations, Safety, Workflows) are fully responsive with no horizontal scrolling.
- **Xero Accounting Integration**: Custom Connection integration with Xero for automated invoice syncing (client credentials flow, $5-10 NZD/month subscription). Features include automatic token refresh, contact provisioning, GST handling, and real-time sync status tracking. Accessible via Integrations page and Invoices page with one-click "Send to Xero" functionality.
- **Addy.co.nz Address Autocomplete**: Real-time New Zealand address validation and autocomplete using Addy Solutions API. Features fuzzy matching for typos, official NZ Postal Address File (PAF) and LINZ database validation, and intelligent address parsing. Integrated into job creation forms via AddressAutocomplete component with debounced search and mock data fallback.
- **Role-Based Access Control (RBAC)**: Complete role-based access control system restricting crew/staff access. Crew users can access: All Jobs page (view only, cannot delete contacts), Job Dashboard page (jobs and safety tabs only), Dispatch Board, and Safety page. Admin users have full access to all features and pages. Implemented with client-side route guards and server-side middleware.

## Critical Architecture Notes

### Scrolling Fix (AuthContext)
**Issue**: Pages were not scrolling because `AuthContext.tsx` wrapped the entire app with `h-screen` and `overflow-hidden`, constraining all content to viewport height.

**Solution**: Changed AuthContext wrapper from:
- `<div className="flex flex-col h-screen">` → `<div className="flex flex-col min-h-screen">`
- Child container: removed `overflow-hidden` class

This fix applies to ALL pages (public marketing pages and dashboard pages). The AuthContext must use `min-h-screen` instead of `h-screen` to allow vertical scrolling.

### Safari Refresh Button Fix
**Issue**: Safari browser had persistent caching issues where hard refresh (Cmd+Shift+R) caused job cards to disappear from the Dispatch Board, even after implementing refetchQueries instead of invalidateQueries.

**Solution**: Completely removed the refresh button for Safari users only:
- Added Safari browser detection: `/^((?!chrome|android).)*safari/i.test(navigator.userAgent)`
- Conditionally hide refresh button on both desktop and mobile headers when Safari is detected
- Refresh button still available on Chrome and other browsers

This prevents Safari-specific caching issues while maintaining refresh functionality for other browsers.

### Production Session Authentication Fix
**Issue**: Sessions were not persisting in production after login. Users would log in successfully but immediately lose their session, appearing as "Not authenticated" on subsequent requests.

**Root Cause**: Two issues prevented sessions from working in production:
1. Sessions were not being explicitly saved before sending the login response
2. Express wasn't trusting Replit's proxy headers, preventing secure cookies from being set properly over HTTPS

**Solution**: 
1. Added explicit session save callback in login endpoint (`req.session.save()`)
2. Added `app.set('trust proxy', 1);` in `server/index.ts` to trust Replit's reverse proxy
3. Session configuration uses `secure: true` cookies in production which requires proxy trust to work

This is critical for production deployments behind reverse proxies like Replit's infrastructure.

### PWA Authentication Security Fix (Jan 6, 2025)
**Issue**: Access was switching unexpectedly in the PWA between admin and crew roles, causing security concerns and user confusion.

**Root Cause**: Development mode backdoor in `AuthContext.tsx` granted admin access to unauthenticated users:
```javascript
const isAdmin = isDev && !isAuthenticated ? true : userRole === 'admin';
```
This meant that when sessions expired or were cleared in the PWA, users would temporarily gain admin access if running in dev mode.

**Solution**: 
1. Removed all dev mode authentication backdoors from `AuthContext.tsx`
2. Enforced strict role-based authentication: `isAdmin = userRole === 'admin'`
3. Users MUST be authenticated with proper admin role to access admin features
4. No exceptions - authentication is now consistent across all environments

**Security Impact**: This fix ensures that access control is consistent and cannot be bypassed. All users must log in with proper credentials and maintain valid sessions to access role-specific features.

### Session Cookie Security Fix (Oct 6, 2025)
**Issue**: Users had to log in every time the page refreshed. Session cookies were not persisting across page reloads, even though PostgreSQL session storage was properly configured.

**Root Cause**: Session cookies were configured with `secure: false` in development mode, but Replit serves applications over HTTPS in both development and production environments. Browsers require `secure: true` for cookies served over HTTPS, so they were rejecting the session cookies on every request.

**Solution**: 
1. Changed session cookie configuration from `secure: process.env.NODE_ENV === 'production'` to `secure: true` for all environments
2. This ensures browsers accept and persist session cookies since Replit always uses HTTPS
3. Combined with `app.set('trust proxy', 1)` to work correctly behind Replit's reverse proxy

**Result**: Sessions now persist for 30 days in development (7 days in production) across page refreshes, browser restarts, and server restarts.

### Billing Section Padding Fix (Oct 6, 2025)
**Issue**: The "Items & Services" table in the billing section was cramped against the edges of its container with no horizontal padding, making it difficult to read on both mobile and desktop.

**Solution**: Added responsive horizontal padding to both billing section table containers:
- `px-3` (12px) on mobile devices
- `px-4` (16px) on larger screens (`sm:` breakpoint and above)
- Applied to both instances of the billing line items table in GlobalJobCard.tsx

**Result**: The billing tables now have proper breathing room on both sides, improving readability and visual consistency with the rest of the application.

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
- OpenAI (Whisper API for call transcription)
- Multer (audio file upload handling, 50 MB limit)
- Xero (`xero-node` SDK for accounting integration)
- Addy Solutions (NZ address autocomplete and validation API)