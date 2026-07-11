/**
 * Open a job's photo-report PDF, platform-aware.
 *
 * - Browsers + iOS app: window.open — WKWebView renders PDFs inline.
 * - Android app: the WebView can't render PDFs and window.open dead-ends,
 *   so we NAVIGATE to the URL instead. The response's Content-Disposition:
 *   attachment fires the shell's DownloadListener (the page itself never
 *   unloads), which hands the file — with the session cookie — to Android's
 *   DownloadManager. Requires the DownloadListener in the Android shell's
 *   MainActivity; without it the tap is a silent no-op on Android.
 */
export function openPhotoReport(jobId: string) {
  const url = `/api/jobs/${jobId}/photo-report.pdf`;
  const cap = (window as any).Capacitor;
  if (cap?.getPlatform?.() === "android") {
    window.location.assign(url);
  } else {
    window.open(url, "_blank");
  }
}
