import type {
  FigmaColorToken,
  FigmaLayerNode,
  FigmaTextNode,
  FigmaUrlParts,
  NormalizedFigmaContext,
} from "@/lib/types";

interface FigmaNode {
  id?: string;
  name?: string;
  type?: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: {
    width?: number;
    height?: number;
  };
  layoutMode?: string;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  fills?: Array<{
    type?: string;
    visible?: boolean;
    color?: {
      r?: number;
      g?: number;
      b?: number;
      a?: number;
    };
  }>;
  characters?: string;
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    lineHeightPx?: number;
    lineHeightPercent?: number;
  };
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
}

interface FigmaFilePayload {
  name?: string;
  document?: FigmaNode;
}

interface FigmaNodesPayload {
  nodes?: Record<
    string,
    {
      document?: FigmaNode;
    } | null
  >;
}

interface FigmaImagesPayload {
  images?: Record<string, string | null>;
}

const figmaRequestTimeoutMs = 20_000;
const figmaExtractionDepth = 4;
const maxCollectedDesignTokens = 40;
const maxTraversalNodes = 500;

export function parseFigmaUrl(value: string): FigmaUrlParts {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid Figma file or selected-node URL.");
  }

  if (!url.hostname.endsWith("figma.com")) {
    throw new Error("Enter a Figma URL from figma.com.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const fileIndex = segments.findIndex(
    (segment) => segment === "file" || segment === "design",
  );
  const fileKey = fileIndex >= 0 ? segments[fileIndex + 1] : null;

  if (!fileKey) {
    throw new Error("The Figma URL does not include a file key.");
  }

  const rawNodeId = url.searchParams.get("node-id");
  const nodeId = rawNodeId ? rawNodeId.replace(/-/g, ":") : null;
  const rawFileName = segments[fileIndex + 2] ?? null;
  const fileName = rawFileName
    ? decodeURIComponent(rawFileName).replace(/-/g, " ")
    : null;

  return {
    fileKey,
    nodeId,
    fileName,
    url: value,
  };
}

function isFigmaConfigured() {
  return Boolean(process.env.FIGMA_ACCESS_TOKEN);
}

function getFigmaToken() {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) {
    throw new Error("FIGMA_ACCESS_TOKEN is not configured.");
  }

  return token;
}

async function fetchFigmaJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), figmaRequestTimeoutMs);

  try {
    const response = await fetch(`https://api.figma.com/v1${path}`, {
      headers: {
        Accept: "application/json",
        "X-Figma-Token": getFigmaToken(),
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Figma request failed with status ${response.status}.`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "Figma extraction timed out. Try a selected frame or component URL instead of the whole file.",
      );
    }

    if (error instanceof Error && error.message === "terminated") {
      throw new Error(
        "Figma closed the request before extraction completed. Try a selected frame or component URL instead of the whole file.",
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function colorChannel(value: number | undefined) {
  return Math.round(Math.max(0, Math.min(1, value ?? 0)) * 255);
}

function toHexColor(color: { r?: number; g?: number; b?: number; a?: number }) {
  const hex = [color.r, color.g, color.b]
    .map((channel) => colorChannel(channel).toString(16).padStart(2, "0"))
    .join("");
  const alpha = color.a ?? 1;

  return alpha < 1 ? `#${hex} / ${alpha.toFixed(2)}` : `#${hex}`;
}

function collectColors(
  node: FigmaNode,
  tokens: Map<string, FigmaColorToken>,
  visited: { count: number },
) {
  if (
    visited.count >= maxTraversalNodes ||
    tokens.size >= maxCollectedDesignTokens
  ) {
    return;
  }

  visited.count += 1;

  for (const fill of node.fills ?? []) {
    if (fill.type === "SOLID" && fill.visible !== false && fill.color) {
      const value = toHexColor(fill.color);
      tokens.set(`${node.name ?? "Layer"}-${value}`, {
        name: node.name ?? "Layer color",
        value,
      });
    }
  }

  for (const child of node.children ?? []) {
    collectColors(child, tokens, visited);
  }
}

function collectText(
  node: FigmaNode,
  textNodes: FigmaTextNode[],
  visited: { count: number },
) {
  if (
    visited.count >= maxTraversalNodes ||
    textNodes.length >= maxCollectedDesignTokens
  ) {
    return;
  }

  visited.count += 1;

  if (node.type === "TEXT" && node.characters?.trim()) {
    const lineHeight = node.style?.lineHeightPx
      ? `${node.style.lineHeightPx}px`
      : node.style?.lineHeightPercent
        ? `${node.style.lineHeightPercent}%`
        : null;

    textNodes.push({
      name: node.name ?? "Text",
      characters: node.characters.trim(),
      fontFamily: node.style?.fontFamily ?? null,
      fontSize: node.style?.fontSize ?? null,
      fontWeight: node.style?.fontWeight ?? null,
      lineHeight,
    });
  }

  for (const child of node.children ?? []) {
    collectText(child, textNodes, visited);
  }
}

function collectRadii(
  node: FigmaNode,
  radii: Set<number>,
  visited: { count: number },
) {
  if (
    visited.count >= maxTraversalNodes ||
    radii.size >= maxCollectedDesignTokens
  ) {
    return;
  }

  visited.count += 1;

  if (typeof node.cornerRadius === "number") {
    radii.add(node.cornerRadius);
  }

  for (const radius of node.rectangleCornerRadii ?? []) {
    if (typeof radius === "number") {
      radii.add(radius);
    }
  }

  for (const child of node.children ?? []) {
    collectRadii(child, radii, visited);
  }
}

function buildHierarchy(node: FigmaNode, depth = 0): FigmaLayerNode[] {
  if (depth >= 4) {
    return [];
  }

  return (node.children ?? []).slice(0, 24).map((child) => ({
    id: child.id ?? child.name ?? "unknown-node",
    name: child.name ?? "Unnamed layer",
    type: child.type ?? "UNKNOWN",
    children: buildHierarchy(child, depth + 1),
  }));
}

function normalizeFigmaContext(input: {
  parts: FigmaUrlParts;
  fileName: string;
  node: FigmaNode;
  previewImageUrl: string | null;
}): NormalizedFigmaContext {
  const colors = new Map<string, FigmaColorToken>();
  const text: FigmaTextNode[] = [];
  const radii = new Set<number>();

  collectColors(input.node, colors, { count: 0 });
  collectText(input.node, text, { count: 0 });
  collectRadii(input.node, radii, { count: 0 });

  return {
    source: "live",
    url: input.parts.url,
    fileKey: input.parts.fileKey,
    nodeId: input.parts.nodeId,
    fileName: input.fileName,
    selectedNodeName: input.node.name ?? input.fileName,
    selectedNodeType: input.node.type ?? "UNKNOWN",
    previewImageUrl: input.previewImageUrl,
    dimensions: {
      width: input.node.absoluteBoundingBox?.width ?? null,
      height: input.node.absoluteBoundingBox?.height ?? null,
    },
    layout: {
      mode: input.node.layoutMode ?? null,
      primaryAxisSizingMode: input.node.primaryAxisSizingMode ?? null,
      counterAxisSizingMode: input.node.counterAxisSizingMode ?? null,
      itemSpacing: input.node.itemSpacing ?? null,
      padding: {
        top: input.node.paddingTop ?? null,
        right: input.node.paddingRight ?? null,
        bottom: input.node.paddingBottom ?? null,
        left: input.node.paddingLeft ?? null,
      },
    },
    colors: Array.from(colors.values()).slice(0, maxCollectedDesignTokens),
    text: text.slice(0, maxCollectedDesignTokens),
    radii: Array.from(radii).sort((left, right) => left - right),
    hierarchy: buildHierarchy(input.node),
    implementationNotes: [
      "Use this normalized Figma context as visual guidance, not as raw source code.",
      "Preserve spacing, text hierarchy, colors, radii, and layout direction where they are represented here.",
    ],
    ambiguityNotes: [
      ...(input.previewImageUrl
        ? []
        : ["No preview image URL was available for the selected Figma node."]),
      ...(input.parts.nodeId
        ? []
        : [
            "No selected node was provided; context was extracted from the file root.",
          ]),
    ],
  };
}

async function fetchPreviewImage(fileKey: string, nodeId: string | null) {
  if (!nodeId) {
    return null;
  }

  const payload = await fetchFigmaJson<FigmaImagesPayload>(
    `/images/${encodeURIComponent(fileKey)}?ids=${encodeURIComponent(nodeId)}&format=png`,
  );

  return payload.images?.[nodeId] ?? null;
}

export async function extractFigmaContext(
  figmaUrl: string,
): Promise<NormalizedFigmaContext> {
  const parts = parseFigmaUrl(figmaUrl);

  if (!isFigmaConfigured()) {
    throw new Error("FIGMA_ACCESS_TOKEN is not configured.");
  }

  let selectedNode: FigmaNode | undefined;
  let fileName = parts.fileName ?? parts.fileKey;

  if (parts.nodeId) {
    const nodesPayload = await fetchFigmaJson<FigmaNodesPayload>(
      `/files/${encodeURIComponent(parts.fileKey)}/nodes?ids=${encodeURIComponent(parts.nodeId)}&depth=${figmaExtractionDepth}`,
    );
    selectedNode = nodesPayload.nodes?.[parts.nodeId]?.document ?? undefined;
  } else {
    const file = await fetchFigmaJson<FigmaFilePayload>(
      `/files/${encodeURIComponent(parts.fileKey)}?depth=${figmaExtractionDepth}`,
    );
    selectedNode = file.document;
    fileName = file.name ?? fileName;
  }

  if (!selectedNode) {
    throw new Error(
      "Figma did not return the selected node. Confirm the URL points to a frame, section, component, or layer you can access.",
    );
  }

  const previewImageUrl = await fetchPreviewImage(parts.fileKey, parts.nodeId);

  return normalizeFigmaContext({
    parts,
    fileName,
    node: selectedNode,
    previewImageUrl,
  });
}

export function getFigmaStatus() {
  return {
    configured: isFigmaConfigured(),
  };
}
