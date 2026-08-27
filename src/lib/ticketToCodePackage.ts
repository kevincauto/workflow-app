import { sanitizePackageName } from "@/lib/reviewPackage";
import type {
  FigmaViewport,
  PackageAttachment,
  TicketToCodePackageInput,
} from "@/lib/types";

export type TicketToCodePackageFiles = Record<string, string | Uint8Array>;

function markdownText(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value.trim() : fallback;
}

function getViewportLabel(viewport: FigmaViewport) {
  return viewport === "desktop" ? "Desktop View" : "Mobile View";
}

function getFigmaFileName(viewport: FigmaViewport) {
  return `figma-context-${viewport}.json`;
}

function getFileExtension(filename: string) {
  const extension = filename.match(/\.([a-zA-Z0-9]{1,10})$/)?.[1];
  return extension ? `.${extension.toLowerCase()}` : "";
}

function buildPackagedAttachments(attachments: PackageAttachment[]) {
  const usedNames = new Set<string>();

  return attachments.map((attachment, index) => {
    const extension = getFileExtension(attachment.filename);
    const filenameWithoutExtension = extension
      ? attachment.filename.slice(0, -extension.length)
      : attachment.filename;
    const baseName =
      sanitizePackageName(filenameWithoutExtension) || `image-${index + 1}`;
    let packagedName = `${baseName}${extension}`;
    let suffix = 2;

    while (usedNames.has(packagedName)) {
      packagedName = `${baseName}-${suffix}${extension}`;
      suffix += 1;
    }

    usedNames.add(packagedName);
    return { attachment, path: `attachments/${packagedName}` };
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
  const packagedAttachments = buildPackagedAttachments(input.attachments);
  const figmaFiles = input.figmaContexts.map(({ viewport }) =>
    getFigmaFileName(viewport),
  );

  return {
    packageVersion: 5,
    generatedAt: input.generatedAt,
    intendedUse:
      "Feature creation context package for an IDE coding agent. Use the edited ticket description as the source of truth, with optional normalized Figma context as visual guidance.",
    sourceSystems: {
      ticket:
        input.ticket.source === "live" ? "Jira REST API" : "Mock Jira data",
      figma: input.figmaContexts.map(({ viewport, context }) => ({
        viewport,
        system:
          context.source === "live" ? "Figma REST API" : "Mock Figma data",
      })),
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
    attachments: packagedAttachments.map(({ attachment, path }) => ({
      source: attachment.source,
      originalFilename: attachment.filename,
      packagedPath: path,
      mimeType: attachment.mimeType,
      size: attachment.size,
      jiraAttachmentId: attachment.jiraAttachmentId,
      explanation: attachment.explanation,
    })),
    figma: input.figmaContexts.map(({ viewport, context: figma }) => ({
      viewport,
      json: getFigmaFileName(viewport),
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
      ...packagedAttachments.map(({ path }) => path),
    ],
    knownConstraints: [
      "Access tokens are intentionally excluded from this package.",
      "The edited ticket description in ticket.md is the requirements source of truth.",
      "Figma context is normalized and intentionally compact; raw Figma payloads are excluded.",
      "Preview image URLs from Figma may expire or require access to the original file.",
      "Jira and uploaded attachment binaries are stored under attachments/ and contain no credentials.",
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
    "## Attached Images and Files",
    "",
    input.attachments.length
      ? buildPackagedAttachments(input.attachments)
          .map(({ attachment, path }) =>
            [
              `- \`${path}\` (${attachment.source}, ${attachment.mimeType})`,
              `  - Context: ${markdownText(attachment.explanation, "No additional context provided.")}`,
            ].join("\n"),
          )
          .join("\n")
      : "No images or files were attached to this package.",
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
          .map(({ viewport }) => {
            return `\`${getFigmaFileName(viewport)}\` as the canonical ${getViewportLabel(viewport)} design source`;
          })
          .join(
            ", ",
          )}. Apply each extraction only to its named responsive viewport and reconcile shared components through the app's existing design system. Read hierarchy node bounds, layout, constraints, component metadata, instance properties, and strokes directly from JSON. Use iconMeasurements glyph bounds for visible icon size and target bounds for the button or touch target; never infer one from the other. Preserve stroke color and weight where provided. Review extractionCoverage and ambiguityNotes before coding, and request human verification when geometry is missing, truncated, ambiguous, or conflicts with existing UI conventions. If detectedControls says radio-group, implement radio buttons, not a dropdown/select, preserving its option orientation.`
      : "No Figma context is attached. Follow existing app UI conventions and ask for human review when visual requirements are ambiguous.",
    input.figmaContexts.some(({ context }) => context.detectedControls.length)
      ? [
          "",
          "## Detected Control Checklist",
          "",
          ...input.figmaContexts.flatMap(({ viewport, context }) =>
            context.detectedControls.map(
              (control) =>
                `- ${getViewportLabel(viewport)}, ${control.name}: ${control.controlType}, ${control.orientation}, ${control.optionCount} options. ${control.guidance}`,
            ),
          ),
        ].join("\n")
      : "",
    "",
    "## Attachment References",
    "",
    input.attachments.length
      ? "Inspect every supported file under `attachments/` as implementation context. Before interpreting a file, read its matching Context entry in `ticket.md` or explanation in `manifest.json`. Use the manifest to distinguish Jira attachments from session uploads. Treat attachment explanations as supporting context; the edited ticket requirements remain the source of truth."
      : "No attachment references are included.",
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

export function buildTicketToCodePackageFiles(input: TicketToCodePackageInput) {
  const files: TicketToCodePackageFiles = {
    "manifest.json": JSON.stringify(buildTicketToCodeManifest(input), null, 2),
    "ticket.md": buildTicketMarkdown(input),
    "agent-prompt.md": buildAgentPrompt(input),
  };

  input.figmaContexts.forEach((figma) => {
    files[getFigmaFileName(figma.viewport)] = JSON.stringify(
      { viewport: figma.viewport, ...figma.context },
      null,
      2,
    );
  });

  for (const { attachment, path } of buildPackagedAttachments(
    input.attachments,
  )) {
    files[path] = attachment.data;
  }

  return files;
}
