import Foundation
import Capacitor
import Photos
import os

private let mlLog = Logger(subsystem: "co.nz.inflowapp", category: "MediaLibrary")

// MARK: - Capacitor Plugin Declaration

/// Saves job photos/videos straight into the iOS Photos library ("Save to
/// Photos" without the share sheet). The webview hands us the media URL and we
/// download it natively — the asset never has to fit in the WKWebView JS heap,
/// which the old navigator.share path required (whole video buffered in memory).
///
/// The /objects/* media routes are unauthenticated (unguessable filenames), so
/// a plain URLSession fetch works without session-cookie plumbing.
@objc(MediaLibraryPlugin)
public class MediaLibraryPlugin: CAPPlugin, CAPBridgedPlugin, URLSessionDownloadDelegate {
    public let identifier = "MediaLibraryPlugin"
    public let jsName = "MediaLibrary"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveToPhotos", returnType: CAPPluginReturnPromise),
    ]

    /// Per-download context, keyed by URLSession task identifier.
    private struct SaveContext {
        let call: CAPPluginCall
        let progressId: String
        let kind: String // "photo" | "video"
        let filenameHint: String
    }

    private var saves: [Int: SaveContext] = [:]
    private let savesLock = NSLock()

    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 15 * 60 // big videos on rural mobile data
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    // MARK: - saveToPhotos

    @objc func saveToPhotos(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = URL(string: urlString),
              let scheme = url.scheme?.lowercased(),
              scheme == "https" || scheme == "http" else {
            call.reject("A valid media URL is required.", "BAD_URL")
            return
        }
        let kind = call.getString("kind") ?? "photo"
        guard kind == "photo" || kind == "video" else {
            call.reject("kind must be \"photo\" or \"video\".", "BAD_KIND")
            return
        }
        let progressId = call.getString("id") ?? urlString
        let filenameHint = call.getString("filename") ?? url.lastPathComponent

        // Ask for add-only Photos permission up front so the user isn't left
        // watching a long download that ends in a permission prompt/failure.
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { [weak self] status in
            guard let self = self else { return }
            guard status == .authorized || status == .limited else {
                call.reject(
                    "Inflow doesn't have permission to add to your Photos library. Enable it in Settings → Inflow → Photos.",
                    "PERMISSION_DENIED"
                )
                return
            }
            let task = self.session.downloadTask(with: url)
            self.savesLock.lock()
            self.saves[task.taskIdentifier] = SaveContext(
                call: call, progressId: progressId, kind: kind, filenameHint: filenameHint
            )
            self.savesLock.unlock()
            task.resume()
        }
    }

    private func takeContext(for task: URLSessionTask) -> SaveContext? {
        savesLock.lock()
        defer { savesLock.unlock() }
        return saves.removeValue(forKey: task.taskIdentifier)
    }

    private func peekContext(for task: URLSessionTask) -> SaveContext? {
        savesLock.lock()
        defer { savesLock.unlock() }
        return saves[task.taskIdentifier]
    }

    // MARK: - URLSessionDownloadDelegate

    public func urlSession(
        _ session: URLSession, downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64
    ) {
        guard totalBytesExpectedToWrite > 0, let ctx = peekContext(for: downloadTask) else { return }
        let percent = Int((Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)) * 100)
        notifyListeners("saveProgress", data: ["id": ctx.progressId, "percent": percent])
    }

    public func urlSession(
        _ session: URLSession, downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        guard let ctx = takeContext(for: downloadTask) else { return }

        if let http = downloadTask.response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            ctx.call.reject("The file could not be fetched (HTTP \(http.statusCode)).", "FETCH_FAILED")
            return
        }

        // PHAssetCreationRequest infers the asset format from the file
        // extension, but URLSession's temp file has none — move it (must happen
        // synchronously inside this delegate callback, the temp file is deleted
        // when we return) to a name with a real extension.
        let ext = Self.fileExtension(
            mimeType: downloadTask.response?.mimeType, hint: ctx.filenameHint, kind: ctx.kind
        )
        let staged = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension(ext)
        do {
            try FileManager.default.moveItem(at: location, to: staged)
        } catch {
            ctx.call.reject("Could not stage the downloaded file.", "FS_ERROR", error)
            return
        }

        PHPhotoLibrary.shared().performChanges({
            let request = PHAssetCreationRequest.forAsset()
            let options = PHAssetResourceCreationOptions()
            options.shouldMoveFile = true // Photos takes the staged file — no second copy
            options.originalFilename = ctx.filenameHint
            request.addResource(with: ctx.kind == "video" ? .video : .photo, fileURL: staged, options: options)
        }) { success, error in
            try? FileManager.default.removeItem(at: staged) // no-op when Photos moved it
            if success {
                mlLog.info("Saved \(ctx.kind, privacy: .public) to Photos library")
                ctx.call.resolve(["saved": true])
            } else {
                mlLog.error("Photos save failed: \(String(describing: error), privacy: .public)")
                ctx.call.reject(
                    error?.localizedDescription ?? "The Photos library rejected the file.",
                    "SAVE_FAILED", error
                )
            }
        }
    }

    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        // Success passes through didFinishDownloadingTo, which already removed
        // the context — this only fires with a live context on network failure.
        guard let error = error, let ctx = takeContext(for: task) else { return }
        mlLog.error("Media download failed: \(error.localizedDescription, privacy: .public)")
        ctx.call.reject("The download failed: \(error.localizedDescription)", "FETCH_FAILED", error)
    }

    // MARK: - Helpers

    private static func fileExtension(mimeType: String?, hint: String, kind: String) -> String {
        switch mimeType?.lowercased() {
        case "image/jpeg": return "jpg"
        case "image/png": return "png"
        case "image/heic": return "heic"
        case "image/gif": return "gif"
        case "image/webp": return "webp"
        case "video/mp4": return "mp4"
        case "video/quicktime": return "mov"
        case "video/webm": return "webm"
        default:
            let hintExt = (hint as NSString).pathExtension.lowercased()
            if !hintExt.isEmpty && hintExt.count <= 5 { return hintExt }
            return kind == "video" ? "mp4" : "jpg"
        }
    }
}
