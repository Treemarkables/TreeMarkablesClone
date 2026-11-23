/**
 * Approval gate for quote follow-ups.
 *
 * confirm must be the boolean true. A missing flag, false, or the string
 * "true" does not send. The sender function is not called unless the gate
 * passes and the draft is still waiting.
 */

export type ApprovalChannel = "sms" | "email";

export interface ApprovalSendRequest {
  channel: ApprovalChannel;
  to: string;
  message: string;
  subject: string | null;
}

export type ApprovalResult =
  | { ok: true; channel: ApprovalChannel; to: string; message: string; subject: string | null }
  | { ok: false; status: number; message: string };

export async function commitApprovedSend(
  input: {
    confirm: unknown;
    status: string;
    channel: string;
    message: string;
    subject?: string | null;
    phone?: string | null;
    email?: string | null;
  },
  send: (request: ApprovalSendRequest) => Promise<boolean>,
): Promise<ApprovalResult> {
  if (input.confirm !== true) {
    return {
      ok: false,
      status: 400,
      message: "Sending needs confirm: true. Nothing was sent.",
    };
  }
  if (input.status !== "draft" && input.status !== "snoozed") {
    return {
      ok: false,
      status: 409,
      message: "This follow-up is not waiting for approval.",
    };
  }
  const message = input.message.trim();
  if (!message) {
    return { ok: false, status: 422, message: "Write a message before sending." };
  }
  const channel: ApprovalChannel = input.channel === "email" ? "email" : "sms";
  const to = (channel === "email" ? input.email : input.phone)?.trim() ?? "";
  if (!to) {
    return {
      ok: false,
      status: 422,
      message: channel === "email" ? "No email address on file." : "No mobile number on file.",
    };
  }
  const subject = input.subject?.trim() || (channel === "email" ? "Following up on your quote" : null);
  const sent = await send({ channel, to, message, subject });
  if (!sent) {
    return {
      ok: false,
      status: 502,
      message: "The message could not be sent. Nothing was marked as sent.",
    };
  }
  return { ok: true, channel, to, message, subject };
}
