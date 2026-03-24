// ============================================================================
// File: src/leadModalParts/LeadFilesPanel.jsx
// Purpose: Modal for viewing and uploading files to Google Drive
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
  if (mimeType.startsWith("video/")) return "🎥";
  return "📁";
}

function formatSize(bytes) {
  if (!bytes) return "";
  const kb = Number(bytes) / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function LeadFilesPanel({ leadId, onClose }) {
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
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Sheet */}
      <div
        className="relative bg-white rounded-t-2xl shadow-xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">Photos &amp; Files</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-blue-700 transition disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "+ Upload"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
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

        {/* File list */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {loading && (
            <div className="px-5 py-8 text-sm text-gray-400 text-center">Loading…</div>
          )}

          {!loading && error && (
            <div className="px-5 py-8 text-sm text-red-500 text-center">{error}</div>
          )}

          {!loading && !error && files.length === 0 && (
            <div className="px-5 py-10 text-sm text-gray-400 text-center">
              No files yet — tap Upload to add photos or documents.
            </div>
          )}

          {!loading && files.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() => openFile(file.webViewLink)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 active:bg-gray-100 transition"
            >
              <span className="text-2xl leading-none">{fileIcon(file.mimeType)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
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
              <span className="text-gray-300 text-lg">›</span>
            </button>
          ))}
        </div>

        {/* Safe area spacer for iOS home indicator */}
        <div className="h-6" />
      </div>
    </div>
  );
}
