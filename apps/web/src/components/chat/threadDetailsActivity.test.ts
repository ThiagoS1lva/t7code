import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import { describe, expect, it } from "vite-plus/test";

import { deriveThreadDetailsActivity } from "./threadDetailsActivity";

type TurnItem = ThreadStructure["turnItems"][number];

const baseItem = {
  threadId: "thread-1",
  runId: "run-1",
  createdAt: "2026-11-24T19:00:00.000Z",
  updatedAt: "2026-11-24T19:00:00.000Z",
} as const;

describe("deriveThreadDetailsActivity", () => {
  it("separates terminal commands and file reads/edits, ordering running first then newest history", () => {
    const items = [
      {
        ...baseItem,
        id: "cmd-1",
        ordinal: 1,
        type: "command_execution",
        status: "completed",
        input: "git status",
        exitCode: 0,
      },
      {
        ...baseItem,
        id: "read-1",
        ordinal: 2,
        type: "dynamic_tool",
        status: "completed",
        toolName: "read_file",
        input: { path: "/repo/apps/web/src/App.tsx" },
      },
      {
        ...baseItem,
        id: "cmd-2",
        ordinal: 3,
        type: "command_execution",
        status: "completed",
        input: "vp run\n  typecheck",
        exitCode: 1,
      },
      {
        ...baseItem,
        id: "edit-1",
        ordinal: 4,
        type: "file_change",
        status: "running",
        fileName: "/repo/apps/web/src/components/chat/ThreadDetailsPanel.tsx",
      },
      {
        ...baseItem,
        id: "cmd-3",
        ordinal: 5,
        type: "command_execution",
        status: "running",
        input: "vp test run threadDetailsActivity.test.ts",
      },
      {
        ...baseItem,
        id: "search-1",
        ordinal: 6,
        type: "file_search",
        status: "completed",
        pattern: "ThreadDetails",
      },
      {
        ...baseItem,
        id: "edit-2",
        ordinal: 7,
        type: "file_change",
        status: "completed",
        fileName: "/repo/apps/web/src/a.ts",
        changes: [
          { path: "/repo/apps/web/src/a.ts", kind: "modify" },
          { path: "/repo/apps/web/src/b.ts", kind: "modify" },
        ],
      },
    ] as unknown as ReadonlyArray<TurnItem>;

    const result = deriveThreadDetailsActivity(items, "/repo");

    expect(result.terminalCommands).toEqual([
      {
        id: "cmd-3",
        kind: "command",
        label: "vp test run threadDetailsActivity.test.ts",
        status: "running",
      },
      {
        id: "cmd-2",
        kind: "command",
        label: "vp run typecheck",
        status: "failed",
      },
      {
        id: "cmd-1",
        kind: "command",
        label: "git status",
        status: "completed",
      },
    ]);

    expect(result.fileActions).toEqual([
      {
        id: "edit-1",
        kind: "edit",
        label: "repo/apps/web/src/components/chat/ThreadDetailsPanel.tsx",
        status: "running",
      },
      {
        id: "edit-2",
        kind: "edit",
        label: "repo/apps/web/src/a.ts (+1)",
        status: "completed",
      },
      {
        id: "read-1",
        kind: "read",
        label: "repo/apps/web/src/App.tsx",
        status: "completed",
      },
    ]);
  });

  it("classifies dynamic bash and edit tools into their respective lists", () => {
    const items = [
      {
        ...baseItem,
        id: "dyn-cmd",
        ordinal: 1,
        type: "dynamic_tool",
        status: "running",
        toolName: "bash",
        input: { command: "pnpm lint" },
      },
      {
        ...baseItem,
        id: "dyn-edit",
        ordinal: 2,
        type: "dynamic_tool",
        status: "failed",
        toolName: "edit_file",
        input: { path: "/repo/README.md" },
      },
    ] as unknown as ReadonlyArray<TurnItem>;

    const result = deriveThreadDetailsActivity(items, "/repo");

    expect(result.terminalCommands).toEqual([
      {
        id: "dyn-cmd",
        kind: "command",
        label: "pnpm lint",
        status: "running",
      },
    ]);

    expect(result.fileActions).toEqual([
      {
        id: "dyn-edit",
        kind: "edit",
        label: "repo/README.md",
        status: "failed",
      },
    ]);
  });
});
