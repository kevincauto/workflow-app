"use client";

import { Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { JiraImageAttachment } from "@/lib/types";

export interface UploadedTicketImage {
  id: string;
  file: File;
  previewUrl: string;
}

interface TicketImagesPanelProps {
  ticketKey: string;
  jiraImages: JiraImageAttachment[];
  uploadedImages: UploadedTicketImage[];
  onAddFiles: (files: File[]) => void;
  onExcludeJiraImage: (attachmentId: string) => void;
  onRemoveUploadedImage: (imageId: string) => void;
}

interface PreviewImage {
  id: string;
  src: string;
  filename: string;
  source: "Jira" | "Upload";
  size: number | null;
}

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

export function TicketImagesPanel({
  ticketKey,
  jiraImages,
  uploadedImages,
  onAddFiles,
  onExcludeJiraImage,
  onRemoveUploadedImage,
}: TicketImagesPanelProps) {
  const [activeImage, setActiveImage] = useState<PreviewImage | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const images: PreviewImage[] = [
    ...jiraImages.map((image) => ({
      id: `jira-${image.id}`,
      src: `/api/jira/attachments/${encodeURIComponent(ticketKey)}/${encodeURIComponent(image.id)}`,
      filename: image.filename,
      source: "Jira" as const,
      size: image.size,
    })),
    ...uploadedImages.map((image) => ({
      id: image.id,
      src: image.previewUrl,
      filename: image.file.name,
      source: "Upload" as const,
      size: image.file.size,
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
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    const rejectedCount = files.length - imageFiles.length;

    setUploadError(
      rejectedCount
        ? `${rejectedCount} non-image ${rejectedCount === 1 ? "file was" : "files were"} ignored.`
        : null,
    );

    if (imageFiles.length) {
      onAddFiles(imageFiles);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-orange-300">
          Reference Images
        </p>
        <p className="mt-2 text-sm text-slate-300">
          Jira attachments and session uploads included with the AI package.
        </p>
      </div>

      {images.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {images.map((image) => (
            <article
              key={image.id}
              className="overflow-hidden rounded-lg border border-white/15 bg-slate-950/55"
            >
              <button
                type="button"
                onClick={() => setActiveImage(image)}
                className="block aspect-16/10 w-full overflow-hidden bg-black/25 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-300"
                aria-label={`View ${image.filename} larger`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.src}
                  alt={image.filename}
                  className="h-full w-full object-contain"
                />
              </button>
              <div className="flex min-h-16 items-center gap-3 border-t border-white/10 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {image.filename}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {image.source} · {formatFileSize(image.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (image.source === "Jira") {
                      onExcludeJiraImage(image.id.replace(/^jira-/, ""));
                    } else {
                      onRemoveUploadedImage(image.id);
                    }
                  }}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-300/25 text-rose-200 transition hover:bg-rose-400/10 focus:outline-none focus:ring-2 focus:ring-rose-300"
                  aria-label={`Remove ${image.filename} from package`}
                  title="Remove from package"
                >
                  <Trash2 aria-hidden="true" size={18} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">No images selected.</p>
      )}

      <label
        className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-cyan-200/35 bg-cyan-300/5 px-4 py-6 text-center transition hover:bg-cyan-300/10 focus-within:ring-2 focus-within:ring-cyan-300"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          addSelectedFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <Upload className="text-cyan-200" aria-hidden="true" size={28} />
        <span className="text-sm font-semibold text-slate-100">
          Drop images here or choose files
        </span>
        <input
          type="file"
          accept="image/*"
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
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 bg-slate-950/80 text-white focus:outline-none focus:ring-2 focus:ring-cyan-300 sm:right-8 sm:top-8"
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
