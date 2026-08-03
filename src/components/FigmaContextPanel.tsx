"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import type { NormalizedFigmaContext } from "@/lib/types";

const minZoom = 0.5;
const maxZoom = 4;
const zoomStep = 0.25;

interface FigmaContextPanelProps {
  label: string;
  figmaUrl: string;
  figma: NormalizedFigmaContext | null;
  loading: boolean;
  canAdd: boolean;
  removable: boolean;
  onUrlChange: (url: string) => void;
  onExtract: () => void;
  onClear: () => void;
  onAdd: () => void;
  onRemove: () => void;
}

export function FigmaContextPanel({
  label,
  figmaUrl,
  figma,
  loading,
  canAdd,
  removable,
  onUrlChange,
  onExtract,
  onClear,
  onAdd,
  onRemove,
}: FigmaContextPanelProps) {
  const [previewZoom, setPreviewZoom] = useState(1);

  function updatePreviewZoom(nextZoom: number) {
    setPreviewZoom(Math.min(maxZoom, Math.max(minZoom, nextZoom)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
          {label}
        </p>
        <div className="flex gap-2">
          {canAdd ? (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-300/40 text-cyan-100 transition hover:bg-cyan-300/10 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              aria-label="Add second Figma context"
              title="Add Figma context"
            >
              <Plus aria-hidden="true" size={19} />
            </button>
          ) : null}
          {removable ? (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-rose-300/25 text-rose-200 transition hover:bg-rose-400/10 focus:outline-none focus:ring-2 focus:ring-rose-300"
              aria-label={`Remove ${label}`}
              title="Remove Figma context"
            >
              <Trash2 aria-hidden="true" size={18} />
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          type="url"
          value={figmaUrl}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="Paste a Figma file or selected-node URL"
          className="min-h-12 flex-1 rounded-2xl border border-white/15 bg-slate-950/60 px-4 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setPreviewZoom(1);
              onExtract();
            }}
            disabled={loading || !figmaUrl.trim()}
            className="rounded-2xl border border-cyan-300/50 bg-slate-950/25 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-slate-950/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Extracting..." : "Extract Figma Context"}
          </button>
          {figma ? (
            <button
              type="button"
              onClick={() => {
                setPreviewZoom(1);
                onClear();
              }}
              className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-white/15 bg-slate-950/25 text-slate-100 transition hover:bg-slate-950/40 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              aria-label={`Clear extracted ${label}`}
              title="Clear extracted context"
            >
              <X aria-hidden="true" size={19} />
            </button>
          ) : null}
        </div>
      </div>

      {figma ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="overflow-hidden rounded-2xl border border-white/15 bg-slate-950/45">
            {figma.previewImageUrl ? (
              <div>
                <div className="flex flex-col gap-3 border-b border-white/10 bg-slate-950/55 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
                    Preview {Math.round(previewZoom * 100)}%
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updatePreviewZoom(previewZoom - zoomStep)}
                      disabled={previewZoom <= minZoom}
                      className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-950/40 px-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-950/60 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Zoom out Figma preview"
                      title="Zoom out"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePreviewZoom(1)}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-white/15 bg-slate-950/40 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-100 transition hover:bg-slate-950/60"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePreviewZoom(previewZoom + zoomStep)}
                      disabled={previewZoom >= maxZoom}
                      className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-950/40 px-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-950/60 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Zoom in Figma preview"
                      title="Zoom in"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="max-h-[70vh] overflow-auto bg-slate-950/70 p-4">
                  <div
                    className="origin-top-left"
                    style={{
                      width: `${previewZoom * 100}%`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={figma.previewImageUrl}
                      alt={figma.selectedNodeName}
                      className="w-full max-w-none select-none rounded-xl border border-white/10 bg-white/5"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-64 items-center justify-center p-6 text-center text-sm text-slate-300">
                No preview image available.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-orange-300">
                {figma.fileName}
              </p>
              <h3 className="mt-2 text-base font-semibold text-slate-50">
                {figma.selectedNodeName}
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                {figma.selectedNodeType} · {figma.dimensions.width ?? "?"} x{" "}
                {figma.dimensions.height ?? "?"}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                  Layout
                </p>
                <p className="mt-2 text-sm text-slate-100">
                  {figma.layout.mode ?? "Unknown"}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Spacing: {figma.layout.itemSpacing ?? "Unknown"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                  Tokens
                </p>
                <p className="mt-2 text-sm text-slate-100">
                  {figma.colors.length} colors
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {figma.text.length} text nodes
                </p>
              </div>
            </div>

            {figma.colors.length ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                  Colors
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {figma.colors.slice(0, 10).map((color) => (
                    <span
                      key={`${color.name}-${color.value}`}
                      className="rounded-full border border-white/15 bg-slate-950/45 px-3 py-1 text-xs text-slate-100"
                    >
                      {color.value}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {figma.ambiguityNotes.length ? (
              <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm text-amber-50">
                {figma.ambiguityNotes.join(" ")}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/20 bg-slate-950/25 p-4 text-sm text-slate-200">
          Figma context is optional for the generated AI package.
        </div>
      )}
    </div>
  );
}
