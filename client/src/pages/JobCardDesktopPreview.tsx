/**
 * Preview page for the JobCardDesktop scaffold.
 *
 * Reachable at /job-card-preview-desktop/:jobId — lets us QA the
 * split-screen chrome (header + tabs + draggable divider + diary panel +
 * bottom action bar) before Phase B starts wiring real panels in.
 *
 * Throwaway page. Remove once Phase F+ wires the new layout into
 * GlobalJobCard as the real desktop experience.
 */
import { useLocation, useRoute } from "wouter";
import { JobCardDesktop } from "@/components/JobCardDesktop";

export default function JobCardDesktopPreview() {
  const [, navigate] = useLocation();
  const [, params] = useRoute<{ jobId: string }>("/job-card-preview-desktop/:jobId");
  const jobId = params?.jobId;

  if (!jobId) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <h1 className="text-lg font-bold mb-2">JobCardDesktop preview</h1>
        <p className="text-sm text-slate-600">
          Open <code>/job-card-preview-desktop/&lt;job-id&gt;</code> to see the
          redesigned desktop job card. Find a real job ID from the dispatch
          board or the URL bar on an open job.
        </p>
      </div>
    );
  }

  return (
    <JobCardDesktop
      jobId={jobId}
      onClose={() => navigate("/jobs")}
    />
  );
}
