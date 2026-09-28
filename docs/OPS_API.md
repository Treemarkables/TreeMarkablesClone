# Inflow Ops API (Phase 1)

Small JSON for an ops bot. Deep links open the app. No browser automation.

Auth is the signed-in session **or** `Authorization: Bearer <api key>`. The business id comes from the employee row or from `api_keys.business_id`. A key with no business id is rejected. A key and a session for different businesses are rejected. Callers cannot pass a business id.

Reads: any signed-in employee of that business, or a scoped key.
`setDailyRevenueTarget`: admin session, or a scoped key. A non-admin session alone gets 403. The bot should still confirm with Jullian before it writes.

Amounts are NZD **exc. GST** (`gstLabel`). The daily target is `business_settings.daily_revenue_target` via `parseDailyRevenueTarget`. Missing or unusable values are `null`. Nothing here substitutes 3500 or 4000.

Settings → Preferences still saves through admin-only `PUT /api/business-settings`, which returns the settings row including `dailyRevenueTarget`. The route below writes that field only and returns the new number.

## Tools

| Tool | Method | Path |
| --- | --- | --- |
| `listUnscheduled` | GET | `/api/ops/unscheduled` |
| `getWeekRevenueVsTarget` | GET | `/api/ops/week-revenue?week=YYYY-MM-DD` |
| `getDailyRevenueTarget` | GET | `/api/ops/daily-revenue-target` |
| `setDailyRevenueTarget` | PUT | `/api/ops/daily-revenue-target` |
| `listQuoteFollowUps` | GET | `/api/ops/quote-follow-ups` |
| `updateQuoteFollowUpDraft` | PATCH | `/api/ops/quote-follow-ups/:id` |
| `approveQuoteFollowUp` | POST | `/api/ops/quote-follow-ups/:id/approve` |
| `listInvoicesNotInXero` | GET | `/api/ops/invoices-not-in-xero` |
| `syncInvoiceToXero` | POST | `/api/ops/invoices-not-in-xero/:id/sync` |
| `listJobsNotBilled` | GET | `/api/ops/jobs-not-billed` |

`week` is any NZ calendar day. It snaps to the Monday–Sunday week (same week as Staff Schedule). Omit it for the week that contains today in Pacific/Auckland. Each day's `scheduledRevenueExGst` matches the Despatch day bar (`jobRevenue`: line items ex GST, then subtotal, then GST-inclusive totals ÷ 1.15, split across booked NZ days, quotes and leads excluded). `gapToTarget` is `dailyRevenueTarget - scheduledRevenueExGst` (positive means short). Both are `null` when no target is stored.

`listUnscheduled` is Despatch **Unscheduled**: `status = work_order` and not `hasUpcomingBookingNZ`. `scheduledDates` wins when non-empty; otherwise `scheduledDate` through `scheduledEndDate`. A last NZ day on or after today NZ is scheduled. `quoteExGst` is the full exc-GST quote (not the per-day split). `lastBookingNzDate` is set only when that last day is already past. `internalNotes` is the staff/gear note, capped at 400 characters. Team ids come from `assignedTeam`, `assignedTo`, and `assignedStaffIds`; names are filled only for employees of the same business. The list is capped at 200 (`truncated`, `total`).

## Links

- Job: `{APP_URL}/dispatch?job={id}`
- Despatch (default filter is Unscheduled): `{APP_URL}/dispatch`
- Daily target: `{APP_URL}/settings/preferences`

## Quote follow-ups

`listQuoteFollowUps` returns waiting and snoozed drafts for the signed-in business, including the message, subject, channel, and links. It does not send anything. A row can be a `quotes` table quote, a proposal (the document customers are emailed or texted), or a job whose quote was presented on site. One open item per job. A re-quote preview is included when the quote has expired. Approving is what creates the new draft. Detection does not.

`updateQuoteFollowUpDraft` edits `message`, `subject`, or `channel` on a draft or snoozed row. It does not send.

`approveQuoteFollowUp` sends only when the JSON body is `{ "confirm": true }`. Any other body, including `{ "confirm": "true" }` or `{ "confirm": false }`, returns 400 and does not call the sender. The same flag is required on the in-app `POST /api/quote-follow-ups/:id/approve`. A send is written to the job diary as a normal email or SMS entry.

Links:

- Queue: `{APP_URL}/quote-follow-ups`
- One draft: `{APP_URL}/quote-follow-ups?id={followUpId}`
- Settings: `{APP_URL}/settings/quote-followup`

## Invoices not in Xero

`listInvoicesNotInXero` is read-only. It returns invoices that were emailed or texted to the customer and are not in Xero (no Xero invoice id, or a pending, failed, or error sync). Each row includes the preview of the contact, line items, totals, GST, and account code that Approve & Sync would create. It does not call Xero.

`syncInvoiceToXero` calls the same Xero send as the Invoices page only when the JSON body is `{ "confirm": true }` and the caller is an admin (session admin, or a scoped key — the same gate as `setDailyRevenueTarget`). Any other body, including `{ "confirm": "true" }` or `{ "confirm": false }`, returns 400 and does not call Xero. A non-admin with `confirm: true` returns 403 and does not call Xero. The same flag is required on the in-app `POST /api/invoice-xero-follow-ups/:id/sync`. Success and failure are written to the job diary by that send.

Links:

- Not in Xero tab: `{APP_URL}/quote-follow-ups?tab=xero`
- One invoice: `{APP_URL}/quote-follow-ups?tab=xero&id={followUpId}`

## Completed jobs not billed

`listJobsNotBilled` is read only. It returns completed jobs that have no invoice, or an invoice that has not been emailed or texted to the customer. Each row includes the next step (`create_invoice` or `send_invoice`), the draft invoice preview when the step is create, and a link to the job. A sent invoice that is not in Xero is not in this list. That job is only on `listInvoicesNotInXero`.

There is no Ops route that creates an invoice, sends one, or syncs one. Those actions stay on the signed-in Follow-ups screen, and each needs `{ "confirm": true }`.

Links:

- Not billed tab: `{APP_URL}/quote-follow-ups?tab=billed`
- One job: `{APP_URL}/dispatch?job={jobId}`

## Not in this phase

Book, reschedule, fill-day bundling, gear conflicts.
