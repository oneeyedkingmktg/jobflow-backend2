// ============================================================================
// File: src/leadModalParts/LeadFilesPanel.jsx
// Phases: "jobs" → "picker" → "browser"
// Props:
//   leadId    — required
//   onClose   — required
//   jobId     — optional: when passed (from JobsPanel), jump straight to picker
//   jobName   — optional: display name for that job
// ============================================================================

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Browser } from "@capacitor/browser";
import { isNativeApp } from "../utils/platform";
import { JobsAPI } from "../api";
import { useAuth } from "../AuthContext";
import { useCompany } from "../CompanyContext";

const API_BASE = import.meta.env.APP_URL || import.meta.env.VITE_API_URL;

function getToken() {
  return localStorage.getItem("authToken");
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────
function FolderSVG({ className = "" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function BackArrow() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

// ── Grid folder card (jobs phase) ──────────────────────────────────────────────
function FolderCard({ label, sublabel, iconColorCls, iconBgCls, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-between py-5 px-3 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 active:scale-95 transition-all bg-white group"
    >
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${iconBgCls} group-hover:scale-105 transition-transform`}>
        <FolderSVG className={`w-10 h-10 ${iconColorCls}`} />
      </div>
      <div className="text-center w-full mt-3">
        <p className="text-xs font-bold text-gray-800 leading-tight truncate">{label}</p>
        {sublabel && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sublabel}</p>}
      </div>
    </button>
  );
}

// ── Row folder card (picker phase) ─────────────────────────────────────────────
function PickerRow({ label, description, iconColorCls, iconBgCls, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 active:scale-[0.98] transition-all bg-white w-full text-left group"
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${iconBgCls} group-hover:scale-105 transition-transform`}>
        <FolderSVG className={`w-9 h-9 ${iconColorCls}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-sm">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <ChevronRight />
    </button>
  );
}

// ── File tile ──────────────────────────────────────────────────────────────────
function fileBgColor(mimeType) {
  if (!mimeType) return "bg-gray-50";
  if (mimeType.startsWith("image/")) return "bg-gray-100";
  if (mimeType === "application/pdf") return "bg-red-50";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "bg-green-50";
  if (mimeType.includes("document") || mimeType.includes("word")) return "bg-blue-50";
  if (mimeType.startsWith("video/")) return "bg-purple-50";
  return "bg-gray-50";
}

function FileTypeEmoji({ mimeType }) {
  if (!mimeType) return <span className="text-2xl">📄</span>;
  if (mimeType === "application/pdf") return <span className="text-2xl">📄</span>;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <span className="text-2xl">📊</span>;
  if (mimeType.includes("document") || mimeType.includes("word")) return <span className="text-2xl">📝</span>;
  if (mimeType.startsWith("video/")) return <span className="text-2xl">🎥</span>;
  return <span className="text-2xl">📄</span>;
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
      className="flex flex-col rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md active:scale-95 transition-all bg-white"
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
          <FileTypeEmoji mimeType={file.mimeType} />
        )}
      </div>
      <div className="px-2 py-2 text-left">
        <p className="text-[11px] font-semibold text-gray-800 truncate">{file.name}</p>
        <p className="text-[10px] text-gray-400 truncate mt-0.5">
          {file.createdTime
            ? new Date(file.createdTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : ""}
          {file.size ? ` · ${formatSize(file.size)}` : ""}
        </p>
      </div>
    </button>
  );
}

// Also handle Drive sub-folders appearing in the browser view
function BrowserFolderTile({ folder, onNavigate }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(folder)}
      className="flex flex-col rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md active:scale-95 transition-all bg-white"
    >
      <div className="w-full aspect-square flex items-center justify-center bg-blue-50">
        <FolderSVG className="w-10 h-10 text-blue-400" />
      </div>
      <div className="px-2 py-2 text-left">
        <p className="text-[11px] font-semibold text-gray-800 truncate">{folder.name}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">Folder</p>
      </div>
    </button>
  );
}

// ── Modal shell ────────────────────────────────────────────────────────────────
function ModalShell({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-end md:items-center md:justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-white rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col w-full max-w-lg overflow-hidden"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function LeadFilesPanel({ leadId, onClose, jobId: initialJobId, jobName: initialJobName }) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const companyId = user?.role === "master" ? (currentCompany?.id || currentCompany?.companyId) : null;

  // phases: "jobs" | "picker" | "browser"
  const [phase, setPhase] = useState(initialJobId ? "picker" : "jobs");

  // "jobs" phase
  const [jobs, setJobs] = useState([]);
  const [rootFolderIds, setRootFolderIds] = useState(null);
  const [jobsLoading, setJobsLoading] = useState(!initialJobId);

  // "picker" phase
  const [selectedJob, setSelectedJob] = useState(
    initialJobId ? { id: initialJobId, jobName: initialJobName || "Project" } : null
  );
  const [pickerFolderIds, setPickerFolderIds] = useState(null);
  const [pickerLoading, setPickerLoading] = useState(!!initialJobId);

  // "browser" phase
  const [files, setFiles] = useState([]);
  const [browserFolders, setBrowserFolders] = useState([]);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [folderStack, setFolderStack] = useState([]);

  const fileInputRef = useRef(null);
  const currentFolder = folderStack[folderStack.length - 1] ?? null;

  // ── Load: jobs phase ──────────────────────────────────────────────────────
  useEffect(() => {
    if (initialJobId) {
      loadPickerPhase(initialJobId);
      return;
    }
    (async () => {
      setJobsLoading(true);
      try {
        const [jobsData, folderData] = await Promise.all([
          JobsAPI.getAll(leadId, companyId),
          fetch(
            `${API_BASE}/google-drive/lead-folder-init?leadId=${leadId}`,
            { headers: { Authorization: `Bearer ${getToken()}` } }
          ).then((r) => r.json()),
        ]);
        setJobs(jobsData.jobs || []);
        if (folderData.ok) setRootFolderIds(folderData);
      } catch (err) {
        console.error("LeadFilesPanel jobs load error:", err);
      } finally {
        setJobsLoading(false);
      }
    })();
  }, [leadId]);

  // ── Load: picker phase for a specific job ──────────────────────────────────
  async function loadPickerPhase(jobId) {
    setPickerLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/google-drive/job-folder-init?leadId=${leadId}&jobId=${jobId}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not set up folders");
      setPickerFolderIds(data);
    } catch (err) {
      console.error("Picker load error:", err);
    } finally {
      setPickerLoading(false);
    }
  }

  // ── Load: browser phase ────────────────────────────────────────────────────
  const fetchFiles = useCallback(async (folderId) => {
    setBrowserLoading(true);
    setError(null);
    try {
      const url = folderId
        ? `${API_BASE}/google-drive/folder-contents?folderId=${folderId}`
        : `${API_BASE}/google-drive/lead-files?leadId=${leadId}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load files");
      const all = data.files || [];
      setBrowserFolders(all.filter((f) => f.mimeType === "application/vnd.google-apps.folder"));
      setFiles(all.filter((f) => f.mimeType !== "application/vnd.google-apps.folder"));
    } catch (err) {
      setError("Could not load files.");
    } finally {
      setBrowserLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (phase === "browser") {
      fetchFiles(currentFolder?.id || null);
    }
  }, [phase, folderStack]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  function selectJob(job) {
    setSelectedJob(job);
    setPickerFolderIds(null);
    setPhase("picker");
    loadPickerPhase(job.id);
  }

  function selectRootFolder(folder, name) {
    setFolderStack([{ id: folder.id, name }]);
    setPhase("browser");
  }

  function selectSubFolder(folderId, folderName) {
    setFolderStack([{ id: folderId, name: folderName }]);
    setPhase("browser");
  }

  function navigateIntoFolder(folder) {
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
  }

  function goBack() {
    if (phase === "browser") {
      if (folderStack.length > 1) {
        setFolderStack((prev) => prev.slice(0, -1));
      } else {
        // return to picker if we came from a job, else jobs
        setFolderStack([]);
        setPhase(selectedJob ? "picker" : "jobs");
      }
    } else if (phase === "picker") {
      if (initialJobId) {
        onClose();
      } else {
        setSelectedJob(null);
        setPickerFolderIds(null);
        setPhase("jobs");
      }
    }
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleFileChange(e) {
    const selected = Array.from(e.target.files);
    if (!selected.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of selected) {
        const formData = new FormData();
        formData.append("leadId", leadId);
        if (currentFolder?.id) formData.append("folderId", currentFolder.id);
        formData.append("file", file);
        const res = await fetch(`${API_BASE}/google-drive/upload-file`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
      }
      await fetchFiles(currentFolder?.id || null);
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

  // ── Shared header ──────────────────────────────────────────────────────────
  function Header({ title, subtitle }) {
    return (
      <div className="bg-blue-600 text-white px-4 py-4 flex items-center gap-3 shrink-0">
        {phase !== "jobs" && (
          <button onClick={goBack} className="text-white/80 hover:text-white p-1 shrink-0">
            <BackArrow />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base truncate">{title}</div>
          {subtitle && <div className="text-white/60 text-xs mt-0.5 truncate">{subtitle}</div>}
        </div>
        {phase === "browser" && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          >
            {uploading ? "…" : "+ Upload"}
          </button>
        )}
        <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none shrink-0 ml-1">
          ×
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    );
  }

  // ── Render: Jobs phase ─────────────────────────────────────────────────────
  if (phase === "jobs") {
    return (
      <ModalShell onClose={onClose}>
        <Header title="Photos & Files" />
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {jobsLoading && (
            <div className="py-10 text-sm text-gray-400 text-center">Setting up folders…</div>
          )}

          {!jobsLoading && (
            <>
              {/* Job project folders */}
              {jobs.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Projects</p>
                  <div className="grid grid-cols-2 gap-3">
                    {jobs.map((job) => (
                      <FolderCard
                        key={job.id}
                        label={job.jobName}
                        sublabel={job.status ? job.status.replace("_", " ") : "Project"}
                        iconColorCls="text-blue-500"
                        iconBgCls="bg-blue-50"
                        onClick={() => selectJob(job)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {jobs.length === 0 && (
                <div className="text-center py-4 text-sm text-gray-400 border border-dashed border-gray-200 rounded-2xl">
                  No projects yet — add a project first to get project folders.
                </div>
              )}

              {/* Root folders */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">General</p>
                <div className="grid grid-cols-2 gap-3">
                  <FolderCard
                    label="Other"
                    sublabel="General files"
                    iconColorCls="text-amber-500"
                    iconBgCls="bg-amber-50"
                    onClick={() => rootFolderIds?.other && selectRootFolder(rootFolderIds.other, "Other")}
                  />
                  <FolderCard
                    label="Visualizer Images"
                    sublabel="Floor renders"
                    iconColorCls="text-violet-500"
                    iconBgCls="bg-violet-50"
                    onClick={() => rootFolderIds?.visualizer && selectRootFolder(rootFolderIds.visualizer, "Visualizer Images")}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </ModalShell>
    );
  }

  // ── Render: Picker phase ───────────────────────────────────────────────────
  if (phase === "picker") {
    return (
      <ModalShell onClose={onClose}>
        <Header
          title={selectedJob?.jobName || "Project"}
          subtitle="Select a folder"
        />
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {pickerLoading && (
            <div className="py-10 text-sm text-gray-400 text-center">Setting up folders…</div>
          )}

          {!pickerLoading && (
            <>
              <PickerRow
                label="Before"
                description="Photos taken before the job"
                iconColorCls="text-sky-500"
                iconBgCls="bg-sky-50"
                onClick={() => pickerFolderIds?.before && selectSubFolder(pickerFolderIds.before.id, "Before")}
              />
              <PickerRow
                label="After"
                description="Completed job photos"
                iconColorCls="text-emerald-500"
                iconBgCls="bg-emerald-50"
                onClick={() => pickerFolderIds?.after && selectSubFolder(pickerFolderIds.after.id, "After")}
              />
              <PickerRow
                label="Other"
                description="Documents, invoices, misc"
                iconColorCls="text-amber-500"
                iconBgCls="bg-amber-50"
                onClick={() => pickerFolderIds?.other && selectSubFolder(pickerFolderIds.other.id, "Other")}
              />
            </>
          )}
        </div>
      </ModalShell>
    );
  }

  // ── Render: Browser phase ──────────────────────────────────────────────────
  return (
    <ModalShell onClose={onClose}>
      <Header
        title={currentFolder?.name || "Files"}
        subtitle={selectedJob?.jobName || undefined}
      />
      <div className="flex-1 overflow-y-auto p-4">
        {browserLoading && (
          <div className="py-10 text-sm text-gray-400 text-center">Loading…</div>
        )}
        {!browserLoading && error && (
          <div className="py-10 text-sm text-red-500 text-center">{error}</div>
        )}
        {!browserLoading && !error && browserFolders.length === 0 && files.length === 0 && (
          <div className="py-10 text-sm text-gray-400 text-center">
            No files yet — tap Upload to add photos or documents.
          </div>
        )}
        {!browserLoading && !error && (browserFolders.length > 0 || files.length > 0) && (
          <div className="grid grid-cols-3 gap-3">
            {browserFolders.map((folder) => (
              <BrowserFolderTile key={folder.id} folder={folder} onNavigate={navigateIntoFolder} />
            ))}
            {files.map((file) => (
              <FileTile key={file.id} file={file} onOpen={openFile} />
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
