/**
 * Turn already-downscaled JPEG buffers into the MIME parts for a job-card
 * email. Photos go out as real file attachments. When inline display is
 * allowed, the same bytes are also attached with a Content-ID so the HTML
 * can reference them as cid: — never as a data: URI, which Gmail and Outlook
 * commonly block.
 *
 * The byte budget is raw image bytes (before base64). 18MB raw is about 24MB
 * on the wire, under the ~30MB provider cap with room for a PDF and the body.
 */

export const EMAIL_PHOTO_BYTE_BUDGET = 18 * 1024 * 1024;

export interface OutboundPhotoAttachment {
  content: string;
  filename: string;
  type: "image/jpeg";
  disposition: "attachment" | "inline";
  content_id?: string;
}

export interface DiaryFileAttachment {
  url: string;
  filename: string;
  contentType: string;
}

export interface BuiltPhotoEmailParts {
  attachments: OutboundPhotoAttachment[];
  /** Gallery HTML using cid: references. Empty when nothing was inlined. */
  inlineHtml: string;
  /** Object paths that were actually attached, in send order. */
  sentUrls: string[];
  skipped: number;
}

export function buildPhotoEmailParts(input: {
  photos: Array<{ sourceUrl: string; jpeg: Buffer }>;
  /** False for Microsoft-hosted recipients: file attachments only, no CID images. */
  embedInline: boolean;
  byteBudget?: number;
}): BuiltPhotoEmailParts {
  const budget = input.byteBudget ?? EMAIL_PHOTO_BYTE_BUDGET;
  const attachments: OutboundPhotoAttachment[] = [];
  const inlineParts: string[] = [];
  const sentUrls: string[] = [];
  let used = 0;
  let skipped = 0;
  let index = 0;

  for (const photo of input.photos) {
    const size = photo.jpeg.length;
    if (size <= 0) {
      skipped++;
      continue;
    }
    const canAttach = used + size <= budget;
    if (!canAttach) {
      skipped++;
      continue;
    }
    index += 1;
    const filename = `Job-photo-${index}.jpg`;
    const content = photo.jpeg.toString("base64");
    attachments.push({
      content,
      filename,
      type: "image/jpeg",
      disposition: "attachment",
    });
    used += size;

    const canInline = input.embedInline && used + size <= budget;
    if (canInline) {
      const cid = `job-photo-${index - 1}`;
      attachments.push({
        content,
        filename: `Job-photo-${index}-inline.jpg`,
        type: "image/jpeg",
        disposition: "inline",
        content_id: cid,
      });
      used += size;
      inlineParts.push(`
                <div style="display: inline-block; margin: 5px; vertical-align: top;">
                  <img src="cid:${cid}" alt="Job Photo ${index}"
                    style="max-width: 200px; max-height: 200px; border-radius: 8px;
                           border: 1px solid #ddd; display: block;" />
                </div>
              `);
    }
    sentUrls.push(photo.sourceUrl);
  }

  const inlineHtml =
    inlineParts.length > 0
      ? `
              <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9;
                          border-radius: 8px; font-family: Arial, sans-serif;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #333;">
                  Photos (${inlineParts.length}):
                </p>
                <div>
                  ${inlineParts.join("")}
                </div>
              </div>
            `
      : "";

  return { attachments, inlineHtml, sentUrls, skipped };
}
