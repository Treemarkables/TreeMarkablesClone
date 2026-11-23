/**
 * Opening a saved proposal must not copy the job's line items in again.
 *
 * The builder used to drop the job's lines into every empty block whose
 * title looked like pricing ("Line Items", "Quote", "Services", …). A
 * proposal that already had its own lines, or two empty pricing blocks,
 * ended up with the same work twice — $850 became $1,700 on the next save.
 */

export interface EditBlockLines<T> {
  type: string;
  title: string;
  lineItems: T[];
}

export function isPricingBlock(block: { type: string; title: string }): boolean {
  const title = block.title.trim().toLowerCase();
  return (
    block.type === "lineItems" ||
    title.includes("line item") ||
    title === "items" ||
    title === "pricing" ||
    title === "services" ||
    title === "quote"
  );
}

/**
 * Saved proposal lines win. Job lines are copied into the first empty
 * pricing block only when the proposal has no lines of its own.
 */
export function mergeJobLinesIntoProposalBlocks<T>(
  blocks: EditBlockLines<T>[],
  jobLines: T[],
): EditBlockLines<T>[] {
  const alreadySaved = blocks.some((block) => block.lineItems.length > 0);
  if (alreadySaved || jobLines.length === 0) return blocks;

  let filled = false;
  return blocks.map((block) => {
    if (filled || block.lineItems.length > 0 || !isPricingBlock(block)) return block;
    filled = true;
    return { ...block, lineItems: jobLines };
  });
}

export function sumLineTotals(blocks: { lineItems: { totalPrice: number }[] }[]): number {
  return blocks.reduce(
    (sum, block) => sum + block.lineItems.reduce((lineSum, line) => lineSum + line.totalPrice, 0),
    0,
  );
}
