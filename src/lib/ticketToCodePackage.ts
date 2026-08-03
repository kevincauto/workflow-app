import { sanitizePackageName } from "@/lib/reviewPackage";
import type {
  FigmaLayerNode,
  NormalizedFigmaContext,
  PackageImage,
  TicketToCodePackageInput,
} from "@/lib/types";

export type TicketToCodePackageFiles = Record<string, string | Uint8Array>;

function markdownText(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value.trim() : fallback;
}

function formatList(items: string[], fallback: string) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : fallback;
}

function renderHierarchy(nodes: FigmaLayerNode[], depth = 0): string[] {
  return nodes.flatMap((node) => [
    `${"  ".repeat(depth)}- ${node.name} (${node.type})`,
    ...renderHierarchy(node.children, depth + 1),
  ]);
}

function renderDetectedControls(figma: NormalizedFigmaContext) {
  if (!figma.detectedControls.length) {
    return "No specific controls were detected. Verify control type and option orientation against the Figma preview when implementing.";
  }

  return figma.detectedControls
    .map((control) =>
      [
        `- ${control.name}`,
        `  - Type: ${control.controlType}`,
        `  - Orientation: ${control.orientation}`,
        `  - Option count: ${control.optionCount}`,
        `  - Options: ${control.options.length ? control.options.join(", ") : "Not extracted"}`,
        `  - Confidence: ${control.confidence}`,
        `  - Guidance: ${control.guidance}`,
        ...(control.evidence.length
          ? [`  - Evidence: ${control.evidence.join("; ")}`]
          : []),
      ].join("\n"),
    )
    .join("\n");
}

function buildFigmaMarkdown(figma: NormalizedFigmaContext | null) {
  if (!figma) {
    return "No Figma context was attached to this package.\n";
  }

  return [
    `# Figma Context: ${figma.selectedNodeName}`,
    "",
    `- Source URL: ${figma.url}`,
    `- File: ${figma.fileName}`,
    `- File key: ${figma.fileKey}`,
    `- Node id: ${figma.nodeId ?? "Not provided"}`,
    `- Selected node type: ${figma.selectedNodeType}`,
    `- Preview image URL: ${figma.previewImageUrl ?? "Not available"}`,
    `- Dimensions: ${figma.dimensions.width ?? "unknown"} x ${figma.dimensions.height ?? "unknown"}`,
    "",
    "## Layout",
    "",
    `- Mode: ${figma.layout.mode ?? "unknown"}`,
    `- Primary axis sizing: ${figma.layout.primaryAxisSizingMode ?? "unknown"}`,
    `- Counter axis sizing: ${figma.layout.counterAxisSizingMode ?? "unknown"}`,
    `- Item spacing: ${figma.layout.itemSpacing ?? "unknown"}`,
    `- Padding: top ${figma.layout.padding.top ?? "unknown"}, right ${figma.layout.padding.right ?? "unknown"}, bottom ${figma.layout.padding.bottom ?? "unknown"}, left ${figma.layout.padding.left ?? "unknown"}`,
    "",
    "## Colors",
    "",
    figma.colors.length
      ? figma.colors
          .map((color) => `- ${color.name}: ${color.value}`)
          .join("\n")
      : "No color tokens were extracted.",
    "",
    "## Text",
    "",
    figma.text.length
      ? figma.text
          .map(
            (text) =>
              `- ${text.name}: ${text.characters} (${text.fontFamily ?? "font unknown"}, ${text.fontSize ?? "size unknown"})`,
          )
          .join("\n")
      : "No text nodes were extracted.",
    "",
    "## Detected Controls",
    "",
    renderDetectedControls(figma),
    "",
    "## Radii",
    "",
    figma.radii.length
      ? figma.radii.map((radius) => `- ${radius}px`).join("\n")
      : "No radii were extracted.",
    "",
    "## Layer Hierarchy",
    "",
    renderHierarchy(figma.hierarchy).join("\n") ||
      "No child layers were extracted.",
    "",
    "## Implementation Notes",
    "",
    formatList(
      figma.implementationNotes,
      "No implementation notes were generated.",
    ),
    "",
    "## Ambiguity Notes",
    "",
    formatList(figma.ambiguityNotes, "No ambiguity notes were generated."),
    "",
  ].join("\n");
}

function getFigmaFileNames(index: number) {
  const position = index + 1;
  return {
    markdown: `figma-context-${position}.md`,
    json: `figma-context-${position}.json`,
  };
}

function getFileExtension(filename: string) {
  const extension = filename.match(/\.([a-zA-Z0-9]{1,10})$/)?.[1];
  return extension ? `.${extension.toLowerCase()}` : "";
}

function buildPackagedImages(images: PackageImage[]) {
  const usedNames = new Set<string>();

  return images.map((image, index) => {
    const extension = getFileExtension(image.filename);
    const filenameWithoutExtension = extension
      ? image.filename.slice(0, -extension.length)
      : image.filename;
    const baseName =
      sanitizePackageName(filenameWithoutExtension) || `image-${index + 1}`;
    let packagedName = `${baseName}${extension}`;
    let suffix = 2;

    while (usedNames.has(packagedName)) {
      packagedName = `${baseName}-${suffix}${extension}`;
      suffix += 1;
    }

    usedNames.add(packagedName);
    return { image, path: `images/${packagedName}` };
  });
}

export function getTicketToCodePackageFolderName(
  input: TicketToCodePackageInput,
) {
  const safeKey = sanitizePackageName(input.ticket.key) || "ticket";
  const safeSummary = sanitizePackageName(input.ticket.summary).slice(0, 40);

  return ["ticket-to-code", safeKey, safeSummary].filter(Boolean).join("-");
}

export function buildTicketToCodeManifest(input: TicketToCodePackageInput) {
  const packagedImages = buildPackagedImages(input.images);
  const figmaFiles = input.figmaContexts.flatMap((_, index) => {
    const names = getFigmaFileNames(index);
    return [names.markdown, names.json];
  });

  return {
    packageVersion: 2,
    generatedAt: input.generatedAt,
    intendedUse:
      "Feature creation context package for an IDE coding agent. Use the edited ticket description as the source of truth, with optional normalized Figma context as visual guidance.",
    sourceSystems: {
      ticket:
        input.ticket.source === "live" ? "Jira REST API" : "Mock Jira data",
      figma: input.figmaContexts.map((figma) =>
        figma.source === "live" ? "Figma REST API" : "Mock Figma data",
      ),
    },
    ticket: {
      key: input.ticket.key,
      summary: input.ticket.summary,
      status: input.ticket.status,
      priority: input.ticket.priority,
      issueType: input.ticket.issueType,
      assignee: input.ticket.assignee,
      developer: input.ticket.developer,
      estimatePoints: input.ticket.estimatePoints,
      updatedAt: input.ticket.updatedAt,
      sprint: input.ticket.sprint,
    },
    images: packagedImages.map(({ image, path }) => ({
      source: image.source,
      originalFilename: image.filename,
      packagedPath: path,
      mimeType: image.mimeType,
      size: image.size,
      jiraAttachmentId: image.jiraAttachmentId,
    })),
    figma: input.figmaContexts.map((figma, index) => ({
      ...getFigmaFileNames(index),
      fileKey: figma.fileKey,
      nodeId: figma.nodeId,
      fileName: figma.fileName,
      selectedNodeName: figma.selectedNodeName,
      selectedNodeType: figma.selectedNodeType,
      previewImageUrl: figma.previewImageUrl,
      detectedControlCount: figma.detectedControls.length,
    })),
    packageFiles: [
      "manifest.json",
      "ticket.md",
      "agent-prompt.md",
      ...figmaFiles,
      ...packagedImages.map(({ path }) => path),
    ],
    knownConstraints: [
      "Access tokens are intentionally excluded from this package.",
      "The edited ticket description in ticket.md is the requirements source of truth.",
      "Figma context is normalized and intentionally compact; raw Figma payloads are excluded.",
      "Preview image URLs from Figma may expire or require access to the original file.",
      "Jira and uploaded image binaries are stored under images/ and contain no credentials.",
    ],
  };
}

export function buildTicketMarkdown(input: TicketToCodePackageInput) {
  return [
    `# Ticket: ${input.ticket.key} ${input.ticket.summary}`,
    "",
    `- Status: ${input.ticket.status ?? "Unknown"}`,
    `- Priority: ${input.ticket.priority ?? "Unknown"}`,
    `- Issue type: ${input.ticket.issueType ?? "Unknown"}`,
    `- Assignee: ${input.ticket.assignee ?? "Unknown"}`,
    `- Developer: ${input.ticket.developer ?? "Unknown"}`,
    `- Estimate: ${input.ticket.estimatePoints !== null ? `${input.ticket.estimatePoints} points` : "Unknown"}`,
    `- Sprint: ${input.ticket.sprint?.name ?? "Unknown"}`,
    `- Updated: ${input.ticket.updatedAt ?? "Unknown"}`,
    "",
    "## Edited Requirements",
    "",
    markdownText(
      input.editedDescription,
      "No ticket description was provided.",
    ),
    "",
    "## Attached Images",
    "",
    input.images.length
      ? buildPackagedImages(input.images)
          .map(({ image, path }) => `- ${path} (${image.source})`)
          .join("\n")
      : "No images were attached to this package.",
    "",
  ].join("\n");
}

export function buildAgentPrompt(input: TicketToCodePackageInput) {
  return [
    `# Build Feature For ${input.ticket.key}`,
    "",
    "You are an IDE coding agent. Build the feature requested by this Jira ticket using the local repository as the source of implementation truth.",
    "",
    "## Requirements Source Of Truth",
    "",
    "Use `ticket.md` and the edited requirements section as the canonical requirements. Treat it as newer than Jira if there is a mismatch.",
    "",
    "## Ticket Summary",
    "",
    `- Key: ${input.ticket.key}`,
    `- Summary: ${input.ticket.summary}`,
    `- Sprint: ${input.ticket.sprint?.name ?? "Unknown"}`,
    "",
    "## Design Context",
    "",
    input.figmaContexts.length
      ? `Use ${input.figmaContexts
          .map((_, index) => {
            const names = getFigmaFileNames(index);
            return `\`${names.markdown}\` and \`${names.json}\``;
          })
          .join(
            ", ",
          )} for visual guidance. Preserve layout direction, spacing, dimensions, text hierarchy, colors, border radii, detected control types, option counts, and option orientation where they map cleanly to the app's design system. If detected controls say radio-group, implement radio buttons, not a dropdown/select. Preserve vertical radio groups as vertical and horizontal radio groups as horizontal. Ask for human review when the Figma context is ambiguous or conflicts with existing UI conventions.`
      : "No Figma context is attached. Follow existing app UI conventions and ask for human review when visual requirements are ambiguous.",
    input.figmaContexts.some((figma) => figma.detectedControls.length)
      ? [
          "",
          "## Detected Control Checklist",
          "",
          ...input.figmaContexts.flatMap((figma, index) =>
            figma.detectedControls.map(
              (control) =>
                `- Figma ${index + 1}, ${control.name}: ${control.controlType}, ${control.orientation}, ${control.optionCount} options. ${control.guidance}`,
            ),
          ),
        ].join("\n")
      : "",
    "",
    "## Image References",
    "",
    input.images.length
      ? "Inspect every file under `images/` as implementation context. Use the manifest to distinguish Jira attachments from session uploads."
      : "No image references are attached.",
    "",
    "## Expected Agent Behavior",
    "",
    "- Inspect the existing codebase before editing.",
    "- Prefer existing components, styling conventions, routes, and data-access patterns.",
    "- Keep changes focused on this ticket.",
    "- Add or update tests when the implementation touches meaningful behavior.",
    "- Do not invent requirements that are not present in the ticket or design context.",
    "- Before finishing, compare control type and option orientation against the detected Figma controls and preview reference.",
    "",
  ].join("\n");
}

export function buildFigmaContextMarkdown(figma: NormalizedFigmaContext) {
  return buildFigmaMarkdown(figma);
}

export function buildTicketToCodePackageFiles(input: TicketToCodePackageInput) {
  const files: TicketToCodePackageFiles = {
    "manifest.json": JSON.stringify(buildTicketToCodeManifest(input), null, 2),
    "ticket.md": buildTicketMarkdown(input),
    "agent-prompt.md": buildAgentPrompt(input),
  };

  input.figmaContexts.forEach((figma, index) => {
    const names = getFigmaFileNames(index);
    files[names.markdown] = buildFigmaContextMarkdown(figma);
    files[names.json] = JSON.stringify(figma, null, 2);
  });

  for (const { image, path } of buildPackagedImages(input.images)) {
    files[path] = image.data;
  }

  return files;
}
