import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import { classifyToolActivity, collectToolFilePaths } from "@t3tools/shared/toolActivity";

import { formatWorkspaceRelativePath } from "../../filePathDisplay";

type ThreadStructureTurnItem = ThreadStructure["turnItems"][number];

type ThreadDetailsActivityStatus = "running" | "completed" | "failed";

export interface ThreadDetailsActivityItem {
  readonly id: string;
  readonly kind: "command" | "read" | "edit";
  readonly label: string;
  readonly status: ThreadDetailsActivityStatus;
}

interface ThreadDetailsActivityLists {
  readonly terminalCommands: ReadonlyArray<ThreadDetailsActivityItem>;
  readonly fileActions: ReadonlyArray<ThreadDetailsActivityItem>;
}

const DYNAMIC_COMMAND_TOOL_TOKENS = new Set([
  "runcommand",
  "execcommand",
  "executecommand",
  "shellcommand",
]);

const DYNAMIC_READ_TOOL_TOKENS = new Set(["viewfile", "openfile"]);

const DYNAMIC_EDIT_TOOL_TOKENS = new Set([
  "edit",
  "editfile",
  "write",
  "writefile",
  "multiedit",
  "applypatch",
  "strreplace",
  "replacefilecontent",
  "createfile",
  "deletefile",
]);

function normalizeToolToken(name: string | null | undefined): string | undefined {
  const trimmed = name?.trim();
  if (!trimmed || /__|[./]/u.test(trimmed)) return undefined;
  return trimmed.replace(/[_\s-]/gu, "").toLowerCase();
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function resolveStatus(
  item: ThreadStructureTurnItem,
  extraFailure = false,
): ThreadDetailsActivityStatus {
  if (item.status === "running" || item.status === "pending") return "running";
  if (item.status === "failed" || item.status === "interrupted" || extraFailure) return "failed";
  return "completed";
}

function extractCommandFromDynamicInput(input: unknown): string | undefined {
  if (typeof input === "string") {
    const trimmed = collapseWhitespace(input);
    return trimmed || undefined;
  }
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return undefined;
  }
  const record = input as Record<string, unknown>;
  for (const key of ["command", "cmd", "CommandLine", "commandLine"]) {
    const value = record[key];
    if (typeof value === "string") {
      const trimmed = collapseWhitespace(value);
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

function formatFilePathsLabel(
  paths: ReadonlyArray<string>,
  workspaceRoot: string | undefined,
): string | undefined {
  const first = paths[0]?.trim();
  if (!first) return undefined;
  const formatted = formatWorkspaceRelativePath(first, workspaceRoot);
  return paths.length > 1 ? `${formatted} (+${paths.length - 1})` : formatted;
}

function sortRunningFirstNewestFirst(
  items: ReadonlyArray<ThreadDetailsActivityItem>,
): ThreadDetailsActivityItem[] {
  const running: ThreadDetailsActivityItem[] = [];
  const history: ThreadDetailsActivityItem[] = [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const entry = items[index]!;
    if (entry.status === "running") {
      running.push(entry);
    } else {
      history.push(entry);
    }
  }
  return [...running, ...history];
}

export function deriveThreadDetailsActivity(
  turnItems: ReadonlyArray<ThreadStructureTurnItem>,
  workspaceRoot: string | null | undefined,
): ThreadDetailsActivityLists {
  const root = workspaceRoot ?? undefined;
  const commands: ThreadDetailsActivityItem[] = [];
  const files: ThreadDetailsActivityItem[] = [];

  for (const item of turnItems) {
    if (item.type === "command_execution") {
      const label = collapseWhitespace(item.input) || item.title?.trim() || "";
      if (!label) continue;
      commands.push({
        id: item.id,
        kind: "command",
        label,
        status: resolveStatus(
          item,
          item.outputIndicatesFailure === true ||
            (item.exitCode !== undefined && item.exitCode !== 0),
        ),
      });
      continue;
    }

    if (item.type === "file_change") {
      const paths = item.changes?.length
        ? item.changes.map((change) => change.path)
        : [item.fileName];
      const label = formatFilePathsLabel(paths, root) ?? item.title?.trim() ?? "";
      if (!label) continue;
      files.push({
        id: item.id,
        kind: "edit",
        label,
        status: resolveStatus(item),
      });
      continue;
    }

    if (item.type === "dynamic_tool") {
      const classified = classifyToolActivity({
        itemType: "dynamic_tool_call",
        title: item.title ?? undefined,
        data: { toolName: item.toolName ?? undefined, input: item.input },
      });
      const token = normalizeToolToken(item.toolName);

      if (
        classified === "command" ||
        (token !== undefined && DYNAMIC_COMMAND_TOOL_TOKENS.has(token))
      ) {
        const label =
          extractCommandFromDynamicInput(item.input) ??
          item.title?.trim() ??
          item.toolName?.trim() ??
          "";
        if (!label) continue;
        commands.push({
          id: item.id,
          kind: "command",
          label,
          status: resolveStatus(item),
        });
        continue;
      }

      if (
        classified === "read" ||
        item.viewedImagePath !== undefined ||
        (token !== undefined && DYNAMIC_READ_TOOL_TOKENS.has(token))
      ) {
        const paths = item.viewedImagePath
          ? [item.viewedImagePath]
          : collectToolFilePaths({ input: item.input });
        const label =
          formatFilePathsLabel(paths, root) ?? item.title?.trim() ?? item.toolName?.trim() ?? "";
        if (!label) continue;
        files.push({
          id: item.id,
          kind: "read",
          label,
          status: resolveStatus(item),
        });
        continue;
      }

      if (
        classified === "file_change" ||
        (token !== undefined && DYNAMIC_EDIT_TOOL_TOKENS.has(token))
      ) {
        const paths = collectToolFilePaths({ input: item.input });
        const label =
          formatFilePathsLabel(paths, root) ?? item.title?.trim() ?? item.toolName?.trim() ?? "";
        if (!label) continue;
        files.push({
          id: item.id,
          kind: "edit",
          label,
          status: resolveStatus(item),
        });
      }
    }
  }

  return {
    terminalCommands: sortRunningFirstNewestFirst(commands),
    fileActions: sortRunningFirstNewestFirst(files),
  };
}
