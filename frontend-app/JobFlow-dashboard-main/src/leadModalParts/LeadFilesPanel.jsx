// ============================================================================
// File: src/leadModalParts/LeadFilesPanel.jsx
// Purpose: Inline panel for viewing and uploading files to Google Drive
// ============================================================================

import React, { useEffect, useRef, useState } from "react";
import { Browser } from "@capacitor/browser";
import { isNativeApp } from "../utils/platform";

const API_BASE = import.meta.env.APP_URL || import.meta.env.VITE_API_URL;

function getToken() {
  return localStorage.getItem("authToken");
}

function fileIcon(mimeType) {
  if (!mimeType) return "📄";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("document") || mimeType.includes("word")) return "📝";
  if (mimeType.includes("video/")) return "🎥";
  return "📁";
}

function formatSize(bytes) {
  if (!bytes) return "";
  const kb = Number(bytes) / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function LeadFilesPanel({ leadId }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!leadId) return;
    fetchFiles();
  }, [leadId]);

  async function fetchFiles() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/google-drive/lead-files?leadId=${leadId}`, {
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

  async function handleFileChange(e) {
    const selected = Array.from(e.target.files);
    if (!selected.length) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of selected) {
        const formData = new FormData();
        formData.append("leadId", leadId);
        formData.append("file", file);

        const res = await fetch(`${API_BASE}/google-drive/upload-file`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
      }
      await fetchFiles();
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

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <span className="font-semibold text-sm text-gray-800">Photos &amp; Files</span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg shadow hover:bg-blue-700 transition disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "+ Upload"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.mp4,.mov"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* File list */}
      <div className="divide-y divide-gray-100">
        {loading && (
          <div className="px-4 py-4 text-sm text-gray-400 text-center">Loading…</div>
        )}

        {!loading && error && (
          <div className="px-4 py-4 text-sm text-red-500 text-center">{error}</div>
        )}

        {!loading && !error && files.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-400 text-center">No files yet</div>
        )}

        {!loading && files.map((file) => (
          <button
            key={file.id}
            type="button"
            onClick={() => openFile(file.webViewLink)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 transition"
          >
            <span className="text-xl leading-none">{fileIcon(file.mimeType)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-400">
                {file.createdTime
                  ? new Date(file.createdTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : ""}
                {file.size ? ` · ${formatSize(file.size)}` : ""}
              </p>
            </div>
            <span className="text-gray-400 text-xs">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
