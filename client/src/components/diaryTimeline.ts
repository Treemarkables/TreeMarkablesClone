/**
 * Pure diary timeline helpers.
 *
 * The job-card diary builds one list from /api/jobs/:id/diary plus proposals,
 * then renders every row in a single React tree. Two shapes from production
 * have to survive that path:
 * - an outbound "Proposal Sent" email whose content column is NULL (the text
 *   lives in description)
 * - an inbound Apple Mail reply whose description is blank, so the full HTML
 *   document in content is what gets rendered
 *
 * A throw in either place used to reject the React Query (retry: true, so the
 * panel stayed on "Loading…" forever) or crash the whole list.
 */
import { formatInTimeZone } from "date-fns-tz";

export interface DiaryEntry {
  id: string;
  type:
    | "note"
    | "sms"
    | "email"
    | "job_event"
    | "proposal"
    | "quote"
    | "call"
    | "photo";
  title: string;
  content: string;
  author: string;
  timestamp: string;
  photoUrl?: string;
  photos?: string[];
  tags?: string[];
  metadata?: {
    phoneNumber?: string;
    emailAddress?: string;
    fromEmail?: string;
    proposalNumber?: string;
    eventType?: string;
    status?: string;
    viewedDate?: string;
    replyAcknowledged?: boolean;
    recipient?: string;
    sendgridMessageId?: string;
    messageId?: string;
    invoiceId?: string;
    invoiceNumber?: string;
    documentNumber?: string;
    documentType?: string;
    action?: string;
    isDeletable?: boolean;
    recordingUrl?: string;
    transcription?: string;
    sentiment?: string;
    unreadable?: boolean;
    [key: string]: unknown;
  };
}

export interface DiaryTimelineSources {
  diary: unknown;
  proposals: unknown;
  servicem8: unknown;
  schedule: unknown;
}

type JsonRequest = (
  method: string,
  url: string,
) => Promise<{ json: () => Promise<unknown> }>;

export function diaryText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function payloadData(value: unknown): unknown[] {
  if (typeof value !== "object" || value === null || !("data" in value)) return [];
  const data = (value as { data: unknown }).data;
  return Array.isArray(data) ? data : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Drop tags without a backtracking scan. `>` inside an attribute ends the tag. */
export function stripHtmlToText(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const lt = input.indexOf("<", i);
    if (lt === -1) {
      out += input.slice(i);
      break;
    }
    out += input.slice(i, lt);
    const gt = input.indexOf(">", lt + 1);
    if (gt === -1) {
      out += input.slice(lt);
      break;
    }
    const tag = input.slice(lt, gt + 1);
    if (/^<br\s*\/?>$/i.test(tag) || /^<\/p>$/i.test(tag)) out += "\n";
    i = gt + 1;
  }
  return out.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Drop a trailing "On … wrote:" quote header. The previous regex
 * (`On .+? at .+? .+? <.+?> wrote:`) is exponential on a long miss and froze
 * the tab. This only inspects a bounded tail.
 */
export function stripTrailingOnWrote(text: string): string {
  const marker = text.lastIndexOf("\nOn ");
  const start = marker === -1 ? (text.startsWith("On ") ? 0 : -1) : marker;
  if (start === -1) return text;
  const tail = text.slice(start);
  if (tail.length > 2000) return text;
  if (/wrote:\s*$/i.test(tail)) return text.slice(0, start).replace(/\s+$/, "");
  return text;
}

export function cleanDiaryContent(
  content: string | null | undefined,
  type: string,
): string {
  if (!content) return "";
  let cleaned = diaryText(content);
  cleaned = cleaned.replace(/^SMS sent to [^\n]+\n\n/i, "");
  cleaned = cleaned.replace(/^Email sent to [^\n]+\n\n/i, "");
  cleaned = cleaned.replace(/^Message:\s*/i, "");
  if (type === "email") cleaned = stripTrailingOnWrote(cleaned);
  return cleaned.trim();
}

function cutAtPlainHeader(text: string, label: "From" | "Sent"): string {
  const needle = `\n${label}:`;
  const lower = text.toLowerCase();
  const at = lower.indexOf(needle.toLowerCase());
  if (at === -1) return text;
  return text.slice(0, at);
}

export function emailBubbleMessage(entry: {
  title?: unknown;
  content?: unknown;
}): { text: string; isSent: boolean; isReceived: boolean; recipientInfo: string } {
  const title = diaryText(entry.title);
  const titleLower = title.toLowerCase();
  const content = diaryText(entry.content);
  const contentLower = content.toLowerCase();
  const isSent =
    titleLower.includes("sent") ||
    contentLower.includes("email sent to") ||
    contentLower.includes("sms sent to");
  const isReceived = titleLower.includes("reply") || titleLower.includes("from");

  let messageText = content;
  let recipientInfo = "";

  if (isSent && messageText.includes("Message:")) {
    const beforeMessage = messageText.split("Message:")[0] ?? "";
    if (beforeMessage.includes("Email sent to")) {
      recipientInfo = beforeMessage.split("Email sent to")[1]?.trim() ?? "";
    } else if (beforeMessage.includes("SMS sent to")) {
      recipientInfo = beforeMessage.split("SMS sent to")[1]?.trim() ?? "";
    }
    messageText = stripHtmlToText(messageText.split("Message:")[1] ?? "").trim();
  } else if (isReceived && messageText.includes(":\n\n")) {
    messageText = messageText.split(":\n\n")[1]?.trim() ?? "";
  }

  if (isReceived) {
    messageText = stripHtmlToText(messageText);
    messageText = cutAtPlainHeader(messageText, "From");
    messageText = cutAtPlainHeader(messageText, "Sent");
    messageText = messageText.trim();
  }

  return { text: messageText, isSent, isReceived, recipientInfo };
}

/** Photo object paths stored on a diary row. photos[] wins; photoUrl is the legacy single. */
export function emailEntryPhotoUrls(entry: {
  photos?: readonly string[] | null;
  photoUrl?: string | null;
}): string[] {
  const fromList = Array.isArray(entry.photos)
    ? entry.photos.filter((url): url is string => typeof url === "string" && url.length > 0)
    : [];
  if (fromList.length > 0) return fromList;
  if (typeof entry.photoUrl === "string" && entry.photoUrl.length > 0) return [entry.photoUrl];
  return [];
}

/**
 * Drop the grey "Photos: N photo(s) embedded" note once the row has real
 * photo paths to render as thumbnails. Old rows with a null photos column
 * keep the note. The pattern is line-bounded so a long miss stays linear.
 */
export function hideEmbeddedPhotoNote(text: string, hasStoredPhotos: boolean): string {
  if (!hasStoredPhotos || !text) return text;
  if (!/photos:/i.test(text)) return text;
  const stripped = text.replace(
    /[^\S\n]*Photos:\s*\d+\s*photo\(s\)\s*embedded[^\S\n]*/gi,
    "",
  );
  return stripped.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function formatDiaryTimestamp(
  timestamp: unknown,
  pattern = "h:mm a dd/MM/yy",
): string {
  try {
    const date =
      timestamp instanceof Date
        ? timestamp
        : new Date(typeof timestamp === "string" || typeof timestamp === "number" ? timestamp : "");
    if (Number.isNaN(date.getTime())) return "";
    return formatInTimeZone(date, "Pacific/Auckland", pattern);
  } catch {
    return "";
  }
}

const ENTRY_TYPES = new Set([
  "note",
  "sms",
  "email",
  "job_event",
  "proposal",
  "quote",
  "call",
  "photo",
]);

function diaryType(entryType: string): DiaryEntry["type"] {
  if (entryType === "note") return "note";
  if (entryType === "proposal") return "proposal";
  if (entryType === "photo") return "photo";
  if (entryType === "email") return "email";
  if (entryType === "sms") return "sms";
  if (entryType === "call") return "call";
  return "job_event";
}

function unreadableEntry(id: string): DiaryEntry {
  return {
    id,
    type: "note",
    title: "Diary entry",
    content: "This entry couldn't be displayed.",
    author: "System",
    timestamp: new Date(0).toISOString(),
    metadata: { unreadable: true },
  };
}

function normalizeLocalRow(entry: unknown, index: number): DiaryEntry {
  const row = asRecord(entry);
  const entryType = diaryText(row.entryType || row.entry_type);
  const title = diaryText(row.title) || "Diary entry";
  const photoUrl = diaryText(row.photoUrl || row.photo_url) || undefined;
  const rawPhotos = row.photos;
  const photosArr = Array.isArray(rawPhotos)
    ? rawPhotos.filter((u): u is string => typeof u === "string" && u.length > 0)
    : undefined;
  const photos =
    photosArr && photosArr.length > 0 ? photosArr : photoUrl ? [photoUrl] : undefined;
  const meta = asRecord(row.metadata);
  const id = diaryText(row.id) || `diary-${index}`;
  const type = diaryType(entryType);
  return {
    id,
    type: ENTRY_TYPES.has(type) ? type : "job_event",
    title,
    content: diaryText(row.description || row.content),
    author: diaryText(row.authorName || row.author_name) || "System",
    timestamp: diaryText(row.createdAt || row.created_at),
    photoUrl,
    photos,
    tags: Array.isArray(row.tags)
      ? row.tags.filter((t): t is string => typeof t === "string")
      : undefined,
    metadata: {
      ...meta,
      eventType: entryType,
      proposalNumber:
        entryType === "proposal"
          ? title.replace("Proposal Created: ", "")
          : undefined,
    },
  };
}

function normalizeProposal(proposal: unknown, index: number): DiaryEntry {
  const row = asRecord(proposal);
  const isQuote = row.templateUsed === "quote";
  const proposalNumber = diaryText(row.proposalNumber);
  return {
    id: diaryText(row.id) || `proposal-${index}`,
    type: isQuote ? "quote" : "proposal",
    title: `${isQuote ? "Quote" : "Proposal"} Created: ${proposalNumber}`,
    content: diaryText(row.title || row.description),
    author: diaryText(row.createdBy) || "System",
    timestamp: diaryText(row.createdAt),
    metadata: {
      proposalNumber,
      status: diaryText(row.status) || undefined,
      viewedDate: diaryText(row.viewedDate) || undefined,
      isDeletable: false,
    },
  };
}

function normalizeServiceM8(entry: unknown, index: number): DiaryEntry {
  const row = asRecord(entry);
  const entryType = diaryText(row.entryType);
  const entryDate = row.entryDate ? new Date(diaryText(row.entryDate)) : null;
  const createdAt = row.createdAt ? new Date(diaryText(row.createdAt)) : null;
  const type: DiaryEntry["type"] =
    entryType === "Note"
      ? "note"
      : entryType === "Scheduled" || entryType === "Completed"
        ? "job_event"
        : entryType === "CallLog"
          ? "call"
          : "note";
  const title =
    entryType === "Note"
      ? "ServiceM8 Note"
      : entryType === "Scheduled"
        ? "ServiceM8 Scheduled"
        : entryType === "Completed"
          ? "ServiceM8 Completed"
          : entryType === "CallLog"
            ? "ServiceM8 Call"
            : "ServiceM8 Entry";
  const timestamp =
    entryDate && !Number.isNaN(entryDate.getTime())
      ? entryDate.toISOString()
      : createdAt && !Number.isNaN(createdAt.getTime())
        ? createdAt.toISOString()
        : new Date().toISOString();
  return {
    id: `servicem8-${diaryText(row.id) || index}`,
    type,
    title,
    content: diaryText(row.note) || "No content",
    author: "ServiceM8 User",
    timestamp,
    metadata: {
      eventType: entryType || undefined,
      status: row.active ? "active" : "inactive",
    },
  };
}

function normalizeBookings(assignments: unknown[]): DiaryEntry[] {
  const timeSlotGroups = new Map<string, Record<string, unknown>[]>();
  for (const raw of assignments) {
    const assignment = asRecord(raw);
    const key = `${diaryText(assignment.startTime)}-${diaryText(assignment.endTime)}`;
    const group = timeSlotGroups.get(key);
    if (group) group.push(assignment);
    else timeSlotGroups.set(key, [assignment]);
  }

  const entries: DiaryEntry[] = [];
  timeSlotGroups.forEach((group) => {
    const first = group[0];
    if (!first) return;
    const startTime = diaryText(first.startTime) ? new Date(diaryText(first.startTime)) : null;
    const endTime = diaryText(first.endTime) ? new Date(diaryText(first.endTime)) : null;
    const staffNames = group.map((a) => {
      const named = diaryText(a.employeeName);
      if (named) return named;
      const employee = asRecord(a.employee);
      const combined = `${diaryText(employee.firstName)} ${diaryText(employee.lastName)}`.trim();
      return combined || "Staff";
    });
    const timeStr =
      startTime && !Number.isNaN(startTime.getTime())
        ? formatDiaryTimestamp(startTime, "h:mm a")
        : "";
    const dateStr =
      startTime && !Number.isNaN(startTime.getTime())
        ? formatDiaryTimestamp(startTime, "dd/MM/yyyy")
        : "";
    const endTimeStr =
      endTime && !Number.isNaN(endTime.getTime())
        ? formatDiaryTimestamp(endTime, "h:mm a")
        : "";
    const staffList =
      staffNames.length === 1
        ? staffNames[0]
        : staffNames.slice(0, -1).join(", ") + " & " + staffNames[staffNames.length - 1];
    const ids = group.map((a) => diaryText(a.id)).filter(Boolean);
    entries.push({
      id: `booking-${ids.join("-") || entries.length}`,
      type: "job_event",
      title: "Staff Scheduled",
      content: `${staffList} scheduled for ${dateStr} at ${timeStr}${endTimeStr ? ` - ${endTimeStr}` : ""}`,
      author: "System",
      timestamp:
        diaryText(first.createdAt) ||
        (startTime && !Number.isNaN(startTime.getTime()) ? startTime.toISOString() : new Date().toISOString()),
      metadata: {
        eventType: "staff_booking",
        assignmentIds: ids,
        employeeIds: group.map((a) => diaryText(a.employeeId)).filter(Boolean),
        staffNames,
        startTime: diaryText(first.startTime) || undefined,
        endTime: diaryText(first.endTime) || undefined,
        status: diaryText(first.status) || undefined,
      },
    });
  });
  return entries;
}

function sortNewestFirst(entries: DiaryEntry[]): DiaryEntry[] {
  return entries.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    if (Number.isNaN(tb) && Number.isNaN(ta)) return 0;
    if (Number.isNaN(tb)) return 1;
    if (Number.isNaN(ta)) return -1;
    return tb - ta;
  });
}

/** Merge the four diary sources. One bad row becomes a fallback entry. */
export function assembleDiaryEntries(sources: DiaryTimelineSources): DiaryEntry[] {
  const entries: DiaryEntry[] = [];

  payloadData(sources.diary).forEach((entry, index) => {
    try {
      entries.push(normalizeLocalRow(entry, index));
    } catch {
      const id = diaryText(asRecord(entry).id) || `diary-unreadable-${index}`;
      entries.push(unreadableEntry(id));
    }
  });

  payloadData(sources.proposals).forEach((proposal, index) => {
    try {
      entries.push(normalizeProposal(proposal, index));
    } catch {
      entries.push(unreadableEntry(`proposal-unreadable-${index}`));
    }
  });

  const serviceRows = payloadData(sources.servicem8);
  if (serviceRows.length > 0) {
    serviceRows.forEach((entry, index) => {
      try {
        entries.push(normalizeServiceM8(entry, index));
      } catch {
        entries.push(unreadableEntry(`servicem8-unreadable-${index}`));
      }
    });
  }

  const scheduleRows = payloadData(sources.schedule);
  if (scheduleRows.length > 0) {
    try {
      entries.push(...normalizeBookings(scheduleRows));
    } catch {
      entries.push(unreadableEntry("booking-unreadable"));
    }
  }

  const seenMessageIds = new Set<string>();
  const seenDbIds = new Set<string>();
  const uniqueEntries = entries.filter((entry) => {
    if (entry.id) {
      if (seenDbIds.has(entry.id)) return false;
      seenDbIds.add(entry.id);
    }
    const msgId = entry.metadata?.messageId;
    if (typeof msgId === "string" && msgId) {
      if (seenMessageIds.has(msgId)) return false;
      seenMessageIds.add(msgId);
    }
    return true;
  });

  return sortNewestFirst(uniqueEntries);
}

/**
 * Diary and proposals used to share one Promise.all with no catch on either.
 * A proposals failure rejected the whole query, and retry: true retried forever.
 * Proposals, ServiceM8, and staff bookings are optional. The diary request is not.
 */
export async function fetchDiaryTimelineSources(
  urls: { diary: string; proposals: string; servicem8: string; assignments: string },
  request: JsonRequest,
): Promise<DiaryTimelineSources> {
  const [diary, proposals, servicem8, schedule] = await Promise.all([
    request("GET", urls.diary).then((res) => res.json()),
    request("GET", urls.proposals)
      .then((res) => res.json())
      .catch(() => ({ data: [] })),
    request("GET", urls.servicem8)
      .then((res) => res.json())
      .catch(() => ({ data: [] })),
    request("GET", urls.assignments)
      .then((res) => res.json())
      .catch(() => ({ data: [] })),
  ]);
  return { diary, proposals, servicem8, schedule };
}

export function reportDiaryClientError(
  error: unknown,
  context: string,
  componentStack?: string,
): void {
  if (typeof fetch !== "function") return;
  const err = error instanceof Error ? error : new Error(diaryText(error) || "Diary error");
  const url = typeof window !== "undefined" ? window.location.href : "";
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  fetch("/api/client-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: err.message,
      stack: err.stack,
      componentStack,
      url,
      userAgent,
      context,
    }),
  }).catch(() => {});
}
