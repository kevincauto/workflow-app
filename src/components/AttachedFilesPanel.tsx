"use client";

import {
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { JiraAttachment } from "@/lib/types";

export interface UploadedTicketAttachment {
  id: string;
  file: File;
  previewUrl: string;
  explanation: string;
}

interface AttachedFilesPanelProps {
  ticketKey: string;
  jiraAttachments: JiraAttachment[];
  uploadedAttachments: UploadedTicketAttachment[];
  jiraExplanations: Record<string, string>;
  onAddFiles: (files: File[]) => void;
  onExcludeJiraAttachment: (attachmentId: string) => void;
  onRemoveUploadedAttachment: (attachmentId: string) => void;
  onJiraExplanationChange: (attachmentId: string, explanation: string) => void;
  onUploadedExplanationChange: (
    attachmentId: string,
    explanation: string,
  ) => void;
}

interface DisplayAttachment {
  id: string;
  attachmentId: string;
  src: string;
  filename: string;
  mimeType: string;
  source: "Jira" | "Upload";
  size: number | null;
  explanation: string;
}

const acceptedExtensions = new Set([
  "csv",
  "gif",
  "jpeg",
  "jpg",
  "json",
  "md",
  "png",
  "svg",
  "txt",
  "webp",
  "yaml",
  "yml",
]);

const fileInputAccept = [
  "image/*",
  ".txt",
  ".md",
  ".json",
  ".csv",
  ".yaml",
  ".yml",
].join(",");

function formatFileSize(size: number | null) {
  if (size === null) {
    return "Size unavailable";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function isSupportedFile(file: File) {
  return (
    file.type.startsWith("image/") ||
    acceptedExtensions.has(getExtension(file.name))
  );
}

function AttachmentIcon({
  filename,
  mimeType,
}: {
  filename: string;
  mimeType: string;
}) {
  const extension = getExtension(filename);
  const iconProps = { "aria-hidden": true, size: 34 } as const;

  if (mimeType.startsWith("image/")) {
    return <ImageIcon {...iconProps} />;
  }

  if (extension === "csv") {
    return <FileSpreadsheet {...iconProps} />;
  }

  return <FileText {...iconProps} />;
}

export function AttachedFilesPanel({
  ticketKey,
  jiraAttachments,
  uploadedAttachments,
  jiraExplanations,
  onAddFiles,
  onExcludeJiraAttachment,
  onRemoveUploadedAttachment,
  onJiraExplanationChange,
  onUploadedExplanationChange,
}: AttachedFilesPanelProps) {
  const [activeImage, setActiveImage] = useState<DisplayAttachment | null>(
    null,
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const attachments: DisplayAttachment[] = [
    ...jiraAttachments.map((attachment) => ({
      id: `jira-${attachment.id}`,
      attachmentId: attachment.id,
      src: `/api/jira/attachments/${encodeURIComponent(ticketKey)}/${encodeURIComponent(attachment.id)}`,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      source: "Jira" as const,
      size: attachment.size,
      explanation: jiraExplanations[attachment.id] ?? "",
    })),
    ...uploadedAttachments.map((attachment) => ({
      id: attachment.id,
      attachmentId: attachment.id,
      src: attachment.previewUrl,
      filename: attachment.file.name,
      mimeType: attachment.file.type || "application/octet-stream",
      source: "Upload" as const,
      size: attachment.file.size,
      explanation: attachment.explanation,
    })),
  ];

  useEffect(() => {
    if (!activeImage) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveImage(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeImage]);

  function addSelectedFiles(files: File[]) {
    const supportedFiles = files.filter(isSupportedFile);
    const rejectedCount = files.length - supportedFiles.length;

    setUploadError(
      rejectedCount
        ? `${rejectedCount} unsupported ${rejectedCount === 1 ? "file was" : "files were"} ignored.`
        : null,
    );

    if (supportedFiles.length) {
      onAddFiles(supportedFiles);
    }
  }

  return (
    <div className="space-y-5">
      {attachments.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {attachments.map((attachment) => {
            const isImage = attachment.mimeType.startsWith("image/");

            return (
              <article
                key={attachment.id}
                className="overflow-hidden rounded-lg border border-white/25 bg-[#07111f] shadow-md"
              >
                {isImage ? (
                  <button
                    type="button"
                    onClick={() => setActiveImage(attachment)}
                    className="block aspect-16/7 w-full overflow-hidden bg-black/25 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-300"
                    aria-label={`View ${attachment.filename} larger`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachment.src}
                      alt={attachment.filename}
                      className="h-full w-full object-contain"
                    />
                  </button>
                ) : (
                  <div className="flex min-h-28 items-center justify-center bg-red-300/5 text-red-400">
                    <AttachmentIcon
                      filename={attachment.filename}
                      mimeType={attachment.mimeType}
                    />
                  </div>
                )}

                <div className="space-y-3 border-t border-white/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-slate-100">
                        {attachment.filename}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {attachment.source} · {formatFileSize(attachment.size)}{" "}
                        · {attachment.mimeType}
                      </p>
                    </div>
                    {!isImage ? (
                      <a
                        href={attachment.src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-300/30 text-red-400 transition hover:bg-red-300/10 focus:outline-none focus:ring-2 focus:ring-red-300"
                        aria-label={`Open ${attachment.filename}`}
                        title="Open file"
                      >
                        <ExternalLink aria-hidden="true" size={18} />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (attachment.source === "Jira") {
                          onExcludeJiraAttachment(attachment.attachmentId);
                        } else {
                          onRemoveUploadedAttachment(attachment.attachmentId);
                        }
                      }}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-400/25 text-red-400 transition hover:bg-red-400/10 focus:outline-none focus:ring-2 focus:ring-red-400"
                      aria-label={`Remove ${attachment.filename} from package`}
                      title="Remove from package"
                    >
                      <Trash2 aria-hidden="true" size={18} />
                    </button>
                  </div>

                  <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-red-400">
                    Context for {attachment.filename}
                    <textarea
                      value={attachment.explanation}
                      onChange={(event) => {
                        if (attachment.source === "Jira") {
                          onJiraExplanationChange(
                            attachment.attachmentId,
                            event.target.value,
                          );
                        } else {
                          onUploadedExplanationChange(
                            attachment.attachmentId,
                            event.target.value,
                          );
                        }
                      }}
                      rows={3}
                      className="mt-2 w-full resize-y rounded-lg border border-white/20 bg-slate-950/60 px-3 py-2 text-sm font-normal leading-6 normal-case tracking-normal text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-red-300 focus:ring-2 focus:ring-red-300/25"
                      placeholder="Explain what this file shows and how the coding agent should use it."
                    />
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-400">No attachments selected.</p>
      )}

      <label
        className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-red-200/35 bg-red-300/5 px-4 py-6 text-center transition hover:bg-red-300/10 focus-within:ring-2 focus-within:ring-red-300"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          addSelectedFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <Upload className="text-red-400" aria-hidden="true" size={28} />
        <span className="text-sm font-semibold text-slate-100">
          Drop images or text files here, or choose files
        </span>
        <span className="text-xs text-slate-400">
          Images, text, Markdown, JSON, YAML, and CSV
        </span>
        <input
          type="file"
          accept={fileInputAccept}
          multiple
          className="sr-only"
          onChange={(event) => {
            addSelectedFiles(Array.from(event.target.files ?? []));
            event.currentTarget.value = "";
          }}
        />
      </label>

      {uploadError ? (
        <p className="text-sm text-amber-200" role="status">
          {uploadError}
        </p>
      ) : null}

      {activeImage ? (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/85 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={activeImage.filename}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveImage(null);
            }
          }}
        >
          <button
            type="button"
            onClick={() => setActiveImage(null)}
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 bg-slate-950/80 text-red-400 focus:outline-none focus:ring-2 focus:ring-red-300 sm:right-8 sm:top-8"
            aria-label="Close image preview"
            title="Close"
          >
            <X aria-hidden="true" size={22} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeImage.src}
            alt={activeImage.filename}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}
