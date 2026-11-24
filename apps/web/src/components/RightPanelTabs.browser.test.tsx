import "~/index.css";

import {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  ThreadId,
  type ServerProvider,
} from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import type { RightPanelSurface } from "~/rightPanelStore";
import { useQuietThreadShell } from "~/state/entities";
import { useEnvironmentProviders } from "~/state/environments";
import { makeThreadFixture } from "~/test-fixtures";
import { render, stubGlobal } from "../../test/render";
import { HistorySwipeNavigation } from "./HistorySwipeNavigation";
import { RightPanelTabs, type RightPanelTabsProps } from "./RightPanelTabs";
import { subscribePreviewAction } from "./preview/previewActionBus";

const navigateHistory = vi.hoisted(() => vi.fn());
vi.mock("../navigationHistory", () => ({ canNavigateHistory: () => true, navigateHistory }));
vi.mock("../state/entities", { spy: true });
vi.mock("../state/environments", { spy: true });

// Chromium starts a gesture scroll, and Electron reports its begin, only for a
// wheel event the page did not preventDefault; it then scrolls the latched scroller.
function trackpad() {
  const begin = new Set<() => void>();
  const end = new Set<() => void>();
  const subscribe = (listeners: Set<() => void>) => (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  let scrolling = false;
  return {
    bridge: {
      onTrackpadScrollBegin: subscribe(begin),
      onTrackpadScrollEnd: subscribe(end),
      onMenuAction: () => () => {},
    },
    scroll(target: Element, deltas: readonly number[]) {
      let scroller: Element | null = target;
      while (
        scroller &&
        (scroller.scrollWidth <= scroller.clientWidth ||
          !/auto|scroll/.test(getComputedStyle(scroller).overflowX))
      ) {
        scroller = scroller.parentElement;
      }
      for (const deltaX of deltas) {
        const event = new WheelEvent("wheel", {
          deltaX,
          bubbles: true,
          cancelable: true,
          composed: true,
        });
        target.dispatchEvent(event);
        if (event.defaultPrevented) continue;
        if (scroller) scroller.scrollLeft += deltaX;
        if (scrolling) continue;
        scrolling = true;
        for (const listener of begin) listener();
      }
      if (scrolling) for (const listener of end) listener();
      scrolling = false;
    },
  };
}

const surfaces: RightPanelSurface[] = Array.from({ length: 16 }, (_, index) => ({
  id: `terminal:${index}`,
  kind: "terminal",
  resourceId: `${index}`,
  terminalIds: [`${index}`],
  activeTerminalId: `${index}`,
}));

describe("RightPanelTabs", () => {
  it("a flick that scrolls the tab strip to its left edge keeps the thread, and so does a swipe from the edge", async () => {
    navigateHistory.mockReset();
    const { bridge, scroll } = trackpad();
    using _bridge = stubGlobal("desktopBridge", bridge);
    using _platform = vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    const panel = document.createElement("div");
    panel.style.cssText = "width: 320px; height: 200px; display: flex";
    const noop = () => {};
    await using screen = await render(
      <>
        <HistorySwipeNavigation />
        <RightPanelTabs
          mode="embedded"
          keybindings={[]}
          getShortcutContext={() => ({
            terminalFocus: false,
            terminalOpen: false,
            previewFocus: false,
            previewOpen: false,
            isWeb: true,
            isDesktop: false,
          })}
          surfaces={surfaces}
          environmentId={null}
          activeSurfaceId={null}
          pendingSurfaceIds={new Set()}
          previewSessions={{}}
          desktopByTabId={{}}
          terminalLabelsById={new Map(surfaces.map((surface) => [surface.id, "Terminal"]))}
          onActivate={noop}
          onCloseSurface={noop}
          onCloseOtherSurfaces={noop}
          onCloseSurfacesToRight={noop}
          onCloseAllSurfaces={noop}
          onCopyFilePath={noop}
          onAddBrowser={noop}
          onAddBrowserInProfile={noop}
          onAddTerminal={noop}
          onAddDiff={noop}
          onAddFiles={noop}
          onAddPullRequest={noop}
          onAddPullRequests={noop}
          onAddDevice={noop}
          browserAvailable={false}
          terminalAvailable
          diffAvailable={false}
          filesAvailable={false}
          pullRequestAvailable={false}
          pullRequestsAvailable={false}
          deviceAvailable={false}
        >
          {null}
        </RightPanelTabs>
      </>,
      { container: panel },
    );
    const viewport = screen.container.querySelector<HTMLElement>(
      '[data-right-panel-tab-list] [data-slot="scroll-area-viewport"]',
    )!;
    expect(viewport.scrollWidth - viewport.clientWidth).toBeGreaterThan(120);
    viewport.scrollLeft = 120;

    const momentum = Array.from({ length: 24 }, (_, index) => -60 * 0.85 ** index);
    scroll(viewport.querySelector("[data-active-tab]")!, [-10, -20, -30, ...momentum]);

    expect(viewport.scrollLeft).toBe(0);
    expect(navigateHistory).not.toHaveBeenCalled();

    viewport.scrollLeft = 0;
    scroll(viewport.querySelector("[data-active-tab]")!, [-40, -40, -40, -40, -40]);

    expect(navigateHistory).not.toHaveBeenCalled();
  });
});

const BROWSER_SURFACE: RightPanelSurface = {
  id: "browser:tab-1",
  kind: "preview",
  resourceId: "tab-1",
};
const DIFF_SURFACE: RightPanelSurface = { id: "diff", kind: "diff" };

function panel(activeSurface: RightPanelSurface) {
  const noop = () => {};
  const props: RightPanelTabsProps = {
    mode: "inline",
    keybindings: [],
    getShortcutContext: () => ({
      terminalFocus: false,
      terminalOpen: false,
      previewFocus: false,
      previewOpen: true,
      isWeb: true,
      isDesktop: false,
    }),
    surfaces: [BROWSER_SURFACE, DIFF_SURFACE],
    environmentId: EnvironmentId.make("environment-local"),
    activeSurfaceId: activeSurface.id,
    pendingSurfaceIds: new Set(),
    previewSessions: {},
    desktopByTabId: {},
    terminalLabelsById: new Map(),
    onActivate: noop,
    onCloseSurface: noop,
    onCloseOtherSurfaces: noop,
    onCloseSurfacesToRight: noop,
    onCloseAllSurfaces: noop,
    onCopyFilePath: noop,
    onAddBrowser: noop,
    onAddBrowserInProfile: noop,
    onAddTerminal: noop,
    onAddDiff: noop,
    onAddFiles: noop,
    onAddPullRequest: noop,
    onAddPullRequests: noop,
    onAddDevice: noop,
    browserAvailable: true,
    terminalAvailable: true,
    diffAvailable: true,
    filesAvailable: true,
    pullRequestAvailable: true,
    pullRequestsAvailable: true,
    deviceAvailable: true,
    children: (
      <div data-testid="surface-content">
        {/* Stands in for ServerBrowserSurface, whose page canvas handles thumb buttons itself. */}
        <canvas data-testid="page-canvas" onMouseUp={(event) => event.preventDefault()} />
        <InputGroup>
          <InputGroupInput aria-label="Address" />
          <InputGroupAddon data-testid="address-addon" align="inline-end" />
        </InputGroup>
      </div>
    ),
  };
  return <RightPanelTabs {...props} />;
}

// Chromium focuses on an uncancelled mousedown and runs history back/forward on an
// uncancelled button 3/4 mouseup.
function releaseThumbButton(
  target: Element,
  button: 3 | 4,
): { focusMoved: boolean; routerMoved: boolean } {
  const focused = document.activeElement;
  const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true, button });
  const up = new MouseEvent("mouseup", { bubbles: true, cancelable: true, button });
  target.dispatchEvent(down);
  target.dispatchEvent(up);
  return {
    focusMoved: !down.defaultPrevented || document.activeElement !== focused,
    routerMoved: !up.defaultPrevented,
  };
}

const STAYS_PUT = { focusMoved: false, routerMoved: false };

describe("right panel thumb buttons", () => {
  it("keep the app router still over a surface that is not a browser", async () => {
    await using screen = await render(panel(DIFF_SURFACE));
    const tabStrip = screen.container.querySelector("[data-right-panel-tabbar]")!;
    const content = screen.getByTestId("surface-content").element();

    expect(releaseThumbButton(tabStrip, 3)).toEqual(STAYS_PUT);
    expect(releaseThumbButton(tabStrip, 4)).toEqual(STAYS_PUT);
    expect(releaseThumbButton(content, 3)).toEqual(STAYS_PUT);
    expect(releaseThumbButton(content, 4)).toEqual(STAYS_PUT);
  });

  it("go back and forward in the active browser tab instead of the app router", async () => {
    const actions: string[] = [];
    using _subscription = { [Symbol.dispose]: subscribePreviewAction((a) => actions.push(a)) };
    await using screen = await render(panel(BROWSER_SURFACE));
    const tabStrip = screen.container.querySelector("[data-right-panel-tabbar]")!;
    const content = screen.getByTestId("surface-content").element();

    expect(releaseThumbButton(tabStrip, 3)).toEqual(STAYS_PUT);
    expect(releaseThumbButton(content, 4)).toEqual(STAYS_PUT);
    // The address addon focuses its input on press; a thumb press must leave focus alone.
    expect(releaseThumbButton(screen.getByTestId("address-addon").element(), 3)).toEqual(STAYS_PUT);
    expect(actions).toEqual(["back", "forward", "back"]);

    // The page canvas already went back in the tab; the panel must not go back a second time.
    releaseThumbButton(screen.getByTestId("page-canvas").element(), 3);
    expect(actions).toEqual(["back", "forward", "back"]);
  });
});

const DEVICE_SURFACE: RightPanelSurface = {
  id: "device:host:phone",
  kind: "device",
  target: { hostId: "host", deviceId: "phone", platform: "ios", name: "Phone" },
};

describe("device tab rename", () => {
  it("keeps the editor open on an Enter that confirms an IME candidate", async () => {
    const onRenameDevice = vi.fn();
    const props = panel(DEVICE_SURFACE).props as RightPanelTabsProps;
    await using screen = await render(
      <RightPanelTabs {...props} surfaces={[DEVICE_SURFACE]} onRenameDevice={onRenameDevice}>
        {null}
      </RightPanelTabs>,
    );
    await userEvent.dblClick(screen.getByRole("button", { name: "Phone", exact: true }));
    const input = screen.getByRole("textbox", { name: "Device tab name" });
    await userEvent.fill(input, "にほん");

    for (const shape of [
      { isComposing: true, keyCode: 13 },
      { isComposing: false, keyCode: 229 },
    ]) {
      input
        .element()
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...shape }),
        );
    }

    await expect.element(input).toHaveFocus();
    expect(onRenameDevice).not.toHaveBeenCalled();
    await userEvent.fill(input, "日本語");
    await userEvent.keyboard("{Enter}");
    expect(onRenameDevice).toHaveBeenCalledExactlyOnceWith(DEVICE_SURFACE.id, "日本語");
  });
});

describe("thread tab provider icon", () => {
  it("shows the provider icon on side-chat and linked-thread tabs", async () => {
    const environmentId = EnvironmentId.make("env-local");
    const sideThreadId = ThreadId.make("thread-side");
    const linkedThreadId = ThreadId.make("thread-linked");
    const claudeInstanceId = ProviderInstanceId.make("claudeAgent");
    const codexInstanceId = ProviderInstanceId.make("codex");
    const providers: ReadonlyArray<ServerProvider> = [
      {
        instanceId: claudeInstanceId,
        driver: ProviderDriverKind.make("claudeAgent"),
        displayName: "Claude",
        enabled: true,
        installed: true,
        status: "ready",
        availability: "available",
        auth: { status: "authenticated" },
        models: [],
      } as unknown as ServerProvider,
      {
        instanceId: codexInstanceId,
        driver: ProviderDriverKind.make("codex"),
        displayName: "Codex",
        enabled: true,
        installed: true,
        status: "ready",
        availability: "available",
        auth: { status: "authenticated" },
        models: [],
      } as unknown as ServerProvider,
    ];
    const sideShell = makeThreadFixture({
      environmentId,
      id: sideThreadId,
      title: "Side chat",
      providerInstanceId: claudeInstanceId,
      modelSelection: { instanceId: claudeInstanceId, model: "claude-sonnet-4-5" },
    });
    const linkedShell = makeThreadFixture({
      environmentId,
      id: linkedThreadId,
      title: "Linked chat",
      providerInstanceId: codexInstanceId,
      modelSelection: { instanceId: codexInstanceId, model: "gpt-5.4" },
    });

    using _providers = vi
      .mocked(useEnvironmentProviders)
      .mockReturnValue(new Map([[environmentId, providers]]));
    using _shell = vi.mocked(useQuietThreadShell).mockImplementation((ref) => {
      if (ref?.threadId === sideThreadId) return sideShell;
      if (ref?.threadId === linkedThreadId) return linkedShell;
      return null;
    });

    const tabSurfaces: RightPanelSurface[] = [
      { id: `thread:${sideThreadId}`, kind: "thread", threadId: sideThreadId },
      {
        id: `linked-thread:${linkedThreadId}`,
        kind: "linked-thread",
        viaEnvironmentId: environmentId,
        environmentId,
        threadId: linkedThreadId,
        label: "Local",
        title: "Linked chat",
      },
    ];
    const props = panel(tabSurfaces[0]!).props as RightPanelTabsProps;
    await using screen = await render(
      <RightPanelTabs
        {...props}
        environmentId={environmentId}
        surfaces={tabSurfaces}
        activeSurfaceId={tabSurfaces[0]!.id}
      >
        {null}
      </RightPanelTabs>,
    );

    const drivers = Array.from(
      screen.container.querySelectorAll<HTMLElement>("[data-provider-driver]"),
    ).map((element) => element.dataset.providerDriver);
    expect(drivers).toEqual(["claudeAgent", "codex"]);
  });
});
