/**
 * Preview page for the JobCardMobile scaffold.
 *
 * Reachable at /job-card-preview/:jobId — lets us QA the redesigned mobile
 * chrome + the Checklist / Quoting / Diary tabs (which work end-to-end via
 * the existing panel components) before Phase B wires it into GlobalJobCard.
 *
 * Throwaway page. Remove once Phase D completes and the new layout is the
 * default mobile experience.
 */
import { useLocation, useRoute } from "wouter";
import { JobCardMobile } from "@/components/JobCardMobile";

export default function JobCardPreview() {
  const [, navigate] = useLocation();
  const [, params] = useRoute<{ jobId: string }>("/job-card-preview/:jobId");
  const jobId = params?.jobId;

  if (!jobId) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <h1 className="text-lg font-bold mb-2">JobCardMobile preview</h1>
        <p className="text-sm text-slate-600">
          Open <code>/job-card-preview/&lt;job-id&gt;</code> to see the
          redesigned mobile job card. Find a real job ID from the dispatch
          board or the URL bar on an open job.
        </p>
      </div>
    );
  }

  return (
    <JobCardMobile
      jobId={jobId}
      onClose={() => navigate("/jobs")}
    />
  );
}
