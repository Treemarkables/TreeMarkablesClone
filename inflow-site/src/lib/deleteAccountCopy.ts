import { LIVE_APP_ORIGIN } from "./signupLink";

/** Public account-deletion facts. The React page and the no-JS HTML both read this. */
export const DELETE_APP_NAME = "Inflow";
export const DELETE_DEVELOPER = "INFLOW LIMITED";
export const DELETE_EMAIL = "accounts@inflowapp.co.nz";
export const DELETE_SUBJECT = "Delete my Inflow account";

export const DELETE_PAGE_PATH = "/delete-account";
export const DELETE_PAGE_URL = "https://inflowapp.co.nz/delete-account";
export const DELETE_DOCUMENT_TITLE = "Delete your Inflow account — Inflow";
export const DELETE_PAGE_HEADING = "Delete your Inflow account";
export const DELETE_UPDATED = "October 2026";
export const DELETE_DESCRIPTION =
  "How to ask INFLOW LIMITED to delete your Inflow account and associated data, what is removed, what is kept, and how long it takes. No sign-in required.";

export const DELETE_LOGIN_URL = `${LIVE_APP_ORIGIN}/login`;
export const DELETE_SIGNUP_URL = `${LIVE_APP_ORIGIN}/signup`;

export const DELETE_MAILTO = `mailto:${DELETE_EMAIL}?subject=${encodeURIComponent(DELETE_SUBJECT)}&body=${encodeURIComponent(
  "Business name:\n\nPlease delete my Inflow account and the data associated with it.\n",
)}`;

export const DELETE_INTRO = `${DELETE_APP_NAME} is a job-management app for trades and field-service businesses. It is developed and operated by ${DELETE_DEVELOPER}, Gisborne, New Zealand. This page explains how to ask us to delete an ${DELETE_APP_NAME} account and the data that goes with it. You do not need to sign in.`;

export const DELETE_STEPS_LEAD =
  "Follow these steps. The request is free and does not need an Inflow login.";

export const DELETE_DISCLAIMER =
  "This page explains our account-deletion process in plain English. It is not legal advice.";

export const DELETE_STEPS = [
  `From the email address on the ${DELETE_APP_NAME} account, send an email to ${DELETE_EMAIL}.`,
  `Use the subject line "${DELETE_SUBJECT}".`,
  "Include the business name on the account, and say that you want the account and its associated data deleted.",
  "We reply to that same email address to confirm the request is from the account holder.",
  "We then delete the account and the associated data listed on this page within 30 days, and we email you when that is finished.",
];

export const DELETE_REMOVED_LEAD =
  "After we confirm the request, we delete the following. Records listed under what we keep are retained only for the period stated there.";

export const DELETE_REMOVED = [
  "The Inflow account and the ability to sign in",
  "Profile and business details, including name, email, phone and address",
  "Staff profiles on the account",
  "Customers and their contact details",
  "Jobs, quotes, proposals, schedules and messages",
  "Photos, videos, documents and other files stored for the account",
  "Invoices and other billing details we are not required to keep",
];

export const DELETE_KEPT = [
  "Invoices and other financial records that New Zealand tax law requires us to keep. That period is typically 7 years. We delete them when the retention period ends.",
  "Backup copies of deleted data, which are purged within 30 days.",
  "Information we must keep for a legal claim or another legal duty, and only for as long as that duty lasts.",
];

export const DELETE_TIMEFRAME = `We complete a confirmed deletion within 30 days. Backup copies are purged within 30 days of that deletion.`;

export const DELETE_OWN_LOGIN = `If you are signed in, open Settings and then Account. That clears your name, email and phone and signs you out. Customers, jobs, photos and invoices stay on the business until you send the deletion email above.`;

export const DELETE_QUESTIONS = `Questions about a deletion request go to ${DELETE_EMAIL}. For how we handle personal information generally, see the Privacy Policy.`;

export type StepPart = { type: "text" | "email" | "subject"; value: string };

/** Split a step so the email address and subject can be linked or emphasised. */
export function stepParts(step: string): StepPart[] {
  const marks: Array<{ type: "email" | "subject"; value: string }> = [
    { type: "email", value: DELETE_EMAIL },
    { type: "subject", value: DELETE_SUBJECT },
  ];
  const parts: StepPart[] = [];
  let rest = step;
  while (rest.length > 0) {
    let nextAt = -1;
    let next: (typeof marks)[number] | null = null;
    for (const mark of marks) {
      const at = rest.indexOf(mark.value);
      if (at !== -1 && (nextAt === -1 || at < nextAt)) {
        nextAt = at;
        next = mark;
      }
    }
    if (!next || nextAt === -1) {
      parts.push({ type: "text", value: rest });
      break;
    }
    if (nextAt > 0) parts.push({ type: "text", value: rest.slice(0, nextAt) });
    parts.push({ type: next.type, value: next.value });
    rest = rest.slice(nextAt + next.value.length);
  }
  return parts;
}
