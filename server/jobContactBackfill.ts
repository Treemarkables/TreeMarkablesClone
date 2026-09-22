import type { InsertJob } from "@shared/schema";
import { storage } from "./storage";
import {
  contactFromThread,
  emailAddressFromDiary,
  fillEmptyJobContact,
  fillEmptyJobContactFromSources,
  isBlank,
  isUnnamedJobContact,
  type ContactSource,
  type JobContactFields,
} from "@shared/jobContactFill";

type RepairableJob = JobContactFields & {
  id: string;
  customerId?: string | null;
  customerContactId?: string | null;
};

// One-time fill of empty job-contact fields the next time a job is loaded.
// A saved contact (customerContactId) is left alone — those blanks were chosen
// by loading that contact. Non-empty columns are never overwritten.
export async function backfillEmptyJobContact<T extends RepairableJob>(
  job: T,
  customer?: ContactSource | null,
): Promise<T> {
  // Saved contacts are chosen on purpose. A job that already has a name or
  // an email is left alone so clearing one of those fields is not undone
  // the next time the card opens.
  if (job.customerContactId || !isUnnamedJobContact(job)) return job;

  const sources: ContactSource[] = [];
  if (customer) sources.push(customer);
  let patch = fillEmptyJobContactFromSources(job, sources);

  const needsEmail = isBlank(job.jobContactEmail) && !patch.jobContactEmail;
  const needsName =
    isBlank(job.jobContactFirstName) &&
    isBlank(job.jobContactLastName) &&
    !patch.jobContactFirstName;

  if (needsEmail) {
    try {
      const entries = await storage.getJobDiaryEntriesByJob(job.id, 40);
      const diaryEmail = emailAddressFromDiary(entries);
      if (diaryEmail) {
        patch = {
          ...patch,
          ...fillEmptyJobContact({ ...job, ...patch }, { email: diaryEmail }),
        };
      }
    } catch (err) {
      console.error(`Job contact diary lookup failed for job ${job.id}:`, err);
    }
  }

  const stillNeedsEmail = isBlank(job.jobContactEmail) && !patch.jobContactEmail;
  const stillNeedsName = needsName && !patch.jobContactFirstName;
  if ((stillNeedsEmail || stillNeedsName) && job.customerId) {
    try {
      const conversations = await storage.getConversationsByCustomer(job.customerId);
      for (const conversation of conversations.slice(0, 3)) {
        const messages = await storage.getConversationMessages(conversation.id);
        const fromThread = contactFromThread(messages.slice(0, 20));
        const more = fillEmptyJobContact({ ...job, ...patch }, fromThread);
        patch = { ...patch, ...more };
        if ((!stillNeedsEmail || patch.jobContactEmail) && (!stillNeedsName || patch.jobContactFirstName)) {
          break;
        }
      }
    } catch (err) {
      console.error(`Job contact thread lookup failed for job ${job.id}:`, err);
    }
  }

  if (Object.keys(patch).length === 0) return job;

  try {
    const updated = await storage.updateJob(job.id, patch as Partial<InsertJob>);
    if (!updated) return job;
    console.log(
      `Filled empty job-contact fields on job ${job.id} (${Object.keys(patch).join(", ")})`,
    );
    return { ...job, ...updated } as T;
  } catch (err) {
    console.error(`Job contact fill failed for job ${job.id}:`, err);
    return job;
  }
}
