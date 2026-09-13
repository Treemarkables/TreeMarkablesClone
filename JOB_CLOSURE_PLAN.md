# Job closure answers — plan

**Branch:** `claude/job-closure-invoicing-workflow-ce2fc3`
**Status:** design agreed, not built.

The crew's end-of-job tick-boxes become **questions that require an answer**, not
boxes that require a tick. An answer is `yes` or `no + a reason`. "No" is a
first-class, countable outcome — that is the whole point: a wall of ticks tells
you nothing, "customer drove off before the talk" × 14 tells you something.

---

## 1. Three moments, three different strengths

The mistake to avoid is treating "crew finishes" / "job closes" / "invoice goes"
as one event. They are owned by different people and must gate differently.

| Moment | Where | Strength |
|--------|-------|----------|
| Crew stops the clock | `POST /api/timer/stop`, `/api/jobs/:id/timers/stop-all` (`JobTimerControl.tsx`) | **Never gated.** Stopping the timer always succeeds. |
| Job closes | `jobs.status → 'completed'` | **Hard gate.** Every enabled question needs an answer, or a logged force-close. |
| Invoice goes out | `invoiceEligible` / "Create invoice" (`JobBillingPanel.tsx`) | **Warning only.** Admin can always proceed. |

### Why the timer stop is not gated

Gating the stop button changes *when people press stop* — crews press it early at
the truck, or late back at the yard. Either way `staff_time_entries` drifts and
back-costing (the number this app competes on) quietly degrades. So: when the
**last** timer on a job stops, the closure sheet is *offered* immediately — that
is the truck moment, when the answers are actually known — but dismissing it
stops the clock anyway and leaves the job open. The gate lands later, on close.

### Why the invoice is not gated on the crew

Cash must never be hostage to a checkbox someone else owns. Unanswered or `no`
answers surface as a line in the existing **Invoice Protection** block
(`invoiceBlocked` / `marginMeetsThreshold` / `invoiceEligible`, computed by
`storage.updateInvoiceEligibility`) — advisory, overridable, visible to admin.

---

## 2. Reasons are preset data, not free text

Free text degrades to "n/a" and "." inside a fortnight, and a text column cannot
be counted. Each question carries 4–5 pickable reasons; a note is optional and
additive, never the default path. Because a reason is a stable slug,
`SELECT reason_id, COUNT(*)` answers the only question that matters: is this a
training problem (one crew) or a process problem (everyone)?

A reason can also **spawn the follow-up** rather than just being filed. The
machinery already exists — `tasks` has `linkedJobId`, `assigneeId`, `dueDate` —
so "customer wasn't there for the talk" inserts a callback task assigned to
someone, and the loop closes.

---

## 3. Break-glass

Every hard gate without an override eventually produces a job that is stuck
forever, and the workaround people invent for that is always worse than the gap
the gate was closing. Phone died, the guy is on leave, the guy has left — someone
senior force-closes with a reason attached.

- Admin/owner permission only.
- Reason required (preset list + optional note).
- Recorded on the job (`closureForcedAt` / `closureForcedBy` / `closureForcedReason`)
  **and** appended to the job diary (`job_diary_entries`, `entryType: 'completion'`)
  so it is visible in the job's own timeline with no new UI.
- Counted separately from answered closes. A rising force-close count is itself
  the signal that a question is badly worded or impossible to answer.

---

## 4. Interaction budget — taps only

Target: **under 30 seconds at the truck, no keyboard in the default path.**

- One card per question, large `Yes` / `No`.
- `No` reveals the reason chips inline — tap one, done.
- Note collapsed behind "Add note"; never required.
- N questions ≈ N + 1 taps for an all-yes close.

If the default path ever needs typing, the design has failed and crews will start
gaming the clock instead.

---

## 5. Schema

Mirrors the established `quoting_process_steps` + `job_quoting_process_completions`
pattern: per-business rows, built-ins seeded and lockable-but-not-deletable, stable
`item_id` slug so renaming a label never orphans history. New tables are created
idempotently in the `server/index.ts` startup migration block — **no `db:push`**.

```
job_closure_questions
  business_id, id, item_id (slug), label, sort_order,
  is_enabled, is_built_in, required_for_close

job_closure_question_reasons
  business_id, id, question_item_id, reason_id (slug), label, sort_order,
  is_built_in, spawns_follow_up, follow_up_title, follow_up_assignee_role

job_closure_answers
  business_id, id, job_id, item_id,
  answer ('yes' | 'no'), reason_id (required when 'no'), note,
  answered_by_employee_id, answered_by_name, answered_at
  UNIQUE (job_id, item_id)

jobs (added columns)
  closure_forced_at, closure_forced_by, closure_forced_reason
```

`job_checklist_completions` stays as-is — it is the *during-the-job* checklist and
is a different thing from closure answers. No migration of existing rows.

---

## 6. Build order

1. Schema + startup migration + built-in question/reason seeds.
2. `GET/POST /api/jobs/:id/closure-answers`; close gate on the status transition.
3. Closure sheet UI (mobile-first — `JobCardMobile` / `JobDetailsPanel`).
4. Offer-on-last-timer-stop hook.
5. Force-close (permission + reason + diary entry).
6. Follow-up task spawning from flagged reasons.
7. Invoice-side advisory line in `JobBillingPanel`.
8. Settings screen for questions/reasons (mirrors `RoleChecklistSettings.tsx`).

Slices 1–3 are the minimum that is worth shipping. 4–7 are each independently
useful. 8 can trail — built-ins cover the first tenant.
