import {
  Excalidraw,
  TTDDialogTrigger,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  CommandPalette,
  DEFAULT_CATEGORIES,
} from "@excalidraw/excalidraw/components/CommandPalette/CommandPalette";
import { ErrorDialog } from "@excalidraw/excalidraw/components/ErrorDialog";
import {
  VERSION_TIMEOUT,
  getVersion,
  getFrame,
  resolvablePromise,
  isDevEnv,
} from "@excalidraw/common";
import polyfill from "@excalidraw/excalidraw/polyfill";
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  GithubIcon,
  XBrandIcon,
  DiscordIcon,
  youtubeIcon,
} from "@excalidraw/excalidraw/components/icons";
import { isElementLink, isInitializedImageElement } from "@excalidraw/element";
import clsx from "clsx";
import { useHandleLibrary } from "@excalidraw/excalidraw/data/library";

import type {
  FileId,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
  UIAppState,
  ExcalidrawProps,
} from "@excalidraw/excalidraw/types";
import type { ResolvablePromise } from "@excalidraw/common/utils";

import CustomStats from "./CustomStats";
import { AppFooter } from "./components/AppFooter";
import { AppMainMenu } from "./components/AppMainMenu";
import { AppWelcomeScreen } from "./components/AppWelcomeScreen";
import { WorkspaceSwitcher } from "./components/WorkspaceSwitcher";

import { updateStaleImageStatuses } from "./data/FileManager";
import { FileStatusStore } from "./data/fileStatusStore";
import {
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
} from "./data/libraryStorage";
import { useConvexFileManager } from "./data/useConvexFileManager";
import { useHandleAppTheme } from "./useHandleAppTheme";
import { useAppLangCode } from "./app-language/language-state";
import DebugCanvas, {
  debugRenderer,
  isVisualDebuggerEnabled,
  loadSavedDebugState,
} from "./components/DebugCanvas";
import { AIComponents } from "./components/AI";
import { useSceneSync } from "./collab/useSceneSync";
import { usePresenceCollaborators } from "./collab/usePresenceCollaborators";

import "./index.scss";

import type { Id } from "./convex/_generated/dataModel";

polyfill();

window.EXCALIDRAW_THROTTLE_RENDER = true;

declare global {
  interface BeforeInstallPromptEventChoiceResult {
    outcome: "accepted" | "dismissed";
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<BeforeInstallPromptEventChoiceResult>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let pwaEvent: BeforeInstallPromptEvent | null = null;

// Adding a listener outside of the component as it may (?) need to be
// subscribed early to catch the event.
//
// Also note that it will fire only if certain heuristics are met (user has
// used the app for some time, etc.)
window.addEventListener(
  "beforeinstallprompt",
  (event: BeforeInstallPromptEvent) => {
    // prevent Chrome <= 67 from automatically showing the prompt
    event.preventDefault();
    // cache for later use
    pwaEvent = event;
  },
);

let isSelfEmbedding = false;

if (window.self !== window.top) {
  try {
    const parentUrl = new URL(document.referrer);
    const currentUrl = new URL(window.location.href);
    if (parentUrl.origin === currentUrl.origin) {
      isSelfEmbedding = true;
    }
  } catch (error) {
    // ignore
  }
}

export const ExcalidrawWrapper = ({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) => {
  const excalidrawAPI = useExcalidrawAPI();

  const [errorMessage, setErrorMessage] = useState("");

  const { editorTheme, appTheme, setAppTheme } = useHandleAppTheme();

  const [langCode] = useAppLangCode();

  // initial state
  // ---------------------------------------------------------------------------

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise =
      resolvablePromise<ExcalidrawInitialDataState | null>();
  }

  const debugCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    trackEvent("load", "frame", getFrame());
    // Delayed so that the app has a time to load the latest SW
    setTimeout(() => {
      trackEvent("load", "version", getVersion());
    }, VERSION_TIMEOUT);
  }, []);

  useHandleLibrary({
    excalidrawAPI,
    adapter: LibraryIndexedDBAdapter,
    // TODO maybe remove this in several months (shipped: 24-03-11)
    migrationAdapter: LibraryLocalStorageMigrationAdapter,
  });

  const [, forceRefresh] = useState(false);

  useEffect(() => {
    if (isDevEnv()) {
      const debugState = loadSavedDebugState();

      if (debugState.enabled && !window.visualDebug) {
        window.visualDebug = {
          data: [],
        };
      } else {
        delete window.visualDebug;
      }
      forceRefresh((prev) => !prev);
    }
  }, [excalidrawAPI]);

  const { queueSave } = useSceneSync({
    workspaceId,
    excalidrawAPI,
    initialStatePromiseRef,
  });

  usePresenceCollaborators({ workspaceId, excalidrawAPI });

  const fileManager = useConvexFileManager(workspaceId);
  const loadedFileIdsRef = useRef(new Set<FileId>());

  const ensureFilesLoaded = useCallback(
    (elements: readonly OrderedExcalidrawElement[]) => {
      if (!excalidrawAPI) {
        return;
      }
      const fileIds = elements.reduce((acc, element) => {
        if (
          isInitializedImageElement(element) &&
          !loadedFileIdsRef.current.has(element.fileId)
        ) {
          loadedFileIdsRef.current.add(element.fileId);
          acc.push(element.fileId);
        }
        return acc;
      }, [] as FileId[]);

      if (!fileIds.length) {
        return;
      }

      fileManager.getFiles(fileIds).then(({ loadedFiles, erroredFiles }) => {
        excalidrawAPI.addFiles(loadedFiles);
        updateStaleImageStatuses({
          excalidrawAPI,
          erroredFiles,
          elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
        });
      });
    },
    [excalidrawAPI, fileManager],
  );

  useEffect(() => {
    initialStatePromiseRef.current.promise.then((scene) => {
      if (scene?.elements) {
        ensureFilesLoaded(scene.elements as OrderedExcalidrawElement[]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureFilesLoaded]);

  const onChange = (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    queueSave(elements, appState);
    ensureFilesLoaded(elements);
    fileManager.saveFiles({ elements, files });

    // Render the debug scene if the debug canvas is available
    if (debugCanvasRef.current && excalidrawAPI) {
      debugRenderer(
        debugCanvasRef.current,
        appState,
        elements,
        window.devicePixelRatio,
      );
    }
  };

  const renderCustomStats = (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
  ) => {
    return (
      <CustomStats
        setToast={(message) => excalidrawAPI!.setToast({ message })}
        appState={appState}
        elements={elements}
      />
    );
  };

  // ---------------------------------------------------------------------------
  // onExport — intercepts file save to wait for pending image loads
  // ---------------------------------------------------------------------------
  const onExport: Required<ExcalidrawProps>["onExport"] = useCallback(
    async function* () {
      let snapshot = FileStatusStore.getSnapshot();
      const { pending, total } = FileStatusStore.getPendingCount(
        snapshot.value,
      );
      if (pending === 0) {
        return;
      }

      // Yield initial progress
      yield {
        type: "progress",
        progress: (total - pending) / total,
        message: `Loading images (${total - pending}/${total})...`,
      };

      // Wait for all pending images to finish
      while (true) {
        snapshot = await FileStatusStore.pull(snapshot.version);
        const { pending: nowPending, total: nowTotal } =
          FileStatusStore.getPendingCount(snapshot.value);

        yield {
          type: "progress",
          progress: (nowTotal - nowPending) / nowTotal,
          message: `Loading images (${nowTotal - nowPending}/${nowTotal})...`,
        };

        if (nowPending === 0) {
          await new Promise((r) => setTimeout(r, 500));
          yield {
            type: "progress",
            message: `Preparing export...`,
          };
          return;
        }
      }
    },
    [],
  );

  // const onExport = () => {
  //   return new Promise((r) => setTimeout(r, 2500));
  //   // console.log("onExport");
  // };

  // browsers generally prevent infinite self-embedding, there are
  // cases where it still happens, and while we disallow self-embedding
  // by not whitelisting our own origin, this serves as an additional guard
  if (isSelfEmbedding) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          height: "100%",
        }}
      >
        <h1>I'm not a pretzel!</h1>
      </div>
    );
  }

  return (
    <div
      style={{ height: "100%" }}
      className={clsx("excalidraw-app", "is-collaborating")}
    >
      <Excalidraw
        onChange={onChange}
        onExport={onExport}
        initialData={initialStatePromiseRef.current.promise}
        isCollaborating
        UIOptions={{
          canvasActions: {
            toggleTheme: true,
          },
        }}
        langCode={langCode}
        renderCustomStats={renderCustomStats}
        detectScroll={false}
        handleKeyboardGlobally={true}
        autoFocus={true}
        theme={editorTheme}
        onThemeChange={setAppTheme}
        onLinkOpen={(element, event) => {
          if (element.link && isElementLink(element.link)) {
            event.preventDefault();
            excalidrawAPI?.setViewport({
              target: element.link,
              fit: "scale-down",
              animation: true,
            });
          }
        }}
      >
        <AppMainMenu
          theme={appTheme}
          refresh={() => forceRefresh((prev) => !prev)}
        />
        <WorkspaceSwitcher workspaceId={workspaceId} />
        <AppWelcomeScreen />
        <AppFooter onChange={() => excalidrawAPI?.refresh()} />
        {excalidrawAPI && <AIComponents excalidrawAPI={excalidrawAPI} />}

        <TTDDialogTrigger />

        {errorMessage && (
          <ErrorDialog onClose={() => setErrorMessage("")}>
            {errorMessage}
          </ErrorDialog>
        )}

        <CommandPalette
          customCommandPaletteItems={[
            {
              label: "GitHub",
              icon: GithubIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: [
                "issues",
                "bugs",
                "requests",
                "report",
                "features",
                "social",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://github.com/excalidraw/excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.followUs"),
              icon: XBrandIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["twitter", "contact", "social", "community"],
              perform: () => {
                window.open(
                  "https://x.com/excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.discordChat"),
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              icon: DiscordIcon,
              keywords: [
                "chat",
                "talk",
                "contact",
                "bugs",
                "requests",
                "report",
                "feedback",
                "suggestions",
                "social",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://discord.gg/UexuTaE",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: "YouTube",
              icon: youtubeIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["features", "tutorials", "howto", "help", "community"],
              perform: () => {
                window.open(
                  "https://youtube.com/@excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.installPWA"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => !!pwaEvent,
              perform: () => {
                if (pwaEvent) {
                  pwaEvent.prompt();
                  pwaEvent.userChoice.then(() => {
                    // event cannot be reused, but we'll hopefully
                    // grab new one as the event should be fired again
                    pwaEvent = null;
                  });
                }
              },
            },
          ]}
        />
        {isVisualDebuggerEnabled() && excalidrawAPI && (
          <DebugCanvas
            appState={excalidrawAPI.getAppState()}
            scale={window.devicePixelRatio}
            ref={debugCanvasRef}
          />
        )}
      </Excalidraw>
    </div>
  );
};
