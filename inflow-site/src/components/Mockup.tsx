type Status = "Quoted" | "Scheduled" | "In progress" | "Invoiced" | "Paid";

const statusStyle: Record<Status, string> = {
  Quoted: "bg-ink-100 text-ink-700",
  Scheduled: "bg-ink-900 text-paper",
  "In progress": "bg-lime text-ink-900",
  Invoiced: "bg-ink-100 text-ink-700",
  Paid: "bg-ink-100 text-ink-500 line-through-ink",
};

type Row = {
  job: string;
  client: string;
  crew: string;
  value: string;
  status: Status;
};

const rows: Row[] = [
  { job: "Macrocarpa removal", client: "Te Whata, Wainui Rd", crew: "Crew A", value: "$2,840", status: "In progress" },
  { job: "Hedge trim — 45m", client: "Greenfield Estate", crew: "Crew B", value: "$1,150", status: "Scheduled" },
  { job: "Pohutukawa pruning", client: "Roebuck, Salisbury", crew: "Crew A", value: "$680", status: "Quoted" },
  { job: "Stump grind ×3", client: "Watson, Mangapapa", crew: "Crew C", value: "$420", status: "Invoiced" },
  { job: "Storm clean-up", client: "Anderson, Wainui", crew: "Crew A", value: "$3,100", status: "Paid" },
];

export default function Mockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 bg-gradient-to-br from-lime/20 via-transparent to-ink-100 blur-2xl rounded-3xl" />
      <div className="rounded-2xl bg-paper shadow-lift border border-ink-100 overflow-hidden">
        {/* Window chrome */}
        <div className="h-9 border-b border-ink-100 bg-ink-50 flex items-center px-4 gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
          <div className="mx-auto text-[11px] text-ink-500 tracking-tight">
            app.inflowapp.co.nz / jobs
          </div>
        </div>

        {/* Page header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">This week</p>
            <h3 className="text-lg font-semibold tracking-snug">Active jobs</h3>
          </div>
          <div className="flex gap-2">
            <span className="h-8 px-3 rounded-full text-xs flex items-center bg-ink-100 text-ink-700">
              5 open
            </span>
            <span className="h-8 px-3 rounded-full text-xs flex items-center bg-ink-900 text-paper">
              + New job
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-[1.4fr_1.4fr_0.8fr_0.6fr_0.7fr] text-[11px] uppercase tracking-[0.18em] text-ink-400 px-3 py-2 border-b border-ink-100">
            <span>Job</span><span>Client</span><span>Crew</span><span className="text-right">Value</span><span className="text-right">Status</span>
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-[1.4fr_1.4fr_0.8fr_0.6fr_0.7fr] items-center px-3 py-3 text-sm border-b border-ink-100/60 last:border-b-0"
            >
              <span className="font-medium text-ink-900 truncate">{r.job}</span>
              <span className="text-ink-500 truncate">{r.client}</span>
              <span className="text-ink-500">{r.crew}</span>
              <span className="text-right font-medium tabular-nums">{r.value}</span>
              <span className="flex justify-end">
                <span className={`h-6 px-2 rounded-full text-[11px] font-medium flex items-center ${statusStyle[r.status]}`}>
                  {r.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating "next invoice" card */}
      <div className="hidden md:flex absolute -bottom-8 -right-6 w-60 rounded-xl bg-ink-900 text-paper p-5 shadow-lift items-start gap-3">
        <div className="h-8 w-8 rounded-md bg-lime flex items-center justify-center text-ink-900 font-semibold">
          $
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Next invoice</p>
          <p className="text-lg font-semibold mt-0.5 tracking-snug">$8,190 NZD</p>
          <p className="text-[11px] text-ink-300 mt-1">Auto-drafted • ready to send</p>
        </div>
      </div>
    </div>
  );
}
