// ============================================================================
// File: src/leadModalParts/LeadFilesPanel.jsx
// Purpose: Modal for viewing and uploading files to Google Drive.
//          Phase 1 = folder picker (Before / After / Other).
//          Phase 2 = file browser inside the chosen folder.
// ============================================================================

import React, { useEffect, useRef, useState } from "react";
import { Browser } from "@capacitor/browser";
import { isNativeApp } from "../utils/platform";

const API_BASE = import.meta.env.APP_URL || import.meta.env.VITE_API_URL;

function getToken() {
  return localStorage.getItem("authToken");
}

function fileBgColor(mimeType) {
  if (!mimeType) return "bg-gray-100";
  if (mimeType.startsWith("image/")) return "bg-gray-200";
  if (mimeType === "application/pdf") return "bg-red-50";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "bg-green-50";
  if (mimeType.includes("document") || mimeType.includes("word")) return "bg-blue-50";
  if (mimeType.startsWith("video/")) return "bg-purple-50";
  return "bg-gray-100";
}

function fileIcon(mimeType) {
  if (!mimeType) return "📄";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("document") || mimeType.includes("word")) return "📝";
  if (mimeType.startsWith("video/")) return "🎥";
  return "📄";
}

function formatSize(bytes) {
  if (!bytes) return "";
  const kb = Number(bytes) / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function FolderTile({ folder, onNavigate }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(folder)}
      className="flex flex-col rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md active:opacity-80 transition bg-transparent"
    >
      <div className="w-full aspect-square flex items-center justify-center bg-transparent">
        <span className="text-4xl">📁</span>
      </div>
      <div className="px-2 py-2 text-left">
        <p className="text-xs font-semibold text-gray-800 truncate">{folder.name}</p>
        <p className="text-xs text-gray-400 truncate mt-0.5">Folder</p>
      </div>
    </button>
  );
}

function FileTile({ file, onOpen }) {
  const isImage = file.mimeType?.startsWith("image/");
  const [imgError, setImgError] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onOpen(file.webViewLink)}
      className="flex flex-col rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md active:opacity-80 transition bg-white"
    >
      <div className={`w-full aspect-square flex items-center justify-center ${fileBgColor(file.mimeType)}`}>
        {isImage && file.thumbnailLink && !imgError ? (
          <img
            src={file.thumbnailLink}
            alt={file.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-4xl">{fileIcon(file.mimeType)}</span>
        )}
      </div>
      <div className="px-2 py-2 text-left">
        <p className="text-xs font-semibold text-gray-800 truncate">{file.name}</p>
        <p className="text-xs text-gray-400 truncate mt-0.5">
          {file.createdTime
            ? new Date(file.createdTime).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : ""}
          {file.size ? ` · ${formatSize(file.size)}` : ""}
        </p>
      </div>
    </button>
  );
}

// ─── Shared modal shell ────────────────────────────────────────────────────────
function ModalShell({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center md:justify-center justify-end px-5"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-2xl shadow-xl flex flex-col w-full max-w-lg max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
        <div className="h-4" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LeadFilesPanel({ leadId, onClose }) {
  // "picker" shows the Before / After / Other selector.
  // "browser" shows the file grid inside the chosen folder.
  const [phase, setPhase] = useState("picker");

  // Folder IDs returned by lead-folder-init
  const [folderIds, setFolderIds] = useState(null);
  const [initLoading, setInitLoading] = useState(true);
  const [initError, setInitError] = useState(null);

  // File browser state
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [folderStack, setFolderStack] = useState([]); // [{id, name}]
  const fileInputRef = useRef(null);

  const currentFolder = folderStack[folderStack.length - 1] ?? null;
  const currentFolderId = currentFolder ? currentFolder.id : null;

  // ── Init: get/create root + Before + After on mount ──────────────────────
  useEffect(() => {
    if (!leadId) return;
    (async () => {
      setInitLoading(true);
      setInitError(null);
      try {
        const res = await fetch(
          `${API_BASE}/google-drive/lead-folder-init?leadId=${leadId}`,
          { headers: { Authorization: `Bearer ${getToken()}` } }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not set up folders");
        setFolderIds(data); // { root, before, after }
      } catch (err) {
        setInitError(err.message || "Could not connect to Google Drive");
      } finally {
        setInitLoading(false);
      }
    })();
  }, [leadId]);

  // ── Fetch files whenever the current folder changes (browser phase only) ──
  useEffect(() => {
    if (!leadId || phase !== "browser") return;
    fetchFiles(currentFolderId);
  }, [leadId, currentFolderId, phase]);

  async function fetchFiles(folderId) {
    setLoading(true);
    setError(null);
    try {
      const url = folderId
        ? `${API_BASE}/google-drive/folder-contents?folderId=${folderId}`
        : `${API_BASE}/google-drive/lead-files?leadId=${leadId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load files");
      setFiles(data.files || []);
    } catch (err) {
      setError("Could not load files.");
    } finally {
      setLoading(false);
    }
  }

  // ── Picker handlers ───────────────────────────────────────────────────────
  function pickBefore() {
    if (folderIds?.before) {
      setFolderStack([{ id: folderIds.before.id, name: "Before" }]);
    } else {
      setFolderStack([]);
    }
    setPhase("browser");
  }

  function pickAfter() {
    if (folderIds?.after) {
      setFolderStack([{ id: folderIds.after.id, name: "After" }]);
    } else {
      setFolderStack([]);
    }
    setPhase("browser");
  }

  function pickOther() {
    setFolderStack([]);
    setPhase("browser");
  }

  // ── Browser navigation ────────────────────────────────────────────────────
  function navigateIntoFolder(folder) {
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
  }

  function goBack() {
    if (folderStack.length > 0) {
      setFolderStack((prev) => prev.slice(0, -1));
    } else {
      // At root → go back to folder picker
      setPhase("picker");
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  async function handleFileChange(e) {
    const selected = Array.from(e.target.files);
    if (!selected.length) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of selected) {
        const formData = new FormData();
        formData.append("leadId", leadId);
        if (currentFolderId) formData.append("folderId", currentFolderId);
        formData.append("file", file);

        const res = await fetch(`${API_BASE}/google-drive/upload-file`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
      }
      await fetchFiles(currentFolderId);
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function openFile(url) {
    if (!url) return;
    if (isNativeApp()) {
      await Browser.open({ url });
    } else {
      window.open(url, "_blank");
    }
  }

  const folders = files.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
  const regularFiles = files.filter((f) => f.mimeType !== "application/vnd.google-apps.folder");

  // ── Render: Picker ────────────────────────────────────────────────────────
  if (phase === "picker") {
    return (
      <ModalShell onClose={onClose}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">Photos &amp; Files</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl p-2 -mr-1"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-6 py-6">
          <p className="text-sm text-gray-500 text-center">
            Tap a folder to upload or view photos for this job.
          </p>

          {initLoading && (
            <div className="py-6 text-sm text-gray-400 text-center">Setting up folders…</div>
          )}

          {!initLoading && initError && (
            <div className="py-4 text-sm text-red-500 text-center">{initError}</div>
          )}

          {!initLoading && !initError && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={pickBefore}
                className="w-full px-4 py-2.5 bg-blue-600 text-white text-xl font-semibold rounded-lg shadow hover:bg-blue-700 active:opacity-80 transition text-center"
              >
                Before
              </button>

              <button
                type="button"
                onClick={pickAfter}
                className="w-full px-4 py-2.5 bg-blue-600 text-white text-xl font-semibold rounded-lg shadow hover:bg-blue-700 active:opacity-80 transition text-center"
              >
                After
              </button>

              <button
                type="button"
                onClick={pickOther}
                className="w-full px-4 py-2.5 bg-blue-600 text-white text-xl font-semibold rounded-lg shadow hover:bg-blue-700 active:opacity-80 transition text-center"
              >
                Other
              </button>
            </div>
          )}
        </div>
      </ModalShell>
    );
  }

  // ── Render: Browser ───────────────────────────────────────────────────────
  return (
    <ModalShell onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={goBack}
            className="text-blue-600 text-sm font-semibold shrink-0 hover:text-blue-800"
          >
            ← Back
          </button>
          <h2 className="text-base font-bold text-gray-900 truncate">
            {currentFolder ? currentFolder.name : "All Files"}
          </h2>
        </div>
        <div className="flex items-center gap-5 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-blue-700 transition disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "+ Upload"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl p-2 -mr-1"
          >
            ×
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1 p-4">
        {loading && (
          <div className="py-10 text-sm text-gray-400 text-center">Loading…</div>
        )}

        {!loading && error && (
          <div className="py-10 text-sm text-red-500 text-center">{error}</div>
        )}

        {!loading && !error && files.length === 0 && (
          <div className="py-10 text-sm text-gray-400 text-center">
            No files yet — tap Upload to add photos or documents.
          </div>
        )}

        {!loading && files.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {folders.map((folder) => (
              <FolderTile key={folder.id} folder={folder} onNavigate={navigateIntoFolder} />
            ))}
            {regularFiles.map((file) => (
              <FileTile key={file.id} file={file} onOpen={openFile} />
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
