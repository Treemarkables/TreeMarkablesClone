// Fill empty job-contact columns from a customer or a conversation/diary
// source. Never overwrites a non-empty job field.
//
// Name is copied only when BOTH first and last are empty, so a saved person
// who already has a name is not completed from a different customer record.
// Phone is copied only when the job has neither phone nor mobile, and a single
// number is written to one column (NZ mobiles go to mobile). That avoids
// stamping the same number into both phone inputs.

export type JobContactFields = {
  jobContactFirstName?: string | null;
  jobContactLastName?: string | null;
  jobContactEmail?: string | null;
  jobContactPhone?: string | null;
  jobContactMobile?: string | null;
};

export type ContactSource = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
};

export type DiaryEntryLike = {
  entryType?: string | null;
  description?: string | null;
  metadata?: unknown;
};

export type ThreadMessageLike = {
  fromName?: string | null;
  fromContact?: string | null;
  content?: string | null;
};

export function isBlank(value: unknown): boolean {
  return value == null || String(value).trim() === "";
}

// The conversation-create shape: a phone may be stored, but the job has no
// person name and no email. Used to decide a one-time repair. Once either a
// name or an email is stored, a later clear of the other field must stick.
export function isUnnamedJobContact(job: JobContactFields): boolean {
  return (
    isBlank(job.jobContactFirstName) &&
    isBlank(job.jobContactLastName) &&
    isBlank(job.jobContactEmail)
  );
}

export function isNzMobile(phone: string): boolean {
  const clean = phone.replace(/[\s\-()]/g, "");
  return /^(\+?64)?0?2[0-9]/.test(clean);
}

export function usableEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  const angle = value.match(/<([^<>\s]+@[^<>\s]+)>/);
  const raw = (angle ? angle[1] : value).trim();
  if (!raw || /\s/.test(raw) || !raw.includes("@")) return "";
  return raw;
}

export function splitPersonName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  if (trimmed.includes(",")) {
    const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { firstName: parts[1], lastName: parts[0] };
    }
  }
  const parts = trimmed.split(/\s+/);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
}

export function fillEmptyJobContact(
  job: JobContactFields,
  source: ContactSource,
): Partial<JobContactFields> {
  const patch: Partial<JobContactFields> = {};

  const namesEmpty = isBlank(job.jobContactFirstName) && isBlank(job.jobContactLastName);
  const sourceName = (source.name || "").trim();
  if (namesEmpty && sourceName && sourceName.toLowerCase() !== "unknown") {
    const { firstName, lastName } = splitPersonName(sourceName);
    if (firstName) patch.jobContactFirstName = firstName;
    if (lastName) patch.jobContactLastName = lastName;
  }

  const email = usableEmail(source.email);
  if (isBlank(job.jobContactEmail) && email) {
    patch.jobContactEmail = email;
  }

  const phonesEmpty = isBlank(job.jobContactPhone) && isBlank(job.jobContactMobile);
  if (phonesEmpty) {
    const placed = placePhoneNumbers(source.mobile, source.phone);
    if (placed.mobile) patch.jobContactMobile = placed.mobile;
    if (placed.phone) patch.jobContactPhone = placed.phone;
  }

  return patch;
}

export function fillEmptyJobContactFromSources(
  job: JobContactFields,
  sources: ContactSource[],
): Partial<JobContactFields> {
  let current: JobContactFields = { ...job };
  let patch: Partial<JobContactFields> = {};
  for (const source of sources) {
    const next = fillEmptyJobContact(current, source);
    if (Object.keys(next).length === 0) continue;
    patch = { ...patch, ...next };
    current = { ...current, ...next };
  }
  return patch;
}

// Latest outbound diary email address. Diary send stores it on metadata.to
// and also in the description ("Email sent to …").
export function emailAddressFromDiary(entries: DiaryEntryLike[]): string {
  for (const entry of entries) {
    if (entry.entryType && entry.entryType !== "email") continue;
    const meta = entry.metadata && typeof entry.metadata === "object"
      ? entry.metadata as Record<string, unknown>
      : {};
    for (const key of ["to", "emailAddress", "recipient"]) {
      const email = usableEmail(meta[key]);
      if (email) return email;
    }
    const described = (entry.description || "").match(/Email sent to\s+(\S+@\S+)/i);
    if (described) {
      const email = usableEmail(described[1].replace(/[>,.;]+$/, ""));
      if (email) return email;
    }
  }
  return "";
}

// Name / email / phone sitting on a conversation thread (contact-form body
// or the sender address), used when the customer row doesn't have them.
export function contactFromThread(messages: ThreadMessageLike[]): ContactSource {
  let name = "";
  let email = "";
  let phone = "";
  for (const message of messages) {
    if (!name && message.fromName && message.fromName.trim()) {
      name = message.fromName.trim();
    }
    const from = (message.fromContact || "").trim();
    if (!email) email = usableEmail(from);
    if (!phone && from && !from.includes("@") && /\d/.test(from)) {
      phone = from;
    }
    const content = message.content || "";
    if (!email) {
      const match = content.match(/Email:\s*([^\s<>]+@[^\s<>]+)/i);
      if (match) email = usableEmail(match[1]);
    }
    if (!name) {
      const match = content.match(/^Name:\s*(.+)$/im);
      if (match && match[1].trim()) name = match[1].trim();
    }
    if (!phone) {
      const match = content.match(/Phone:\s*([0-9+\s\-()]+)/i);
      if (match && match[1].trim()) phone = match[1].trim();
    }
    if (name && email && phone) break;
  }
  return { name, email, phone };
}

function placePhoneNumbers(
  mobile: string | null | undefined,
  phone: string | null | undefined,
): { mobile: string; phone: string } {
  const out = { mobile: "", phone: "" };
  const seen = new Set<string>();
  for (const raw of [mobile, phone]) {
    const value = (raw || "").trim();
    if (!value) continue;
    const key = value.replace(/[\s\-()]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    if (isNzMobile(value)) {
      if (!out.mobile) out.mobile = value;
    } else if (!out.phone) {
      out.phone = value;
    }
  }
  return out;
}
