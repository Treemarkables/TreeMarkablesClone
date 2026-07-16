import { useState, useEffect } from "react";
import { Section, Container } from "@/components/Container";
import { LinkButton } from "@/components/Button";

type Tier = "All plans" | "Crew & up" | "Business" | "Add-on";

type FeatureCard = {
  title: string;
  body: string;
  tier: Tier;
  // Longer context shown in the click-to-expand modal.
  detail: string;
  points: string[];
  // Screenshot from the real app — slots into the modal when available.
  image?: string;
  // Not shipped yet — renders a "Coming soon" badge.
  comingSoon?: boolean;
};

type Category = {
  id: string;
  name: string;
  blurb: string;
  features: FeatureCard[];
};

// Every feature below is shipped in the app today — descriptions are grounded
// in what the product actually does, not roadmap. `image` fills in as real
// app screenshots are captured.
const categories: Category[] = [
  {
    id: "jobs",
    name: "Jobs & scheduling",
    blurb: "The day-to-day core: every job in one card, on a schedule the whole team can see.",
    features: [
      {
        title: "Job cards",
        body: "Everything about a job in one card — quote, schedule, photos, diary, checklists and billing — with desktop and mobile layouts built for the field.",
        tier: "All plans",
        detail:
          "Every job is a single card the whole team works from — office and field see the same live record. Open it on a laptop for the full desktop layout, or on a phone for a touch-optimised version built for one hand on site.",
        points: [
          "Details, quote, billing, checklists, diary and photos in one place",
          "Separate desktop and mobile layouts — not a shrunk-down web page",
          "Live updates as the crew works, no end-of-day data entry",
          "Site map, timers and documents all attached to the job",
        ],
      },
      {
        title: "Calendar & scheduling",
        body: "Book jobs and site visits on a shared team calendar, so everyone sees what's on and when.",
        tier: "All plans",
        image: "/screenshots/calendar-scheduling.png",
        detail:
          "Book jobs and site visits onto a shared calendar the whole team can see, so nothing gets double-booked and everyone knows what's on.",
        points: [
          "Shared team calendar for jobs and site visits",
          "See the week or day at a glance",
          "Assign work to the right people and dates",
          "Feeds the dispatch board and staff schedule",
        ],
      },
      {
        title: "Dispatch board",
        body: "A drag-and-drop board to assign work across crews and reschedule on the fly.",
        tier: "Crew & up",
        image: "/screenshots/dispatch-board.png",
        detail:
          "A drag-and-drop board for assigning and moving work across crews. Reshuffle the day in seconds when a job runs over or a callout comes in.",
        points: [
          "Drag jobs between crews and days",
          "Reschedule on the fly without reopening each job",
          "See the whole team's workload at once",
          "Built for the person running the day",
        ],
      },
      {
        title: "Staff schedule",
        body: "A multi-week grid of who's on which job, day by day, with per-job staff assignments.",
        tier: "Crew & up",
        detail:
          "A multi-week grid showing who's on which job, day by day. Plan the roster ahead and assign staff to specific jobs.",
        points: [
          "Multi-week view of the whole crew",
          "Per-job staff assignments",
          "Spot gaps and clashes early",
          "Plan leave and availability around the work",
        ],
      },
      {
        title: "Custom job lanes",
        body: "Organise jobs into your own pipeline buckets, with automation rules that fire when a job enters a lane or sits too long.",
        tier: "All plans",
        detail:
          "Organise jobs into your own pipeline buckets — 'Awaiting quote', 'Ready to invoice', whatever fits how you work. Automation rules can fire when a job enters a lane or sits too long.",
        points: [
          "Build the buckets that match your workflow",
          "Automations trigger on lane entry, time-in-lane or status change",
          "Runs alongside job status, not instead of it",
          "Nudges stalled jobs before they slip",
        ],
      },
      {
        title: "Today dashboard",
        body: "A daily command centre: today's jobs, fleet compliance and what needs attention — one screen to start the day.",
        tier: "All plans",
        detail:
          "One screen to start the day: today's jobs, fleet compliance, and anything that needs attention before the crew rolls out.",
        points: [
          "Today's scheduled jobs at a glance",
          "Fleet rego, CoF and service flags surfaced",
          "What needs attention, up front",
          "'Near me' sorting for the field",
        ],
      },
      {
        title: "Job diary",
        body: "A timestamped diary on every job — notes, updates and photos from whoever's on site.",
        tier: "All plans",
        detail:
          "A timestamped diary on every job — notes, updates and photos from whoever's on site. A new person can pick up the job and be up to speed in seconds.",
        points: [
          "Chronological record per job",
          "Notes, photos and updates from the field",
          "Who did what, and when",
          "Feeds the photo report and progress recaps",
        ],
      },
      {
        title: "Time tracking",
        body: "Start a timer on the job; recorded time rolls up into timesheets and lands against the job for costing.",
        tier: "Crew & up",
        detail:
          "Start a timer on the job instead of guessing hours after the fact. Recorded time rolls into timesheets and lands against the job for costing.",
        points: [
          "Start / stop timers on the job",
          "Time recorded against the right job",
          "Rolls up into timesheets",
          "Feeds job costing and payroll prep",
        ],
      },
      {
        title: "Tasks board",
        body: "A kanban board for office work and follow-ups that aren't jobs, so they don't live in someone's head.",
        tier: "All plans",
        detail:
          "A kanban board for the office work and follow-ups that aren't jobs — so they don't live in someone's head or on a sticky note.",
        points: [
          "Kanban columns for admin work",
          "Follow-ups that aren't full jobs",
          "Nothing falls through the cracks",
          "Separate from the job pipeline",
        ],
      },
      {
        title: "Job templates",
        body: "Preset your repeat job types so common work is set up in seconds.",
        tier: "Crew & up",
        detail:
          "Preset your repeat job types so a common job is set up in seconds instead of built from scratch each time.",
        points: [
          "Presets for your regular job types",
          "Consistent setup every time",
          "Faster job creation",
          "Fewer missed steps",
        ],
      },
      {
        title: "Google Calendar sync",
        body: "Two-way sync — your jobs push to Google Calendar, and existing Google events block out busy time so you're never double-booked.",
        tier: "Crew & up",
        detail:
          "Two-way sync with Google Calendar. Your Inflow jobs appear in Google, and existing Google events block out busy time so you're never double-booked.",
        points: [
          "Jobs push to Google Calendar",
          "Existing Google events show as busy",
          "No double-booking across tools",
          "Keeps office and field in step",
        ],
      },
    ],
  },
  {
    id: "quoting",
    name: "Quoting & proposals",
    blurb: "Win the work: quotes and proposals customers accept, sign and pay online.",
    features: [
      {
        title: "Quote builder",
        body: "Build and send branded quotes with materials, labour and GST — customers view and accept them online.",
        tier: "All plans",
        detail:
          "Build a branded quote with materials, labour and GST, then send it for the customer to view and accept online — no PDF email chains.",
        points: [
          "Materials and labour lines with GST",
          "Branded, customer-facing view",
          "Accept online in a click",
          "Rolls straight into the invoice later",
        ],
      },
      {
        title: "Proposal builder",
        body: "Multi-section proposals with line-item options the customer can pick from, accepted and signed online.",
        tier: "All plans",
        detail:
          "For bigger jobs: multi-section proposals with optional line-item choices the customer can pick from, then accept and sign online.",
        points: [
          "Multiple sections and rich detail",
          "Optional add-ons the customer chooses",
          "Accepted and signed online",
          "Turns into a job on acceptance",
        ],
      },
      {
        title: "Deposits on acceptance",
        body: "Ask for a deposit when a customer accepts a proposal — collected by card through your connected Stripe account.",
        tier: "All plans",
        detail:
          "Ask for a deposit at the moment a customer accepts a proposal — collected by card through your connected Stripe account, so the work is secured before it starts.",
        points: [
          "Set a required deposit on the proposal",
          "Collected by card on acceptance",
          "Funds land in your connected Stripe account",
          "Locks in the job before you commit resources",
        ],
      },
      {
        title: "Speech-to-quote",
        body: "Talk through the job on site — Inflow transcribes what you said and drafts the quote for you.",
        tier: "Crew & up",
        detail:
          "Talk through the job on site and Inflow transcribes what you said and drafts the quote for you — no typing with muddy hands.",
        points: [
          "Dictate the job out loud",
          "AI transcription and draft quote",
          "Hands-free on site",
          "Edit and send in minutes",
        ],
      },
      {
        title: "Screenshot to quote",
        body: "Paste a screenshot of a text or message thread — AI reads it, fills in the customer and job details, and you quote from there.",
        tier: "Crew & up",
        detail:
          "Paste a screenshot of a text or messaging thread and AI reads it, pulls out the customer and job details, and gets you to a quote from there.",
        points: [
          "Paste a screenshot of a text thread",
          "AI extracts customer and job details",
          "No re-typing from messages",
          "Straight into a lead or quote",
        ],
      },
      {
        title: "Quote follow-ups",
        body: "A follow-up queue with AI-drafted chasers, so sent quotes don't quietly go cold.",
        tier: "Crew & up",
        detail:
          "A follow-up queue so sent quotes don't quietly go cold — with AI-drafted chasers you can send in a tap.",
        points: [
          "Queue of quotes awaiting a decision",
          "AI-drafted follow-up messages",
          "Nudge at the right moment",
          "Win back work that would've lapsed",
        ],
      },
      {
        title: "Materials & services catalog",
        body: "Your priced materials and services in one catalog, reused across every quote and invoice.",
        tier: "Crew & up",
        detail:
          "Your priced materials and services in one catalog, reused across every quote and invoice so pricing stays consistent.",
        points: [
          "Central priced catalog",
          "Reused across quotes and invoices",
          "Consistent pricing",
          "Faster line-item entry",
        ],
      },
    ],
  },
  {
    id: "money",
    name: "Invoicing & money",
    blurb: "Get paid: invoices from job data, payments in, costs matched against the quote.",
    features: [
      {
        title: "Invoicing",
        body: "Sectioned invoices built from the job's quote, time and materials — sent with an online viewer.",
        tier: "All plans",
        detail:
          "Invoices built from the job's quote, time and materials — sectioned, branded, and sent with an online viewer the customer can pay from.",
        points: [
          "Drawn from quote, time and materials",
          "Sectioned and branded",
          "Online viewer for the customer",
          "Less double entry",
        ],
      },
      {
        title: "Card & bank payments",
        body: "Take card payments online through your connected Stripe account — and your bank details render on every invoice for direct transfer.",
        tier: "All plans",
        detail:
          "Take card payments online through your own connected Stripe account, and your bank details render on every invoice for customers who'd rather transfer.",
        points: [
          "Card payments via your connected Stripe account",
          "Funds land directly with you",
          "Bank details on every invoice too",
          "Customer picks how to pay",
        ],
      },
      {
        title: "Xero sync",
        body: "Push invoices through to Xero so the books stay right without double entry.",
        tier: "Crew & up",
        detail:
          "Push invoices through to Xero so your accounts stay right without keying everything twice.",
        points: [
          "Send invoices to Xero",
          "No double entry",
          "Books stay reconciled",
          "Crew tier and up",
        ],
      },
      {
        title: "Supplier invoice import",
        body: "Snap a photo or drop in a PDF of a supplier bill — the line items are read automatically and costed to the right job.",
        tier: "Crew & up",
        detail:
          "Snap a photo or drop in a PDF of a supplier bill and Inflow reads the line items and costs them to the right job — no manual entry.",
        points: [
          "Photo or PDF of a supplier bill",
          "AI reads the line items",
          "Costs land on the right job",
          "Feeds job costing",
        ],
      },
      {
        title: "Job costing & back-costing",
        body: "Compare quoted vs actual labour, materials and supplier costs on every job, so you know what actually made money.",
        tier: "Crew & up",
        detail:
          "Compare what you quoted against what the job actually cost — labour, materials and supplier bills — so you know which jobs made money and which didn't.",
        points: [
          "Quoted vs actual, side by side",
          "Labour, materials and supplier costs",
          "Per-job profitability",
          "Learn what to price differently",
        ],
      },
      {
        title: "Reconciliation",
        body: "Match payments against invoices in one view, so nothing slips through unpaid.",
        tier: "Crew & up",
        detail:
          "Match payments against invoices in one view so nothing slips through unpaid.",
        points: [
          "Payments matched to invoices",
          "See what's outstanding",
          "Catch missed payments",
          "Cleaner month-end",
        ],
      },
    ],
  },
  {
    id: "customers",
    name: "Customers & CRM",
    blurb: "One record per customer — every contact, property, quote and job against it.",
    features: [
      {
        title: "Customer records",
        body: "Customers with multiple contacts, communication preferences and the full history of quotes, jobs and properties.",
        tier: "All plans",
        detail:
          "One record per customer with multiple contacts, communication preferences and the full history of their quotes, jobs and properties.",
        points: [
          "Multiple contacts per customer",
          "Full quote and job history",
          "Property and site details",
          "Communication preferences respected",
        ],
      },
      {
        title: "Leads & pipeline",
        body: "Capture and track leads from first contact through to booked job.",
        tier: "All plans",
        detail:
          "Capture leads from first contact and track them through to a booked job, so no enquiry gets forgotten.",
        points: [
          "Capture every enquiry",
          "Track from lead to booked job",
          "See the pipeline at a glance",
          "Convert to a job in a click",
        ],
      },
      {
        title: "AI lead capture",
        body: "Inbound emails and messages are parsed automatically into contact details and a job request — no re-typing.",
        tier: "Crew & up",
        detail:
          "Inbound emails and messages are parsed automatically into contact details and a job request, so a new enquiry becomes a lead without re-typing.",
        points: [
          "Reads inbound emails and messages",
          "Extracts contact and job details",
          "Creates the lead for you",
          "Less admin on every enquiry",
        ],
      },
      {
        title: "Import & migration",
        body: "Bring your customer list in by CSV, with a built-in ServiceM8 import for customers, jobs and quotes — and we help with the rest during onboarding.",
        tier: "All plans",
        detail:
          "Bring your customer list in by CSV, with a built-in ServiceM8 import for customers, jobs and quotes — and we help with the rest during onboarding.",
        points: [
          "CSV customer import",
          "ServiceM8 import for customers, jobs and quotes",
          "Hands-on onboarding help",
          "Start with your real data",
        ],
      },
    ],
  },
  {
    id: "comms",
    name: "Communication",
    blurb: "Email and SMS from the app, threaded per customer, with the routine ones automated.",
    features: [
      {
        title: "Unified inbox",
        body: "Email and SMS conversations threaded per customer in one inbox, so any team member can pick up the thread.",
        tier: "Crew & up",
        detail:
          "Email and SMS threaded per customer in one inbox, so any team member can pick up a conversation without hunting through personal phones.",
        points: [
          "Email and SMS in one place",
          "Threaded per customer",
          "Anyone on the team can pick it up",
          "Nothing stuck on one person's phone",
        ],
      },
      {
        title: "Two-way SMS",
        body: "Send and receive texts from your business number, with a monthly SMS bundle included on paid plans.",
        tier: "Crew & up",
        detail:
          "Send and receive texts from your business number inside Inflow, with a monthly SMS bundle included on paid plans.",
        points: [
          "Text from your business number",
          "Replies come back into the inbox",
          "Monthly SMS bundle included",
          "Top up any time",
        ],
      },
      {
        title: "Message templates",
        body: "Reusable SMS and email templates for the messages you send every day.",
        tier: "Crew & up",
        detail:
          "Reusable SMS and email templates for the messages you send every day, so the crew isn't retyping the same thing.",
        points: [
          "Reusable SMS and email templates",
          "Consistent, professional wording",
          "Faster replies",
          "Fewer typos and errors",
        ],
      },
      {
        title: "Booking reminders",
        body: "Automatic reminders to customers ahead of booked work, so fewer no-shows.",
        tier: "Crew & up",
        detail:
          "Automatic reminders to customers ahead of booked work, cutting no-shows and 'was that today?' calls.",
        points: [
          "Automatic pre-job reminders",
          "Fewer no-shows",
          "Less phone tag",
          "Set and forget",
        ],
      },
      {
        title: "“On my way” texts",
        body: "One tap texts the customer you're en route with an ETA — and logs it to the job.",
        tier: "Crew & up",
        detail:
          "One tap texts the customer that your crew is en route with an ETA — and logs it to the job so there's a record.",
        points: [
          "One-tap en-route text",
          "Includes an ETA",
          "Logged to the job",
          "Fewer 'where are you' calls",
        ],
      },
      {
        title: "Inquiry auto-reply",
        body: "New inquiries get an instant acknowledgement while the lead lands in your pipeline.",
        tier: "Crew & up",
        detail:
          "New enquiries get an instant acknowledgement while the lead lands in your pipeline, so no one's left waiting.",
        points: [
          "Instant acknowledgement to enquiries",
          "Lead captured at the same time",
          "Looks responsive even when you're on the tools",
          "Configurable message",
        ],
      },
      {
        title: "Gmail & Mailchimp",
        body: "Email replies flow into the inbox through your Gmail, and your customer list syncs to Mailchimp audiences for campaigns.",
        tier: "Crew & up",
        detail:
          "Connect Gmail so customer email replies flow into the inbox, and sync your customer list to Mailchimp audiences for campaigns.",
        points: [
          "Gmail replies land in the inbox",
          "Customer list syncs to Mailchimp",
          "Run email campaigns off real data",
          "Crew tier and up",
        ],
      },
    ],
  },
  {
    id: "calls",
    name: "Phone & voice",
    blurb: "Your business line, in the app — with an AI backstop for the calls you can't take.",
    features: [
      {
        title: "Business phone & call recording",
        body: "Take business calls on the iOS app or in your browser — calls are recorded and linked to the customer and job.",
        tier: "Add-on",
        image: "/screenshots/call-recording.png",
        detail:
          "Take and make business calls on the iOS app or in your browser. Calls are recorded and linked to the customer and job, so there's a record of what was agreed.",
        points: [
          "Call from the iOS app or browser",
          "Recordings saved automatically",
          "Linked to the customer and job",
          "Add-on on any paid plan",
        ],
      },
      {
        title: "AI receptionist",
        body: "When you can't pick up, an AI voice agent answers, triages the job and captures the lead — with your greeting and rules.",
        tier: "Add-on",
        comingSoon: true,
        detail:
          "When you can't pick up, an AI voice agent answers, triages the job and captures the lead — using your greeting, your voice and your rules. In development — coming soon.",
        points: [
          "Answers when you can't",
          "Triages the caller's job",
          "Captures the lead for follow-up",
          "Your greeting, voice and limits",
        ],
      },
    ],
  },
  {
    id: "photos",
    name: "Photos, video & site",
    blurb: "Proof of work: capture it on site, find it later, share it with the customer.",
    features: [
      {
        title: "Photo capture & annotation",
        body: "Capture site photos and draw straight on them — arrows, circles, notes — from any phone.",
        tier: "All plans",
        detail:
          "Capture site photos and mark them up on the spot — arrows, circles and notes — straight from any phone.",
        points: [
          "Capture from any phone",
          "Draw arrows, circles and notes",
          "Annotations saved on the photo",
          "Lands in the job diary",
        ],
      },
      {
        title: "Before & after generator",
        body: "Paired before / after capture, with a branded composite generated automatically — ready to share on social.",
        tier: "All plans",
        detail:
          "Capture paired before/after shots and Inflow builds a branded composite automatically — ready to post on social.",
        points: [
          "Paired before / after capture",
          "Branded composite generated for you",
          "Ready to share on social",
          "Great for showing off finished work",
        ],
      },
      {
        title: "Voice photo captions",
        body: "Speak the caption as you shoot — it's transcribed onto the photo in the job diary.",
        tier: "Crew & up",
        detail:
          "Speak the caption as you take the photo and it's transcribed onto the shot in the job diary — no thumb-typing on site.",
        points: [
          "Dictate the caption out loud",
          "Transcribed onto the photo",
          "Hands-busy friendly",
          "Saved to the diary",
        ],
      },
      {
        title: "Public photo timeline",
        body: "A shareable link where your customer watches job progress photo by photo, without logging in.",
        tier: "Crew & up",
        detail:
          "Share a link where your customer watches job progress photo by photo, without needing a login.",
        points: [
          "Shareable public link",
          "Customer sees progress unfold",
          "No login required",
          "Keeps clients in the loop",
        ],
      },
      {
        title: "Photo report PDF",
        body: "One tap compiles a job's photos into a branded, timestamped PDF report you can send on.",
        tier: "All plans",
        detail:
          "One tap compiles a job's photos into a branded, timestamped PDF report you can hand to the customer or the council.",
        points: [
          "Compiles job photos into a PDF",
          "Branded and timestamped",
          "One-tap generation",
          "For customers or compliance",
        ],
      },
      {
        title: "Job site map",
        body: "A satellite map on the job card with placeable markers — pin the trees, hazards or work areas on the property, or mark up your own uploaded site plan for council work.",
        tier: "All plans",
        detail:
          "A satellite map on the job card where you drop markers on the property — pin the trees, hazards or work areas — or mark up your own uploaded site plan for council and consent work.",
        points: [
          "Satellite map on the job card",
          "Pin trees, hazards or work areas",
          "Or mark up your own uploaded plan",
          "Snapshots into the proposal",
        ],
      },
      {
        title: "Job videos",
        body: "Upload walkthrough videos against the job, transcribed automatically so they're searchable.",
        tier: "Crew & up",
        image: "/screenshots/job-videos.jpg",
        detail:
          "Upload walkthrough videos against the job. They're transcribed automatically, so you can search what was said.",
        points: [
          "Walkthrough videos per job",
          "Automatic transcription",
          "Searchable content",
          "Crew tier and up",
        ],
      },
      {
        title: "Media library",
        body: "Search every photo and video across all your jobs in one library, with a map view.",
        tier: "All plans",
        detail:
          "Search every photo and video across all your jobs in one place, with a map view to find work by location.",
        points: [
          "All photos and videos in one library",
          "Search across every job",
          "Map view by location",
          "Find that one shot fast",
        ],
      },
    ],
  },
  {
    id: "documents",
    name: "Documents",
    blurb: "Branded paperwork generated from job data, signed on the spot.",
    features: [
      {
        title: "Document builder",
        body: "Build branded document templates — certificates, handover packs, custom forms — and generate them straight from job data.",
        tier: "Crew & up",
        detail:
          "Build branded document templates — certificates, handover packs, custom forms — and generate them straight from job data, sections, line items and photos included.",
        points: [
          "Reusable branded templates",
          "Certificates, handover packs, custom forms",
          "Generated from job data",
          "Sections, line items and photos",
        ],
      },
      {
        title: "Signature capture",
        body: "Capture signatures on proposals and documents, on a phone or tablet, on the spot.",
        tier: "All plans",
        detail:
          "Capture signatures on proposals and documents right on a phone or tablet, on the spot.",
        points: [
          "Sign on phone or tablet",
          "On proposals and documents",
          "Captured on site",
          "No printing and scanning",
        ],
      },
    ],
  },
  {
    id: "safety",
    name: "Safety & compliance",
    blurb: "Audit-ready safety records, tied to the jobs, vehicles and people they belong to.",
    features: [
      {
        title: "SWMS builder",
        body: "Safe Work Method Statements built from templates, with steps and sign-on signatures.",
        tier: "Crew & up",
        detail:
          "Build Safe Work Method Statements from templates, with steps and on-site sign-on signatures — audit-ready and tied to the job.",
        points: [
          "Template-driven SWMS",
          "Steps and controls",
          "On-site sign-on signatures",
          "Tied to the job it belongs to",
        ],
      },
      {
        title: "JHA assessments",
        body: "Job hazard analysis with hazard and control libraries, completed and signed on site.",
        tier: "Crew & up",
        image: "/screenshots/jha.png",
        detail:
          "Job Hazard Analysis with hazard and control libraries, completed and signed on site.",
        points: [
          "Hazard and control libraries",
          "Completed on site",
          "Signed by the crew",
          "Kept against the job",
        ],
      },
      {
        title: "Toolbox talks",
        body: "Run and record toolbox talks with attendee tracking, so there's a register when you need one.",
        tier: "Crew & up",
        detail:
          "Run and record toolbox talks with attendee tracking, so there's a register when you need to prove it happened.",
        points: [
          "Run talks from the app",
          "Track who attended",
          "Register kept automatically",
          "Ready for an audit",
        ],
      },
      {
        title: "Pre-start checklists",
        body: "Configurable daily pre-start checks completed on mobile before work begins.",
        tier: "Crew & up",
        detail:
          "Configurable daily pre-start checks completed on mobile before work begins.",
        points: [
          "Configurable checklists",
          "Completed on mobile",
          "Before work starts",
          "Recorded per day and crew",
        ],
      },
      {
        title: "Incident reporting",
        body: "Near-miss reports with photos, witnesses and corrective actions, plus a notifiable events register.",
        tier: "Crew & up",
        detail:
          "File near-miss reports with photos, witnesses and corrective actions, plus a notifiable events register for the serious ones.",
        points: [
          "Near-miss reports with photos",
          "Witnesses and corrective actions",
          "Notifiable events register",
          "A proper paper trail",
        ],
      },
      {
        title: "Training & competency register",
        body: "Track who's qualified for what, with competency types per employee.",
        tier: "Crew & up",
        detail:
          "Track who's qualified for what, with competency types recorded per employee, so you know who can run which gear.",
        points: [
          "Competency types per employee",
          "Know who's qualified",
          "Spot gaps before a job",
          "Pairs with equipment inductions",
        ],
      },
    ],
  },
  {
    id: "equipment",
    name: "Equipment & fleet",
    blurb: "Every machine, vehicle and tool accounted for — maintained, inspected, inducted.",
    features: [
      {
        title: "Equipment register & maintenance",
        body: "Register plant and tools with maintenance schedules and service history.",
        tier: "Crew & up",
        detail:
          "Register plant and tools with maintenance schedules and service history, so nothing runs past its service.",
        points: [
          "Register plant and tools",
          "Maintenance schedules",
          "Service history per item",
          "Stay ahead of breakdowns",
        ],
      },
      {
        title: "Check-in / check-out",
        body: "Know who has what — equipment checked out to people and back in again.",
        tier: "Crew & up",
        detail:
          "Know who has what — equipment checked out to people and checked back in again.",
        points: [
          "Check gear out to people",
          "Check it back in",
          "Always know where it is",
          "Less lost kit",
        ],
      },
      {
        title: "Vehicle inspections & compliance",
        body: "Vehicle inspection checklists with history, plus rego, CoF and service reminders before they lapse.",
        tier: "Crew & up",
        image: "/screenshots/vehicle-inspections.png",
        detail:
          "Vehicle inspection checklists with history, plus rego, CoF and service reminders before they lapse.",
        points: [
          "Inspection checklists with history",
          "Rego, CoF and service reminders",
          "Flagged on the Today dashboard",
          "Keep the fleet legal",
        ],
      },
      {
        title: "Equipment inductions",
        body: "Induction templates with sign-off, so only inducted staff run the gear.",
        tier: "Crew & up",
        detail:
          "Induction templates with sign-off, so only inducted staff run the gear.",
        points: [
          "Induction templates per item",
          "Sign-off recorded",
          "Only inducted staff operate",
          "Reduces risk and liability",
        ],
      },
    ],
  },
  {
    id: "team",
    name: "Team & permissions",
    blurb: "The whole crew on one platform — each person seeing exactly what they should.",
    features: [
      {
        title: "Staff management",
        body: "Add your team with their details, pay rates and availability — up to 3 users free, unlimited on paid plans.",
        tier: "All plans",
        detail:
          "Add your team with their details, pay rates and availability. Up to 3 users free; unlimited on every paid plan.",
        points: [
          "Team details, pay rates, availability",
          "Up to 3 users free",
          "Unlimited on paid plans",
          "One place for the crew",
        ],
      },
      {
        title: "Roles & permissions",
        body: "Role-based access with per-person overrides — the office sees one thing, the apprentice another.",
        tier: "Crew & up",
        detail:
          "Role-based access with per-person overrides — the office sees one thing, the foreman another, the apprentice only what they need.",
        points: [
          "Roles for office, field and admin",
          "Per-person overrides",
          "Least-privilege by default",
          "Give access without giving the keys",
        ],
      },
      {
        title: "Staff inductions",
        body: "Structured induction flows for new starters, tracked to completion.",
        tier: "Crew & up",
        detail:
          "Structured induction flows for new starters, tracked through to completion.",
        points: [
          "Onboarding flows for new hires",
          "Tracked to completion",
          "Consistent every time",
          "Nothing skipped",
        ],
      },
    ],
  },
  {
    id: "insights",
    name: "Insights & automation",
    blurb: "See how the business is really doing — and put the routine on rails.",
    features: [
      {
        title: "Dashboards & metrics",
        body: "Business dashboards covering jobs, revenue and performance at a glance.",
        tier: "Crew & up",
        image: "/screenshots/dashboards-metrics.png",
        detail:
          "Business dashboards covering jobs, revenue and performance at a glance.",
        points: [
          "Jobs, revenue and performance",
          "At-a-glance dashboards",
          "Spot trends early",
          "Crew tier and up",
        ],
      },
      {
        title: "Advanced analytics",
        body: "Deeper performance and financial analytics for multi-crew operations.",
        tier: "Business",
        image: "/screenshots/advanced-analytics.png",
        detail:
          "Deeper performance and financial analytics for multi-crew operations that need to see beyond the basics.",
        points: [
          "Deeper performance analytics",
          "Financial breakdowns",
          "For multi-crew operations",
          "Business tier",
        ],
      },
      {
        title: "Workflow automation",
        body: "Trigger-based rules that move jobs, send comms and assign work without anyone lifting a finger.",
        tier: "Business",
        detail:
          "Trigger-based rules that move jobs, send comms and assign work automatically — the routine handled without anyone lifting a finger.",
        points: [
          "If-this-then-that rules",
          "Move jobs and assign work",
          "Send comms automatically",
          "Business tier",
        ],
      },
    ],
  },
  {
    id: "platform",
    name: "Platform",
    blurb: "Everywhere your team is — phone, browser, and the help to learn it all.",
    features: [
      {
        title: "Mobile app",
        body: "A native iOS app plus an installable web app on any phone — the field runs Inflow from a pocket.",
        tier: "All plans",
        detail:
          "A native iOS app plus an installable web app on any phone, so the field runs Inflow from a pocket.",
        points: [
          "Native iOS app",
          "Installable web app on any phone",
          "Built for one-handed use on site",
          "Same data as the desktop",
        ],
      },
      {
        title: "Push notifications",
        body: "Job, message and assignment notifications to the right person's phone, with per-user preferences.",
        tier: "All plans",
        detail:
          "Job, message and assignment notifications go to the right person's phone, with per-user preferences so no one's spammed.",
        points: [
          "Job, message and assignment alerts",
          "To the right person",
          "Per-user preferences",
          "Stay in the loop without the noise",
        ],
      },
      {
        title: "Global search",
        body: "One search across jobs, customers, quotes and more.",
        tier: "All plans",
        detail:
          "One search across jobs, customers, quotes and more — find anything without clicking through menus.",
        points: [
          "Search jobs, customers and quotes",
          "One box, everywhere",
          "Jump straight to the record",
          "Fast on any device",
        ],
      },
      {
        title: "Help centre & how-to videos",
        body: "Built-in SOPs and how-to videos for every core workflow, so new staff get up to speed on day one.",
        tier: "All plans",
        detail:
          "Built-in SOPs and how-to videos for every core workflow, so new staff get up to speed on day one instead of a week of shadowing.",
        points: [
          "SOPs and how-to videos built in",
          "Covers every core workflow",
          "New hires get up to speed on day one",
          "Searchable when you're stuck",
        ],
      },
      {
        title: "AI assistant",
        body: "An in-app assistant you can ask questions about your business data and how to get things done.",
        tier: "Crew & up",
        detail:
          "An in-app assistant you can ask about your business data and how to get things done in Inflow.",
        points: [
          "Ask about your business data",
          "Get how-to answers in context",
          "Less hunting through menus",
          "Crew tier and up",
        ],
      },
      {
        title: "Weather",
        body: "A weather view built in, for planning outdoor work around the forecast.",
        tier: "All plans",
        detail:
          "A weather view built in, for planning outdoor work around the forecast.",
        points: [
          "Forecast inside the app",
          "Plan outdoor work",
          "Avoid weather write-offs",
          "One less tab open",
        ],
      },
    ],
  },
];

// Plan inclusions — matched to entitlements, not aspirations.
const plans: {
  name: string;
  tagline: string;
  meta: string[];
  leadIn?: string;
  includes: string[];
  highlight?: boolean;
}[] = [
  {
    name: "Freemium",
    tagline: "Solo operators and small teams getting started.",
    meta: ["Up to 15 jobs / month", "Up to 3 users"],
    includes: [
      "Jobs, calendar & scheduling",
      "Quotes, proposals & invoicing",
      "Customers & leads",
      "Photos (10 per job), site map & job diary",
      "Tasks board & custom job lanes",
      "Mobile app, help hub & data import",
    ],
  },
  {
    name: "Crew",
    tagline: "Growing crews running a real book of work.",
    meta: ["Up to 150 jobs / month", "Unlimited users & photos"],
    leadIn: "Everything in Freemium, plus:",
    includes: [
      "Dispatch board & staff schedule",
      "Safety & compliance suite",
      "Equipment, fleet & inventory",
      "Roles, permissions & time tracking",
      "Inbox, SMS bundle & message templates",
      "AI assist — speech-to-quote, follow-ups & lead capture",
      "Job costing, dashboards & document builder",
      "Xero, Google Calendar, Gmail & Mailchimp",
    ],
    highlight: true,
  },
  {
    name: "Business",
    tagline: "Multi-crew operations running at scale.",
    meta: ["Unlimited jobs", "Bigger SMS bundle"],
    leadIn: "Everything in Crew, plus:",
    includes: [
      "Workflow automation",
      "Advanced analytics",
      "Priority onboarding & support",
    ],
  },
];

const addOns: { title: string; body: string; comingSoon?: boolean }[] = [
  {
    title: "Business phone & call recording",
    body: "Take and record business calls in the app, linked to customers and jobs.",
  },
  {
    title: "AI receptionist",
    body: "An AI voice agent answers and triages inbound calls when you can't.",
    comingSoon: true,
  },
  {
    title: "Extra SMS",
    body: "Top up beyond your plan's monthly SMS bundle.",
  },
];

type Active = { cat: string; feature: FeatureCard };

export default function Features() {
  const [active, setActive] = useState<Active | null>(null);

  // Close on Escape and lock body scroll while the modal is open.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [active]);

  return (
    <>
      {/* Header */}
      <Section className="pb-10 md:pb-12">
        <div className="max-w-3xl mx-auto text-center">
          <span className="eyebrow">Features</span>
          <h1 className="heading-display text-5xl md:text-6xl mt-5">
            Everything in Inflow.
          </h1>
          <p className="mt-6 text-lg text-ink-500 leading-relaxed max-w-prose mx-auto">
            The full feature set — what each tool does and which plan it lands on. Built for NZ trades businesses: jobs, quoting, invoicing, safety, fleet and the crew, in one app.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
            <TierTag tier="All plans" />
            <TierTag tier="Crew & up" />
            <TierTag tier="Business" />
            <TierTag tier="Add-on" />
          </div>
          <p className="mt-4 text-sm text-ink-400">Tap any feature for the detail.</p>
        </div>
      </Section>

      {/* Feature grid, grouped by category */}
      <div className="border-t border-ink-100">
        {categories.map((cat) => (
          <section key={cat.id} className="border-b border-ink-100 last:border-b-0">
            <Container className="py-14 md:py-16">
              <div className="max-w-2xl mx-auto text-center">
                <h2 className="heading-section text-2xl md:text-3xl">{cat.name}</h2>
                <p className="mt-2 text-ink-500 leading-relaxed">{cat.blurb}</p>
              </div>
              <div className="mt-10 flex flex-wrap justify-center gap-5">
                {cat.features.map((f) => (
                  <button
                    key={f.title}
                    type="button"
                    onClick={() => setActive({ cat: cat.name, feature: f })}
                    className="group flex flex-col items-center text-center basis-[320px] grow max-w-[380px] rounded-2xl border border-ink-100 bg-paper p-6 transition hover:border-ink-300 hover:shadow-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-deep focus-visible:ring-offset-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      <TierTag tier={f.tier} />
                      {f.comingSoon && <ComingSoonTag />}
                    </div>
                    <h3 className="heading-section text-lg mt-4">{f.title}</h3>
                    <p className="mt-2 text-sm text-ink-500 leading-relaxed">{f.body}</p>
                    <span className="mt-auto pt-5 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-700 group-hover:text-ink-900">
                      View details
                      <Arrow />
                    </span>
                  </button>
                ))}
              </div>
            </Container>
          </section>
        ))}
      </div>

      {/* What's in each plan — directly after the grid */}
      <section className="bg-ink-50 border-t border-ink-100">
        <Container className="py-20 md:py-24">
          <div className="max-w-2xl mx-auto text-center">
            <span className="eyebrow">Plans</span>
            <h2 className="heading-section text-3xl md:text-4xl mt-3">
              What's in each plan.
            </h2>
            <p className="mt-5 text-ink-500 leading-relaxed">
              Every plan runs the core of your business. Crew adds the suite a working team needs; Business adds the tools to grow it. Pay by jobs per month, not per seat.
            </p>
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-5 items-start">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border bg-paper p-7 ${
                  p.highlight ? "border-ink-900 shadow-lift relative" : "border-ink-100"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-7 px-2.5 py-1 rounded-full bg-lime text-ink-900 text-[11px] font-semibold tracking-snug">
                    Most popular
                  </span>
                )}
                <h3 className="heading-section text-xl">{p.name}</h3>
                <p className="mt-1.5 text-sm text-ink-500">{p.tagline}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.meta.map((m) => (
                    <span key={m} className="px-2.5 py-1 rounded-full bg-ink-100 text-ink-600 text-[11px] font-semibold tracking-snug">
                      {m}
                    </span>
                  ))}
                </div>
                {p.leadIn && (
                  <p className="mt-5 text-[13px] font-semibold text-ink-700">{p.leadIn}</p>
                )}
                <ul className={`${p.leadIn ? "mt-3" : "mt-5"} space-y-2.5`}>
                  {p.includes.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm text-ink-700">
                      <CheckMark />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Add-ons */}
          <div className="mt-10 rounded-2xl border border-ink-100 bg-paper p-7">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="heading-section text-lg">Add-ons</h3>
              <span className="text-sm text-ink-500">Available on any paid plan.</span>
            </div>
            <div className="mt-5 grid sm:grid-cols-3 gap-5">
              {addOns.map((a) => (
                <div key={a.title}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink-900">{a.title}</span>
                    {a.comingSoon && <ComingSoonTag />}
                  </div>
                  <p className="mt-1 text-sm text-ink-500 leading-relaxed">{a.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 text-center">
            <LinkButton href="/pricing" variant="primary" size="md">
              See pricing
            </LinkButton>
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="bg-ink-900 text-paper">
        <Container className="py-20 md:py-24 text-center">
          <h2 className="heading-display text-4xl md:text-5xl max-w-3xl mx-auto">
            See it in your business.
          </h2>
          <p className="mt-6 text-ink-300 max-w-prose mx-auto">
            We'll walk you through a personalised setup based on the work you do.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <LinkButton href="/contact" variant="secondary" size="lg">
              Request access
            </LinkButton>
            <LinkButton href="/pricing" variant="ghost" size="lg" className="text-paper border border-ink-700 hover:bg-ink-800">
              See pricing
            </LinkButton>
          </div>
        </Container>
      </section>

      {/* Feature detail modal */}
      {active && (
        <FeatureModal active={active} onClose={() => setActive(null)} />
      )}
    </>
  );
}

function FeatureModal({ active, onClose }: { active: Active; onClose: () => void }) {
  const { cat, feature } = active;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={feature.title}
    >
      <div
        className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-paper rounded-t-3xl sm:rounded-3xl border border-ink-100 shadow-lift">
        {/* Screenshot slot — renders when a real app image is attached */}
        {feature.image && (
          <div className="bg-ink-50 border-b border-ink-100">
            <img
              src={feature.image}
              alt={`${feature.title} in Inflow`}
              className="w-full h-auto"
            />
          </div>
        )}

        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <span className="eyebrow">{cat}</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-1 -mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <h2 className="heading-section text-2xl">{feature.title}</h2>
            <TierTag tier={feature.tier} />
            {feature.comingSoon && <ComingSoonTag />}
          </div>

          <p className="mt-4 text-ink-600 leading-relaxed">{feature.detail}</p>

          <ul className="mt-6 space-y-3">
            {feature.points.map((pt) => (
              <li key={pt} className="flex items-start gap-3 text-[15px] text-ink-700">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-lime-deep shrink-0" />
                <span>{pt}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/contact" variant="primary" size="md">
              Request access
            </LinkButton>
            <LinkButton href="/pricing" variant="ghost" size="md">
              See pricing
            </LinkButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg
      className="transition-transform group-hover:translate-x-0.5"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function TierTag({ tier }: { tier: Tier }) {
  const styles: Record<Tier, string> = {
    "All plans": "bg-ink-100 text-ink-600",
    "Crew & up": "bg-lime text-ink-900",
    Business: "bg-ink-900 text-paper",
    "Add-on": "bg-paper text-ink-700 border border-ink-200",
  };
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-snug ${styles[tier]}`}>
      {tier}
    </span>
  );
}

function ComingSoonTag() {
  return (
    <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-snug bg-amber-100 text-amber-800 border border-amber-200">
      Coming soon
    </span>
  );
}

function CheckMark() {
  return (
    <span className="mt-0.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ink-900 text-paper shrink-0">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}
