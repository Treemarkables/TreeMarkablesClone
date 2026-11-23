/**
 * Resending a proposal must keep the same lines and total.
 * A second Send in the same moment must not send again.
 *
 * Run: npx tsx --test server/proposalResend.test.ts
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { applyIncrement, createMemoryRateLimitBackend, setRateLimitBackendForTests } from "./security/rateLimitStore.ts";
import { beginProposalSend } from "./proposalSendClaim.ts";
import {
  clearProposalContent,
  createMemoryLeaseLock,
  withLease,
  type ProposalContentDeps,
} from "./proposalContentLock.ts";
import { nextSendCount, PROPOSAL_SEND_DEDUPE_MS } from "../shared/proposalSend.ts";

interface Line {
  id: string;
  sectionId: string;
  description: string;
  total: number;
}

interface Mem {
  sections: { id: string }[];
  items: Line[];
}

function createMem(lines: Line[]): { state: Mem; deps: ProposalContentDeps } {
  const state: Mem = {
    sections: [...new Set(lines.map((line) => line.sectionId))].map((id) => ({ id })),
    items: lines.map((line) => ({ ...line })),
  };
  const deps: ProposalContentDeps = {
    async listSections() {
      return state.sections.map((section) => ({ id: section.id }));
    },
    async deleteSection(id) {
      state.sections = state.sections.filter((section) => section.id !== id);
      state.items = state.items.filter((item) => item.sectionId !== id);
    },
    async listItems() {
      return state.items.map((item) => ({ id: item.id }));
    },
    async deleteItemChoices() {},
    async deleteItem(id) {
      state.items = state.items.filter((item) => item.id !== id);
    },
  };
  return { state, deps };
}

function total(state: Mem): number {
  return state.items.reduce((sum, item) => sum + item.total, 0);
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 20));

let seq = 0;

async function rewriteLocked(
  lock: ReturnType<typeof createMemoryLeaseLock>,
  state: Mem,
  deps: ProposalContentDeps,
  lines: { description: string; total: number }[],
) {
  await withLease(lock, "proposal-1", async () => {
    await clearProposalContent("proposal-1", deps);
    await pause();
    const sectionId = `section-${++seq}`;
    state.sections.push({ id: sectionId });
    for (const line of lines) {
      state.items.push({
        id: `line-${++seq}`,
        sectionId,
        description: line.description,
        total: line.total,
      });
    }
  });
}

describe("proposal resend keeps the same lines and total", () => {
  it("saving the same lines twice does not double them", async () => {
    const original = [{ id: "line-1", sectionId: "section-1", description: "Fell pine", total: 850 }];
    const { state, deps } = createMem(original);
    const lock = createMemoryLeaseLock();
    const lines = [{ description: "Fell pine", total: 850 }];
    await rewriteLocked(lock, state, deps, lines);
    await rewriteLocked(lock, state, deps, lines);
    assert.equal(state.items.length, 1);
    assert.equal(state.sections.length, 1);
    assert.equal(total(state), 850);
    assert.equal(state.items[0].description, "Fell pine");
  });

  it("two overlapping saves leave one copy, not $850 doubled to $1,700", async () => {
    const { state, deps } = createMem([
      { id: "line-1", sectionId: "section-1", description: "Fell pine", total: 850 },
    ]);
    const lock = createMemoryLeaseLock();
    const lines = [{ description: "Fell pine", total: 850 }];
    await Promise.all([
      rewriteLocked(lock, state, deps, lines),
      rewriteLocked(lock, state, deps, lines),
    ]);
    assert.equal(state.items.length, 1);
    assert.equal(total(state), 850);
  });

  it("the old read-then-delete race keeps both inserts", async () => {
    const { state, deps } = createMem([
      { id: "line-1", sectionId: "section-1", description: "Fell pine", total: 850 },
    ]);
    const lines = [{ description: "Fell pine", total: 850 }];

    const racy = async () => {
      const seen = state.sections.map((section) => section.id);
      await pause();
      for (const id of seen) await deps.deleteSection(id);
      await pause();
      const sectionId = `section-${++seq}`;
      state.sections.push({ id: sectionId });
      state.items.push({
        id: `line-${++seq}`,
        sectionId,
        description: lines[0].description,
        total: lines[0].total,
      });
    };

    await Promise.all([racy(), racy()]);
    assert.equal(state.items.length, 2);
    assert.equal(total(state), 1700);
  });

  it("a leftover line from an earlier section does not stay behind the new copy", async () => {
    const { state, deps } = createMem([
      { id: "live", sectionId: "section-1", description: "Fell pine", total: 850 },
    ]);
    state.items.push({
      id: "orphan",
      sectionId: "deleted-section",
      description: "Fell pine",
      total: 850,
    });
    const lock = createMemoryLeaseLock();
    await rewriteLocked(lock, state, deps, [{ description: "Fell pine", total: 850 }]);
    assert.equal(state.items.length, 1);
    assert.equal(total(state), 850);
    assert.equal(state.items.some((item) => item.id === "orphan"), false);
  });
});

describe("double submit sends once", () => {
  beforeEach(() => {
    setRateLimitBackendForTests(createMemoryRateLimitBackend());
  });
  afterEach(() => {
    setRateLimitBackendForTests(null);
  });

  it("a second email claim in the window does not send, and SMS still sends once", async () => {
    assert.equal(await beginProposalSend("proposal-1", "email", "bp.harnett@xtra.co.nz"), "send");
    assert.equal(await beginProposalSend("proposal-1", "email", "BP.HARNETT@xtra.co.nz"), "duplicate");
    assert.equal(await beginProposalSend("proposal-1", "sms", "021 000 0000"), "send");
    assert.equal(await beginProposalSend("proposal-1", "sms", "0210000000"), "duplicate");
  });

  it("uses the same window as the shared rate-limit counter", () => {
    const now = 1_700_000_000_000;
    const first = nextSendCount(undefined, now);
    const mirrored = applyIncrement(undefined, now, PROPOSAL_SEND_DEDUPE_MS);
    assert.equal(first.send, true);
    assert.equal(first.count, mirrored.count);
    assert.equal(first.resetAtMs, mirrored.resetAtMs);

    const second = nextSendCount({ count: first.count, resetAtMs: first.resetAtMs }, now + 1000);
    assert.equal(second.send, false);
    assert.equal(second.count, 2);

    const later = nextSendCount(
      { count: second.count, resetAtMs: second.resetAtMs },
      second.resetAtMs + 1,
    );
    assert.equal(later.send, true);
    assert.equal(later.count, 1);
  });
});
