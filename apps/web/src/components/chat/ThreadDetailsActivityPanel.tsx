import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { useGT } from "gt-react";
import { EyeIcon, FilePenLineIcon, TerminalIcon } from "lucide-react";

import { cn } from "../../lib/utils";
import { environmentThreadDetails } from "../../state/threads";
import { Spinner } from "../ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  deriveThreadDetailsActivity,
  type ThreadDetailsActivityItem,
} from "./threadDetailsActivity";
import { ThreadDetailsSection } from "./ThreadDetailsSection";
import { THREAD_DETAILS_PANEL_ICON_CLASS } from "./threadDetailsPanelStyles";

interface ThreadDetailsActivityPanelProps {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly workspaceRoot: string | null;
  readonly showTerminalCommands: boolean;
  readonly showFileActions: boolean;
}

function ActivityRow({ item }: { readonly item: ThreadDetailsActivityItem }) {
  const gt = useGT();

  const statusLabel =
    item.status === "running"
      ? item.kind === "read"
        ? gt("Reading", { $context: "status of an active file read action" })
        : item.kind === "edit"
          ? gt("Editing", { $context: "status of an active file edit action" })
          : gt("Running", { $context: "status of an active terminal command" })
      : item.status === "failed"
        ? gt("Failed", { $context: "status of a failed agent action" })
        : item.kind === "read"
          ? gt("Read", { $context: "past-tense label for a completed file read action" })
          : item.kind === "edit"
            ? gt("Edit", { $context: "noun, a completed file edit action" })
            : null;

  return (
    <li>
      <Tooltip>
        <TooltipTrigger
          render={
            <div className="flex min-h-7 min-w-0 items-center gap-2 rounded-lg px-2.5 py-1 select-none" />
          }
        >
          {item.status === "running" ? (
            <Spinner aria-hidden size="xs" />
          ) : item.kind === "command" ? (
            <TerminalIcon
              aria-hidden
              className={cn(
                THREAD_DETAILS_PANEL_ICON_CLASS,
                item.status === "failed" && "text-destructive",
              )}
            />
          ) : item.kind === "read" ? (
            <EyeIcon
              aria-hidden
              className={cn(
                THREAD_DETAILS_PANEL_ICON_CLASS,
                item.status === "failed" && "text-destructive",
              )}
            />
          ) : (
            <FilePenLineIcon
              aria-hidden
              className={cn(
                THREAD_DETAILS_PANEL_ICON_CLASS,
                item.status === "failed" && "text-destructive",
              )}
            />
          )}
          <span
            className={cn(
              "min-w-0 flex-1 truncate font-mono text-xs leading-4",
              item.status === "failed" ? "text-destructive" : "text-foreground/85",
            )}
          >
            {item.label}
          </span>
          {statusLabel ? (
            <span
              className={cn(
                "shrink-0 text-2xs leading-4",
                item.status === "failed"
                  ? "text-destructive"
                  : item.status === "running"
                    ? "text-foreground/75"
                    : "text-muted-foreground",
              )}
            >
              {statusLabel}
            </span>
          ) : null}
        </TooltipTrigger>
        <TooltipPopup side="left">
          <span className="block max-w-xs break-all font-mono text-xs">{item.label}</span>
        </TooltipPopup>
      </Tooltip>
    </li>
  );
}

/** Terminal commands and file reads/edits executed by the agent in this thread. */
export function ThreadDetailsActivityPanel(props: ThreadDetailsActivityPanelProps) {
  const gt = useGT();
  const thread = useAtomValue(
    environmentThreadDetails.quietThreadAtom({
      environmentId: props.environmentId,
      threadId: props.threadId,
    }),
  );

  if (!thread) return null;

  const { terminalCommands, fileActions } = deriveThreadDetailsActivity(
    thread.projection.turnItems,
    props.workspaceRoot,
  );
  const showCommands = props.showTerminalCommands && terminalCommands.length > 0;
  const showFiles = props.showFileActions && fileActions.length > 0;

  if (!showCommands && !showFiles) return null;

  return (
    <>
      {showCommands ? (
        <ThreadDetailsSection
          headingId="thread-details-terminal-commands-heading"
          title={gt("Terminal commands")}
        >
          <ul
            data-thread-details-activity-list="terminal-commands"
            className="flex max-h-36 flex-col overflow-y-auto"
          >
            {terminalCommands.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ul>
        </ThreadDetailsSection>
      ) : null}

      {showFiles ? (
        <ThreadDetailsSection
          headingId="thread-details-file-actions-heading"
          title={gt("File reads and edits")}
        >
          <ul
            data-thread-details-activity-list="file-actions"
            className="flex max-h-36 flex-col overflow-y-auto"
          >
            {fileActions.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ul>
        </ThreadDetailsSection>
      ) : null}
    </>
  );
}
