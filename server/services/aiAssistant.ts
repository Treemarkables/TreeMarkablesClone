import OpenAI from 'openai';
import { storage } from '../storage.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a smart business assistant for Treemarkables, a professional arborist and tree removal company based in New Zealand. You help the team with business insights, scheduling questions, job management, and operational decisions.

Today's date and time in NZ: {{NOW_NZ}}

You have access to tools to look up live business data. Always use these tools when the user asks about jobs, quotes, customers, leads, or business metrics — never guess. Keep responses concise and practical. Use NZD for all prices. Dates should use NZ timezone.`;

// Tool definitions for OpenAI function calling
const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_business_summary',
      description: 'Get a high-level business summary: job counts by status, total revenue, pending quotes, unread notifications',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_upcoming_jobs',
      description: 'Get scheduled jobs in the next N days',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Number of days ahead to look (default 7)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_quotes',
      description: 'Get all quotes that are pending customer response (status: sent, draft)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_leads',
      description: 'Get recent leads awaiting follow-up',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max leads to return (default 10)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_jobs',
      description: 'Search jobs by customer name, address, or job number',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (customer name, address, job number)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_uninvoiced_completed_jobs',
      description: 'Get completed jobs that have not yet been invoiced',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_revenue_summary',
      description: 'Get revenue stats: total invoiced, outstanding invoices, average job value',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

// Tool implementations
async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'get_business_summary': {
        const [allJobsResult, quotes, notifications] = await Promise.all([
          storage.getAllJobs({ limit: 999999 }),
          storage.getAllQuotes(),
          storage.getUnreadNotifications(),
        ]);
        const jobs = allJobsResult.jobs;

        const byStatus: Record<string, number> = {};
        let totalRevenue = 0;
        for (const j of jobs) {
          byStatus[j.status] = (byStatus[j.status] || 0) + 1;
          if (j.totalAmount && (j.status === 'completed' || j.status === 'work_order')) {
            totalRevenue += parseFloat(j.totalAmount);
          }
        }

        const pendingQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'draft');
        return JSON.stringify({
          totalJobs: jobs.length,
          byStatus,
          pendingQuotesCount: pendingQuotes.length,
          unreadNotifications: notifications.length,
          estimatedRevenueNZD: Math.round(totalRevenue),
        });
      }

      case 'get_upcoming_jobs': {
        const days = (args.days as number) || 7;
        const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        const now = new Date();
        // 'scheduled' status retired 2026-05 — upcoming jobs are work_orders
        // with a future scheduledDate.
        const { jobs } = await storage.getAllJobs({ limit: 999999, status: 'work_order' });

        const upcoming = jobs
          .filter(j => j.scheduledDate && new Date(j.scheduledDate) >= now && new Date(j.scheduledDate) <= cutoff)
          .sort((a, b) => new Date(a.scheduledDate!).getTime() - new Date(b.scheduledDate!).getTime())
          .slice(0, 20)
          .map(j => ({
            jobNumber: j.jobNumber,
            title: j.title,
            address: j.address,
            scheduledDate: j.scheduledDate,
            assignedTeam: j.assignedTeam,
            totalAmount: j.totalAmount,
          }));

        return JSON.stringify({ upcomingJobs: upcoming, count: upcoming.length });
      }

      case 'get_pending_quotes': {
        const quotes = await storage.getAllQuotes();
        const pending = quotes
          .filter(q => q.status === 'sent' || q.status === 'draft')
          .slice(0, 20)
          .map(q => ({
            quoteNumber: q.quoteNumber,
            status: q.status,
            amount: q.amount,
            sentDate: q.sentDate,
            description: q.description?.slice(0, 100),
          }));
        return JSON.stringify({ pendingQuotes: pending, count: pending.length });
      }

      case 'get_recent_leads': {
        const limit = (args.limit as number) || 10;
        const leads = await storage.getJobsByStatus('lead');
        const recent = leads
          .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
          .slice(0, limit)
          .map(j => ({
            jobNumber: j.jobNumber,
            title: j.title,
            address: j.address,
            leadSource: j.leadSource,
            createdAt: j.createdAt,
            lastActivityAt: j.lastActivityAt,
          }));
        return JSON.stringify({ leads: recent, count: recent.length });
      }

      case 'search_jobs': {
        const query = (args.query as string) || '';
        const result = await storage.searchJobs(query, { limit: 10 });
        const jobs = Array.isArray(result) ? result : result.jobs || [];
        const mapped = jobs.slice(0, 10).map((j: { jobNumber: string; title?: string | null; status: string; address: string; scheduledDate?: Date | null; totalAmount?: string | null }) => ({
          jobNumber: j.jobNumber,
          title: j.title,
          status: j.status,
          address: j.address,
          scheduledDate: j.scheduledDate,
          totalAmount: j.totalAmount,
        }));
        return JSON.stringify({ results: mapped, count: mapped.length });
      }

      case 'get_uninvoiced_completed_jobs': {
        const completed = await storage.getJobsByStatus('completed');
        const uninvoiced = [];
        for (const job of completed) {
          const invoices = await storage.getInvoicesByJob(job.id);
          if (invoices.length === 0) {
            const daysSince = job.completedDate
              ? Math.floor((Date.now() - new Date(job.completedDate).getTime()) / (1000 * 60 * 60 * 24))
              : null;
            uninvoiced.push({
              jobNumber: job.jobNumber,
              title: job.title,
              address: job.address,
              completedDate: job.completedDate,
              daysSinceCompletion: daysSince,
              totalAmount: job.totalAmount,
            });
          }
        }
        return JSON.stringify({ uninvoicedJobs: uninvoiced, count: uninvoiced.length });
      }

      case 'get_revenue_summary': {
        const invoices = await storage.getAllInvoices();
        let totalInvoiced = 0;
        let outstanding = 0;
        for (const inv of invoices) {
          const amount = parseFloat((inv as unknown as { totalAmount?: string; amount?: string }).totalAmount || (inv as unknown as { amount?: string }).amount || '0');
          totalInvoiced += amount;
          const status = (inv as unknown as { status?: string }).status;
          if (status === 'sent' || status === 'draft' || status === 'overdue') {
            outstanding += amount;
          }
        }
        const avgJobValue = invoices.length > 0 ? Math.round(totalInvoiced / invoices.length) : 0;
        return JSON.stringify({
          totalInvoiced: Math.round(totalInvoiced),
          outstanding: Math.round(outstanding),
          invoiceCount: invoices.length,
          averageJobValueNZD: avgJobValue,
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Run the agentic loop: call OpenAI, handle tool calls, repeat up to maxIterations
export async function runAssistantChat(
  userMessage: string,
  history: ChatMessage[],
  sessionId: string,
  employeeId: string,
): Promise<string> {
  const nowNZ = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date());

  const systemPrompt = SYSTEM_PROMPT.replace('{{NOW_NZ}}', nowNZ);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const MAX_ITERATIONS = 5;
  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools,
      tool_choice: 'auto',
    });

    const choice = response.choices[0];

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      messages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        let toolArgs: Record<string, unknown> = {};
        try {
          toolArgs = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          toolArgs = {};
        }
        const result = await executeTool(toolCall.function.name, toolArgs);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }
      continue;
    }

    const assistantReply = choice.message.content || 'Sorry, I could not generate a response.';

    await Promise.all([
      storage.createAssistantMessage({ sessionId, employeeId, role: 'user', content: userMessage }),
      storage.createAssistantMessage({ sessionId, employeeId, role: 'assistant', content: assistantReply }),
    ]);

    return assistantReply;
  }

  return 'I ran into an issue processing your request. Please try again.';
}
