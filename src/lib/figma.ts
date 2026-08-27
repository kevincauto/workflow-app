import type {
  FigmaColorToken,
  FigmaBounds,
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
  layoutAlign?: string;
  layoutGrow?: number;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  constraints?: {
    horizontal?: string;
    vertical?: string;
  };
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
  strokes?: Array<{
    type?: string;
    visible?: boolean;
    color?: {
      r?: number;
      g?: number;
      b?: number;
      a?: number;
    };
  }>;
  strokeWeight?: number;
  strokeAlign?: string;
  individualStrokeWeights?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
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
  components?: Record<string, FigmaComponentMetadata>;
  componentSets?: Record<string, FigmaComponentMetadata>;
}

interface FigmaComponentMetadata {
  name?: string;
  componentSetId?: string;
}

interface FigmaNodesPayload {
  nodes?: Record<
    string,
    {
      document?: FigmaNode;
      components?: Record<string, FigmaComponentMetadata>;
      componentSets?: Record<string, FigmaComponentMetadata>;
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
const maxIconMeasurements = 40;

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
  parentPath = "",
  semanticIconName: string | null = null,
) {
  if (
    visited.count >= maxTraversalNodes ||
    tokens.size >= maxCollectedDesignTokens ||
    !isVisibleNode(node)
  ) {
    return;
  }

  visited.count += 1;
  const name = node.name ?? "Layer";
  const path = parentPath ? `${parentPath} / ${name}` : name;
  const iconName = name.startsWith("li:") ? name : semanticIconName;
  const role = iconName
    ? path.toLowerCase().includes(" / attachment / actions /")
      ? "attachmentActionIcon"
      : path.toLowerCase().includes(" / actions /")
        ? "actionIcon"
        : "icon"
    : null;

  for (const fill of node.fills ?? []) {
    if (fill.type === "SOLID" && fill.visible !== false && fill.color) {
      const value = toHexColor(fill.color);
      const nodeId = node.id ?? path;
      tokens.set(`${nodeId}-${value}`, {
        name,
        color: value,
        value,
        nodeId,
        path,
        node: iconName ?? name,
        role,
      });
    }
  }

  for (const child of node.children ?? []) {
    collectColors(child, tokens, visited, path, iconName);
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

function getBounds(node: FigmaNode): FigmaBounds | null {
  const box = node.absoluteBoundingBox;
  return box &&
    typeof box.x === "number" &&
    typeof box.y === "number" &&
    typeof box.width === "number" &&
    typeof box.height === "number"
    ? { x: box.x, y: box.y, width: box.width, height: box.height }
    : null;
}

function getNodeLayout(node: FigmaNode) {
  return {
    mode: node.layoutMode ?? null,
    primaryAxisSizingMode: node.primaryAxisSizingMode ?? null,
    counterAxisSizingMode: node.counterAxisSizingMode ?? null,
    primaryAxisAlignItems: node.primaryAxisAlignItems ?? null,
    counterAxisAlignItems: node.counterAxisAlignItems ?? null,
    itemSpacing: node.itemSpacing ?? null,
    padding: {
      top: node.paddingTop ?? null,
      right: node.paddingRight ?? null,
      bottom: node.paddingBottom ?? null,
      left: node.paddingLeft ?? null,
    },
    layoutAlign: node.layoutAlign ?? null,
    layoutGrow: node.layoutGrow ?? null,
    constraints: {
      horizontal: node.constraints?.horizontal ?? null,
      vertical: node.constraints?.vertical ?? null,
    },
  };
}

function getComponentProperties(node: FigmaNode) {
  return Object.entries(node.componentProperties ?? {}).map(
    ([name, property]) => ({
      name,
      type: property.type ?? null,
      value: property.value ?? null,
    }),
  );
}

function getStrokes(node: FigmaNode) {
  return (node.strokes ?? []).flatMap((stroke) =>
    stroke.type === "SOLID" && stroke.visible !== false && stroke.color
      ? [
          {
            color: toHexColor(stroke.color),
            weight: node.strokeWeight ?? null,
            align: node.strokeAlign ?? null,
            sides: {
              top: node.individualStrokeWeights?.top ?? null,
              right: node.individualStrokeWeights?.right ?? null,
              bottom: node.individualStrokeWeights?.bottom ?? null,
              left: node.individualStrokeWeights?.left ?? null,
            },
          },
        ]
      : [],
  );
}

function countNodes(node: FigmaNode): number {
  const pending = [node];
  let count = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      break;
    }
    count += 1;
    pending.push(...(current.children ?? []));
  }

  return count;
}

function buildHierarchy(
  root: FigmaNode,
  components: Record<string, FigmaComponentMetadata>,
  componentSets: Record<string, FigmaComponentMetadata>,
) {
  const coverage = {
    nodesVisited: countNodes(root),
    nodesIncluded: 0,
    nodesOmitted: 0,
    nodesMissingGeometry: 0,
    apiDepthLimited: false,
    normalizationTruncated: false,
  };

  function normalizeNode(
    node: FigmaNode,
    parentPath: string,
  ): FigmaLayerNode | null {
    if (coverage.nodesIncluded >= maxTraversalNodes) {
      return null;
    }

    coverage.nodesIncluded += 1;
    const bounds = getBounds(node);
    if (!bounds) {
      coverage.nodesMissingGeometry += 1;
    }

    const id = node.id ?? node.name ?? `unknown-node-${coverage.nodesIncluded}`;
    const name = node.name ?? "Unnamed layer";
    const path = parentPath ? `${parentPath} / ${name}` : name;
    const component = node.componentId
      ? components[node.componentId]
      : undefined;
    const setId = node.componentSetId ?? component?.componentSetId ?? null;

    return {
      id,
      name,
      type: node.type ?? "UNKNOWN",
      path,
      visible: node.visible !== false,
      bounds,
      layout: getNodeLayout(node),
      component: {
        id: node.componentId ?? null,
        name: component?.name ?? null,
        setId,
        setName: setId ? (componentSets[setId]?.name ?? null) : null,
        properties: getComponentProperties(node),
      },
      strokes: getStrokes(node),
      children: (node.children ?? []).flatMap((child) => {
        const normalized = normalizeNode(child, path);
        return normalized ? [normalized] : [];
      }),
    };
  }

  const normalizedRoot = normalizeNode(root, "");
  const hierarchy = normalizedRoot ? [normalizedRoot] : [];
  coverage.nodesOmitted = Math.max(
    0,
    coverage.nodesVisited - coverage.nodesIncluded,
  );
  coverage.normalizationTruncated = coverage.nodesOmitted > 0;

  return { hierarchy, coverage };
}

const glyphNodeTypes = new Set([
  "VECTOR",
  "BOOLEAN_OPERATION",
  "ELLIPSE",
  "LINE",
  "POLYGON",
  "RECTANGLE",
  "STAR",
]);

function getIconMeasurements(
  node: FigmaNode,
  components: Record<string, FigmaComponentMetadata>,
  componentSets: Record<string, FigmaComponentMetadata>,
) {
  const measurements: NormalizedFigmaContext["iconMeasurements"] = [];
  const ambiguityNotes: string[] = [];
  let visitedNodes = 0;

  function visit(target: FigmaNode) {
    if (visitedNodes >= maxTraversalNodes || !isVisibleNode(target)) {
      return;
    }
    visitedNodes += 1;

    const searchText = getNodeSearchText(target, components, componentSets);
    const targetBounds = getBounds(target);
    const isTarget = includesAny(searchText, [
      "icon button",
      "icon-button",
      "size icon",
      "size=icon",
    ]);

    if (targetBounds && isTarget) {
      const measuredTargetBounds = targetBounds;
      const candidates: Array<{ node: FigmaNode; depth: number }> = [];
      let visitedCandidates = 0;
      function collectGlyphs(candidate: FigmaNode, depth = 0) {
        if (
          visitedCandidates >= maxTraversalNodes ||
          !isVisibleNode(candidate)
        ) {
          return;
        }
        visitedCandidates += 1;

        const bounds = getBounds(candidate);
        if (
          candidate !== target &&
          bounds &&
          bounds.width > 0 &&
          bounds.height > 0 &&
          bounds.width <= measuredTargetBounds.width &&
          bounds.height <= measuredTargetBounds.height &&
          (candidate.type === "INSTANCE" ||
            candidate.type === "COMPONENT" ||
            glyphNodeTypes.has(candidate.type ?? "") ||
            includesAny(
              getNodeSearchText(candidate, components, componentSets),
              ["icon", "glyph"],
            ))
        ) {
          candidates.push({ node: candidate, depth });
        }
        for (const child of candidate.children ?? []) {
          collectGlyphs(child, depth + 1);
        }
      }
      collectGlyphs(target);
      candidates.sort((left, right) => {
        const leftSemantic =
          left.node.type === "INSTANCE" ||
          includesAny(getNodeSearchText(left.node, components, componentSets), [
            "icon",
            "glyph",
          ]);
        const rightSemantic =
          right.node.type === "INSTANCE" ||
          includesAny(
            getNodeSearchText(right.node, components, componentSets),
            ["icon", "glyph"],
          );
        if (leftSemantic !== rightSemantic) {
          return leftSemantic ? -1 : 1;
        }
        if (left.depth !== right.depth) {
          return left.depth - right.depth;
        }
        const leftBounds = getBounds(left.node);
        const rightBounds = getBounds(right.node);
        return (
          (rightBounds?.width ?? 0) * (rightBounds?.height ?? 0) -
          (leftBounds?.width ?? 0) * (leftBounds?.height ?? 0)
        );
      });
      const selectedCandidate = candidates[0];
      const glyph = selectedCandidate?.node;
      const glyphBounds = glyph ? getBounds(glyph) : null;

      if (glyph && glyphBounds) {
        const semanticTarget = includesAny(searchText, [
          "icon button",
          "icon-button",
          "size icon",
        ]);
        measurements.push({
          target: {
            id: target.id ?? target.name ?? "unknown-target",
            name: target.name ?? "Unnamed target",
            type: target.type ?? "UNKNOWN",
            bounds: measuredTargetBounds,
          },
          glyph: {
            id: glyph.id ?? glyph.name ?? "unknown-glyph",
            name: glyph.name ?? "Unnamed glyph",
            type: glyph.type ?? "UNKNOWN",
            bounds: glyphBounds,
          },
          confidence: semanticTarget ? "high" : "medium",
          evidence: [
            `Target semantics: ${target.name ?? target.type ?? "unknown"}`,
            `Nested glyph candidate: ${glyph.name ?? glyph.type ?? "unknown"}`,
            `Target ${measuredTargetBounds.width}x${measuredTargetBounds.height}; glyph ${glyphBounds.width}x${glyphBounds.height}`,
          ],
        });
        const nextCandidate = candidates[1];
        const hasEquallyPlausibleCandidate =
          selectedCandidate &&
          nextCandidate &&
          selectedCandidate.depth === nextCandidate.depth &&
          (selectedCandidate.node.type === "INSTANCE") ===
            (nextCandidate.node.type === "INSTANCE");
        if (hasEquallyPlausibleCandidate) {
          ambiguityNotes.push(
            `${target.name ?? "An icon target"} contained multiple equally ranked glyph candidates; the first measurable candidate was selected.`,
          );
        }
      } else {
        ambiguityNotes.push(
          `${target.name ?? "A likely icon target"} was detected, but no measurable nested glyph was found.`,
        );
      }
    }

    for (const child of target.children ?? []) {
      visit(child);
    }
  }

  visit(node);
  if (visitedNodes >= maxTraversalNodes) {
    ambiguityNotes.push(
      `Icon detection stopped after ${maxTraversalNodes} nodes; additional icon controls may not be represented.`,
    );
  }
  if (measurements.length > maxIconMeasurements) {
    ambiguityNotes.push(
      `${measurements.length - maxIconMeasurements} icon measurements were omitted after reaching the ${maxIconMeasurements}-measurement limit.`,
    );
  }
  return {
    measurements: measurements.slice(0, maxIconMeasurements),
    ambiguityNotes,
  };
}

function getImplementationSummary(
  node: FigmaNode,
  iconMeasurements: NormalizedFigmaContext["iconMeasurements"],
): NormalizedFigmaContext["implementationSummary"] {
  if (!iconMeasurements.length) {
    return { actions: null };
  }

  const parentsByNodeId = new Map<string, FigmaNode>();
  const pending: Array<{ node: FigmaNode; parent: FigmaNode | null }> = [
    { node, parent: null },
  ];
  while (pending.length) {
    const current = pending.pop();
    if (!current) {
      break;
    }
    if (current.node.id && current.parent) {
      parentsByNodeId.set(current.node.id, current.parent);
    }
    for (const child of current.node.children ?? []) {
      pending.push({ node: child, parent: current.node });
    }
  }

  const containers = iconMeasurements.flatMap(({ target }) => {
    const parent = parentsByNodeId.get(target.id);
    return parent ? [parent] : [];
  });
  const uniqueNumbers = (values: Array<number | undefined>) => [
    ...new Set(
      values.filter((value): value is number => typeof value === "number"),
    ),
  ];
  const layouts = [
    ...new Set(
      containers
        .map((container) => container.layoutMode?.toLowerCase())
        .filter(
          (layout): layout is "horizontal" | "vertical" | "none" =>
            layout === "horizontal" ||
            layout === "vertical" ||
            layout === "none",
        ),
    ),
  ];
  const gaps = uniqueNumbers(
    containers.map((container) => container.itemSpacing),
  );
  const buttonSizes = uniqueNumbers(
    iconMeasurements.flatMap(({ target }) =>
      target.bounds.width === target.bounds.height ? [target.bounds.width] : [],
    ),
  );
  const iconSizes = uniqueNumbers(
    iconMeasurements.flatMap(({ glyph }) =>
      glyph.bounds.width === glyph.bounds.height ? [glyph.bounds.width] : [],
    ),
  );

  return {
    actions: {
      layout: layouts.length === 1 ? layouts[0] : null,
      gap: gaps.length === 1 ? gaps[0] : null,
      buttonSize: buttonSizes.length === 1 ? buttonSizes[0] : null,
      iconSize: iconSizes.length === 1 ? iconSizes[0] : null,
      icons: [
        ...new Set(
          iconMeasurements.map(({ glyph }) => glyph.name.replace(/^li:/i, "")),
        ),
      ],
      sourceNodeIds: {
        containers: [
          ...new Set(
            containers.flatMap((container) =>
              container.id ? [container.id] : [],
            ),
          ),
        ],
        targets: iconMeasurements.map(({ target }) => target.id),
        glyphs: iconMeasurements.map(({ glyph }) => glyph.id),
      },
    },
  };
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

function getNodeSearchText(
  node: FigmaNode,
  components: Record<string, FigmaComponentMetadata> = {},
  componentSets: Record<string, FigmaComponentMetadata> = {},
) {
  const component = node.componentId ? components[node.componentId] : undefined;
  const setId = node.componentSetId ?? component?.componentSetId;
  return [
    node.name,
    node.type,
    node.componentId,
    node.componentSetId,
    component?.name,
    setId ? componentSets[setId]?.name : undefined,
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
  components: Record<string, FigmaComponentMetadata>;
  componentSets: Record<string, FigmaComponentMetadata>;
  apiDepthLimited: boolean;
}): NormalizedFigmaContext {
  const colors = new Map<string, FigmaColorToken>();
  const text: FigmaTextNode[] = [];
  const radii = new Set<number>();

  collectColors(input.node, colors, { count: 0 });
  collectText(input.node, text, { count: 0 });
  collectRadii(input.node, radii, { count: 0 });
  const detectedControls = getDetectedControls(input.node);
  const { hierarchy, coverage } = buildHierarchy(
    input.node,
    input.components,
    input.componentSets,
  );
  coverage.apiDepthLimited = input.apiDepthLimited;
  const iconDetection = getIconMeasurements(
    input.node,
    input.components,
    input.componentSets,
  );
  const implementationSummary = getImplementationSummary(
    input.node,
    iconDetection.measurements,
  );

  return {
    source: "live",
    url: input.parts.url,
    fileKey: input.parts.fileKey,
    nodeId: input.parts.nodeId,
    fileName: input.fileName,
    selectedNodeName: input.node.name ?? input.fileName,
    selectedNodeType: input.node.type ?? "UNKNOWN",
    implementationSummary,
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
    hierarchy,
    detectedControls,
    iconMeasurements: iconDetection.measurements,
    extractionCoverage: coverage,
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
            `No selected node was provided; full-file extraction is limited to API depth ${figmaExtractionDepth}. Select a frame or section for complete nested geometry.`,
          ]),
      ...(coverage.nodesOmitted
        ? [
            `${coverage.nodesOmitted} nodes were omitted after reaching the ${maxTraversalNodes}-node normalization limit.`,
          ]
        : []),
      ...(coverage.nodesMissingGeometry
        ? [
            `${coverage.nodesMissingGeometry} included nodes did not provide absolute bounding-box geometry.`,
          ]
        : []),
      ...iconDetection.ambiguityNotes,
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
  let components: Record<string, FigmaComponentMetadata> = {};
  let componentSets: Record<string, FigmaComponentMetadata> = {};

  if (parts.nodeId) {
    const nodesPayload = await fetchFigmaJson<FigmaNodesPayload>(
      `/files/${encodeURIComponent(parts.fileKey)}/nodes?ids=${encodeURIComponent(parts.nodeId)}`,
      "selected node",
    );
    const selectedNodePayload = nodesPayload.nodes?.[parts.nodeId];
    selectedNode = selectedNodePayload?.document ?? undefined;
    components = selectedNodePayload?.components ?? {};
    componentSets = selectedNodePayload?.componentSets ?? {};
  } else {
    const file = await fetchFigmaJson<FigmaFilePayload>(
      `/files/${encodeURIComponent(parts.fileKey)}?depth=${figmaExtractionDepth}`,
      "file",
    );
    selectedNode = file.document;
    fileName = file.name ?? fileName;
    components = file.components ?? {};
    componentSets = file.componentSets ?? {};
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
    components,
    componentSets,
    apiDepthLimited: !parts.nodeId,
  });
}

export function getFigmaStatus() {
  return {
    configured: isFigmaConfigured(),
  };
}
