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

`week` is any NZ calendar day. It snaps to the Monday–Sunday week (same week as Staff Schedule). Omit it for the week that contains today in Pacific/Auckland. Each day's `scheduledRevenueExGst` matches the Despatch day bar (`jobRevenue`: line items ex GST, then subtotal, then GST-inclusive totals ÷ 1.15, split across booked NZ days, quotes and leads excluded). `gapToTarget` is `dailyRevenueTarget - scheduledRevenueExGst` (positive means short). Both are `null` when no target is stored.

`listUnscheduled` is Despatch **Unscheduled**: `status = work_order` and not `hasUpcomingBookingNZ`. `scheduledDates` wins when non-empty; otherwise `scheduledDate` through `scheduledEndDate`. A last NZ day on or after today NZ is scheduled. `quoteExGst` is the full exc-GST quote (not the per-day split). `lastBookingNzDate` is set only when that last day is already past. `internalNotes` is the staff/gear note, capped at 400 characters. Team ids come from `assignedTeam`, `assignedTo`, and `assignedStaffIds`; names are filled only for employees of the same business. The list is capped at 200 (`truncated`, `total`).

## Links

- Job: `{APP_URL}/dispatch?job={id}`
- Despatch (default filter is Unscheduled): `{APP_URL}/dispatch`
- Daily target: `{APP_URL}/settings/preferences`

## Quote follow-ups

`listQuoteFollowUps` returns waiting and snoozed drafts for the signed-in business, including the message, subject, channel, and links. It does not send anything.

`updateQuoteFollowUpDraft` edits `message`, `subject`, or `channel` on a draft or snoozed row. It does not send.

`approveQuoteFollowUp` sends only when the JSON body is `{ "confirm": true }`. Any other body, including `{ "confirm": "true" }` or `{ "confirm": false }`, returns 400 and does not call the sender. The same flag is required on the in-app `POST /api/quote-follow-ups/:id/approve`. A send is written to the job diary as a normal email or SMS entry.

Links:

- Queue: `{APP_URL}/quote-follow-ups`
- One draft: `{APP_URL}/quote-follow-ups?id={followUpId}`
- Settings: `{APP_URL}/settings/quote-followup`

## Not in this phase

Book, reschedule, fill-day bundling, gear conflicts.
