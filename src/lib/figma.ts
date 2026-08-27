import type {
  FigmaColorToken,
  FigmaControlOrientation,
  FigmaDetectedControl,
  FigmaDetectedControlType,
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
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  visible?: boolean;
  componentId?: string;
  componentSetId?: string;
  componentProperties?: Record<
    string,
    {
      type?: string;
      value?: string | boolean | number;
    }
  >;
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
const figmaExtractionDepth = 6;
const maxCollectedDesignTokens = 40;
const maxDetectedControls = 40;

export class FigmaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FigmaApiError";
  }
}
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

async function fetchFigmaJson<T>(path: string, operation: string): Promise<T> {
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
      if (response.status === 403) {
        throw new FigmaApiError(
          `Figma denied access while reading the ${operation} (403). Confirm FIGMA_ACCESS_TOKEN has the file_content:read scope and belongs to a user who can open this Figma file.`,
          response.status,
        );
      }

      throw new FigmaApiError(
        `Figma ${operation} request failed with status ${response.status}.`,
        response.status,
      );
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

function normalizeName(value: string | undefined) {
  return (value ?? "").toLowerCase();
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function getComponentPropertyText(node: FigmaNode) {
  return Object.entries(node.componentProperties ?? {})
    .map(([key, property]) => `${key} ${String(property.value ?? "")}`)
    .join(" ")
    .toLowerCase();
}

function getNodeSearchText(node: FigmaNode) {
  return [
    node.name,
    node.type,
    node.componentId,
    node.componentSetId,
    getComponentPropertyText(node),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isVisibleNode(node: FigmaNode) {
  return node.visible !== false;
}

function collectTextLabels(node: FigmaNode, labels: string[], limit = 12) {
  if (labels.length >= limit || !isVisibleNode(node)) {
    return;
  }

  if (node.type === "TEXT" && node.characters?.trim()) {
    labels.push(node.characters.trim().replace(/\s+/g, " "));
  }

  for (const child of node.children ?? []) {
    collectTextLabels(child, labels, limit);
  }
}

function getTextLabels(node: FigmaNode, limit = 12) {
  const labels: string[] = [];
  collectTextLabels(node, labels, limit);
  return Array.from(new Set(labels));
}

function getOrientationFromGeometry(
  children: FigmaNode[],
): FigmaControlOrientation {
  const boxes = children
    .map((child) => child.absoluteBoundingBox)
    .filter(
      (box): box is { x: number; y: number; width?: number; height?: number } =>
        typeof box?.x === "number" && typeof box.y === "number",
    );

  if (boxes.length < 2) {
    return "unknown";
  }

  const xValues = boxes.map((box) => box.x);
  const yValues = boxes.map((box) => box.y);
  const xSpread = Math.max(...xValues) - Math.min(...xValues);
  const ySpread = Math.max(...yValues) - Math.min(...yValues);

  if (ySpread > 8 && xSpread <= 12) {
    return "vertical";
  }

  if (xSpread > 8 && ySpread <= 12) {
    return "horizontal";
  }

  if (xSpread > 8 && ySpread > 8) {
    return "grid";
  }

  return "unknown";
}

function getOrientation(node: FigmaNode, optionNodes: FigmaNode[]) {
  if (node.layoutMode === "VERTICAL") {
    return "vertical";
  }

  if (node.layoutMode === "HORIZONTAL") {
    return "horizontal";
  }

  return getOrientationFromGeometry(optionNodes);
}

function getOptionNodes(
  node: FigmaNode,
  controlType: FigmaDetectedControlType,
) {
  const children = (node.children ?? []).filter(isVisibleNode);

  if (controlType === "dropdown") {
    return children;
  }

  const optionTerms = [
    "option",
    "radio",
    "checkbox",
    "choice",
    "item",
    "selected",
    "unselected",
    "checked",
    "unchecked",
  ];
  const matchingChildren = children.filter((child) =>
    includesAny(getNodeSearchText(child), optionTerms),
  );

  return matchingChildren.length >= 2 ? matchingChildren : children;
}

function getControlType(node: FigmaNode): FigmaDetectedControlType | null {
  const text = getNodeSearchText(node);
  const name = normalizeName(node.name);

  if (includesAny(name, ["radio group", "radio-group", "radio button group"])) {
    return "radio-group";
  }

  if (includesAny(name, ["checkbox group", "checkbox-group"])) {
    return "checkbox-group";
  }

  if (
    name === "select" ||
    name === "_selecttrigger" ||
    includesAny(text, ["dropdown", "drop down", "select menu", "combobox"])
  ) {
    return "dropdown";
  }

  if (includesAny(name, ["segmented", "segment control", "toggle group"])) {
    return "segmented-control";
  }

  if (includesAny(name, ["tabs", "tab group", "tablist"])) {
    return "tabs";
  }

  return null;
}

function isBroadLayoutContainer(node: FigmaNode) {
  const text = getNodeSearchText(node);

  return includesAny(text, [
    "main",
    "page",
    "header",
    "footer",
    "content",
    "container",
    "section",
    "wrapper",
    "layout",
  ]);
}

function getGuidance(input: {
  controlType: FigmaDetectedControlType;
  orientation: FigmaControlOrientation;
  optionCount: number;
}) {
  const orientationText =
    input.orientation === "vertical"
      ? " Preserve vertical stacking."
      : input.orientation === "horizontal"
        ? " Preserve horizontal layout."
        : input.orientation === "grid"
          ? " Preserve the grid-style option layout."
          : " Verify orientation against the Figma preview before coding.";

  if (input.controlType === "radio-group") {
    return `Implement as a radio button group with ${input.optionCount} options, not as a dropdown/select.${orientationText}`;
  }

  if (input.controlType === "checkbox-group") {
    return `Implement as a checkbox group with ${input.optionCount} options.${orientationText}`;
  }

  if (input.controlType === "dropdown") {
    return "Implement as a dropdown/select only if the Figma control shows a closed select, menu trigger, or chevron affordance.";
  }

  if (input.controlType === "segmented-control") {
    return `Implement as a segmented control with ${input.optionCount} segments.${orientationText}`;
  }

  if (input.controlType === "tabs") {
    return `Implement as tabs with ${input.optionCount} tab options.${orientationText}`;
  }

  return `This appears to be a choice group with ${input.optionCount} options.${orientationText}`;
}

function buildDetectedControl(
  node: FigmaNode,
  controlType: FigmaDetectedControlType,
): FigmaDetectedControl | null {
  const optionNodes = getOptionNodes(node, controlType);
  const optionLabels = optionNodes.flatMap((child) => getTextLabels(child, 3));
  const fallbackLabels = getTextLabels(node, 12);
  const options = Array.from(
    new Set(optionLabels.length ? optionLabels : fallbackLabels),
  )
    .filter((label) => normalizeName(label) !== normalizeName(node.name))
    .slice(0, 12);
  const optionCount =
    controlType === "dropdown"
      ? Math.max(options.length, 1)
      : Math.max(options.length, optionNodes.length);

  if (controlType !== "dropdown" && optionCount < 2) {
    return null;
  }

  const orientation = getOrientation(node, optionNodes);
  const evidence = [
    `Layer name: ${node.name ?? "Unnamed"}`,
    node.layoutMode ? `Auto layout: ${node.layoutMode}` : null,
    optionNodes.length
      ? `Candidate option layers: ${optionNodes.length}`
      : null,
    options.length ? `Text labels: ${options.join(", ")}` : null,
    getComponentPropertyText(node)
      ? `Component properties: ${getComponentPropertyText(node)}`
      : null,
  ].filter((item): item is string => Boolean(item));
  const confidence =
    controlType !== "unknown-choice-group" &&
    (orientation !== "unknown" || options.length >= 2)
      ? "high"
      : options.length >= 2
        ? "medium"
        : "low";

  return {
    name: node.name ?? "Unnamed control",
    controlType,
    orientation,
    optionCount,
    options,
    confidence,
    evidence: evidence.slice(0, 6),
    guidance: getGuidance({ controlType, orientation, optionCount }),
  };
}

function looksLikeChoiceGroup(node: FigmaNode) {
  const children = (node.children ?? []).filter(isVisibleNode);
  const text = getNodeSearchText(node);

  if (children.length < 2 || children.length > 8) {
    return false;
  }

  if (isBroadLayoutContainer(node)) {
    return false;
  }

  if (!includesAny(text, ["choice group", "option group", "selection group"])) {
    return false;
  }

  const textChildCount = children.filter(
    (child) => getTextLabels(child, 1).length > 0,
  ).length;
  return textChildCount >= 2;
}

function collectDetectedControls(
  node: FigmaNode,
  controls: FigmaDetectedControl[],
  visited: { count: number },
) {
  if (
    visited.count >= maxTraversalNodes ||
    controls.length >= maxDetectedControls
  ) {
    return;
  }

  visited.count += 1;

  if (isVisibleNode(node)) {
    const nodeName = normalizeName(node.name);
    const explicitType = getControlType(node);
    const isInternalTrigger =
      nodeName.startsWith("_") && nodeName.includes("trigger");
    const inferredType = isInternalTrigger
      ? null
      : (explicitType ??
        (looksLikeChoiceGroup(node) ? "unknown-choice-group" : null));
    const detectedControl = inferredType
      ? buildDetectedControl(node, inferredType)
      : null;

    if (detectedControl) {
      controls.push(detectedControl);
    }
  }

  for (const child of node.children ?? []) {
    collectDetectedControls(child, controls, visited);
  }
}

function getDetectedControls(node: FigmaNode) {
  const controls: FigmaDetectedControl[] = [];
  collectDetectedControls(node, controls, { count: 0 });

  const bestByName = new Map<string, FigmaDetectedControl>();
  for (const control of controls) {
    const key = `${control.name}-${control.controlType}-${control.options.join("|")}`;
    const existingControl = bestByName.get(key);

    if (
      !existingControl ||
      control.evidence.length > existingControl.evidence.length
    ) {
      bestByName.set(key, control);
    }
  }

  return Array.from(bestByName.values()).slice(0, maxDetectedControls);
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
  const detectedControls = getDetectedControls(input.node);

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
    detectedControls,
    implementationNotes: [
      "Use this normalized Figma context as visual guidance, not as raw source code.",
      "Preserve spacing, text hierarchy, colors, radii, and layout direction where they are represented here.",
      "Preserve detected control types and option orientation. Do not replace radio groups with dropdowns unless the detected control says dropdown.",
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
    "preview image",
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
      "selected node",
    );
    selectedNode = nodesPayload.nodes?.[parts.nodeId]?.document ?? undefined;
  } else {
    const file = await fetchFigmaJson<FigmaFilePayload>(
      `/files/${encodeURIComponent(parts.fileKey)}?depth=${figmaExtractionDepth}`,
      "file",
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
