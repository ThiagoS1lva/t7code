import { T, useGT, Var } from "gt-react";
import { ChevronDownIcon } from "lucide-react";

import {
  getClientSettings,
  updateClientSettings,
  useClientSettings,
} from "../../hooks/useSettings";
import { ThreadDetailsItemsMenuItems } from "../chat/ThreadDetailsItemsMenu";
import {
  isDefaultThreadDetailsVisibility,
  resolveThreadDetailsVisibility,
  RESET_THREAD_DETAILS_ITEMS,
  setThreadDetailsItem,
  THREAD_DETAILS_ITEMS,
} from "../chat/threadDetailsItems";
import { Button } from "../ui/button";
import { Menu, MenuPopup, MenuTrigger } from "../ui/menu";
import { Switch } from "../ui/switch";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { useSearchableSetting } from "./settingsSearch";

const TERMINAL_COMMANDS_ITEM = THREAD_DETAILS_ITEMS.find((item) => item.id === "terminalCommands")!;
const FILE_ACTIONS_ITEM = THREAD_DETAILS_ITEMS.find((item) => item.id === "fileActions")!;

export function ThreadDetailsItemsRow() {
  const gt = useGT();
  const searchableSetting = useSearchableSetting();
  const visibility = useClientSettings(resolveThreadDetailsVisibility);
  const enabled = THREAD_DETAILS_ITEMS.filter((item) => visibility[item.id]).length;
  return (
    <>
      <SettingsRow
        {...searchableSetting("thread-details-items")}
        description={gt(
          "Choose what the thread details card shows. You can also right-click the card.",
        )}
        resetAction={
          isDefaultThreadDetailsVisibility(visibility) ? null : (
            <SettingResetButton
              ariaLabel={gt("Reset thread details to default")}
              onClick={() => updateClientSettings(RESET_THREAD_DETAILS_ITEMS)}
            />
          )
        }
        control={
          <Menu>
            <MenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between sm:w-40"
                  aria-label={gt("Thread details: {enabled} of {total} on", {
                    enabled,
                    total: THREAD_DETAILS_ITEMS.length,
                  })}
                />
              }
            >
              <T>
                <Var>{enabled}</Var> of <Var>{THREAD_DETAILS_ITEMS.length}</Var> on
              </T>
              <ChevronDownIcon aria-hidden />
            </MenuTrigger>
            <MenuPopup align="end">
              <ThreadDetailsItemsMenuItems />
            </MenuPopup>
          </Menu>
        }
      />
      <SettingsRow
        {...searchableSetting("thread-details-terminal-commands")}
        description={gt(
          "Show terminal commands running or executed by the agent in the thread details card.",
        )}
        resetAction={
          visibility.terminalCommands !== TERMINAL_COMMANDS_ITEM.defaultVisible ? (
            <SettingResetButton
              ariaLabel={gt("Reset thread details terminal commands to default")}
              onClick={() =>
                updateClientSettings({
                  threadDetailsItems: setThreadDetailsItem(
                    getClientSettings(),
                    TERMINAL_COMMANDS_ITEM,
                    TERMINAL_COMMANDS_ITEM.defaultVisible,
                  ),
                })
              }
            />
          ) : null
        }
        control={
          <Switch
            checked={visibility.terminalCommands}
            onCheckedChange={(checked) =>
              updateClientSettings({
                threadDetailsItems: setThreadDetailsItem(
                  getClientSettings(),
                  TERMINAL_COMMANDS_ITEM,
                  Boolean(checked),
                ),
              })
            }
            aria-label={gt("Terminal commands in thread details")}
          />
        }
      />
      <SettingsRow
        {...searchableSetting("thread-details-file-actions")}
        description={gt(
          "Show file reads and edits running or executed by the agent in the thread details card.",
        )}
        resetAction={
          visibility.fileActions !== FILE_ACTIONS_ITEM.defaultVisible ? (
            <SettingResetButton
              ariaLabel={gt("Reset thread details file reads and edits to default")}
              onClick={() =>
                updateClientSettings({
                  threadDetailsItems: setThreadDetailsItem(
                    getClientSettings(),
                    FILE_ACTIONS_ITEM,
                    FILE_ACTIONS_ITEM.defaultVisible,
                  ),
                })
              }
            />
          ) : null
        }
        control={
          <Switch
            checked={visibility.fileActions}
            onCheckedChange={(checked) =>
              updateClientSettings({
                threadDetailsItems: setThreadDetailsItem(
                  getClientSettings(),
                  FILE_ACTIONS_ITEM,
                  Boolean(checked),
                ),
              })
            }
            aria-label={gt("File reads and edits in thread details")}
          />
        }
      />
    </>
  );
}
