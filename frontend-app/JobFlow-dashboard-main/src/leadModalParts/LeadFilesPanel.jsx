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
  return "📁";
}

function formatSize(bytes) {
  if (!bytes) return "";
  const kb = Number(bytes) / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
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
      {/* Thumbnail or icon */}
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

      {/* File name + meta */}
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
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center md:justify-center justify-end"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-xl flex flex-col w-full max-w-lg max-h-[80vh] md:mx-4"
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
            <div className="grid grid-cols-3 gap-3">
              {files.map((file) => (
                <FileTile key={file.id} file={file} onOpen={openFile} />
              ))}
            </div>
          )}
        </div>

        {/* Safe area spacer for iOS home indicator */}
        <div className="h-4" />
      </div>
    </div>
  );
}
