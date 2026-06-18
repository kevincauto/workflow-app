import { sanitizePackageName } from "@/lib/reviewPackage";
import type {
  FigmaLayerNode,
  NormalizedFigmaContext,
  TicketToCodePackageInput,
} from "@/lib/types";

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

export function getTicketToCodePackageFolderName(
  input: TicketToCodePackageInput,
) {
  const safeKey = sanitizePackageName(input.ticket.key) || "ticket";
  const safeSummary = sanitizePackageName(input.ticket.summary).slice(0, 40);

  return ["ticket-to-code", safeKey, safeSummary].filter(Boolean).join("-");
}

export function buildTicketToCodeManifest(input: TicketToCodePackageInput) {
  return {
    packageVersion: 1,
    generatedAt: input.generatedAt,
    intendedUse:
      "Feature creation context package for an IDE coding agent. Use the edited ticket description as the source of truth, with optional normalized Figma context as visual guidance.",
    sourceSystems: {
      ticket:
        input.ticket.source === "live" ? "Jira REST API" : "Mock Jira data",
      figma: input.figma
        ? input.figma.source === "live"
          ? "Figma REST API"
          : "Mock Figma data"
        : null,
    },
    ticket: {
      key: input.ticket.key,
      summary: input.ticket.summary,
      status: input.ticket.status,
      priority: input.ticket.priority,
      issueType: input.ticket.issueType,
      assignee: input.ticket.assignee,
      developer: input.ticket.developer,
      updatedAt: input.ticket.updatedAt,
      sprint: input.ticket.sprint,
    },
    figma: input.figma
      ? {
          fileKey: input.figma.fileKey,
          nodeId: input.figma.nodeId,
          fileName: input.figma.fileName,
          selectedNodeName: input.figma.selectedNodeName,
          selectedNodeType: input.figma.selectedNodeType,
          previewImageUrl: input.figma.previewImageUrl,
        }
      : null,
    packageFiles: [
      "manifest.json",
      "ticket.md",
      "agent-prompt.md",
      ...(input.figma ? ["figma-context.md", "figma-context.json"] : []),
    ],
    knownConstraints: [
      "Access tokens are intentionally excluded from this package.",
      "The edited ticket description in ticket.md is the requirements source of truth.",
      "Figma context is normalized and intentionally compact; raw Figma payloads are excluded.",
      "Preview image URLs from Figma may expire or require access to the original file.",
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
    input.figma
      ? "Use `figma-context.md` and `figma-context.json` for visual guidance. Preserve layout direction, spacing, dimensions, text hierarchy, colors, and border radii where they map cleanly to the app's design system. Ask for human review when the Figma context is ambiguous or conflicts with existing UI conventions."
      : "No Figma context is attached. Follow existing app UI conventions and ask for human review when visual requirements are ambiguous.",
    "",
    "## Expected Agent Behavior",
    "",
    "- Inspect the existing codebase before editing.",
    "- Prefer existing components, styling conventions, routes, and data-access patterns.",
    "- Keep changes focused on this ticket.",
    "- Add or update tests when the implementation touches meaningful behavior.",
    "- Do not invent requirements that are not present in the ticket or design context.",
    "",
  ].join("\n");
}

export function buildFigmaContextMarkdown(input: TicketToCodePackageInput) {
  return buildFigmaMarkdown(input.figma);
}

export function buildTicketToCodePackageFiles(input: TicketToCodePackageInput) {
  return {
    "manifest.json": JSON.stringify(buildTicketToCodeManifest(input), null, 2),
    "ticket.md": buildTicketMarkdown(input),
    "agent-prompt.md": buildAgentPrompt(input),
    ...(input.figma
      ? {
          "figma-context.md": buildFigmaContextMarkdown(input),
          "figma-context.json": JSON.stringify(input.figma, null, 2),
        }
      : {}),
  };
}
