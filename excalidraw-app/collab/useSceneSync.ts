import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import throttle from "lodash.throttle";
import { CaptureUpdateAction, reconcileElements } from "@excalidraw/excalidraw";
import { clearAppStateForDatabase } from "@excalidraw/excalidraw/appState";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
import type { ResolvablePromise } from "@excalidraw/common/utils";

import { api } from "../convex/_generated/api";

import type { Id } from "../convex/_generated/dataModel";

const SAVE_DEBOUNCE_MS = 350;

export const useSceneSync = ({
  workspaceId,
  excalidrawAPI,
  initialStatePromiseRef,
}: {
  workspaceId: Id<"workspaces">;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  initialStatePromiseRef: React.MutableRefObject<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>;
}) => {
  const scene = useQuery(api.scenes.get, { workspaceId });
  const saveSceneMutation = useMutation(api.scenes.save);

  const hasLoadedInitialScene = useRef(false);
  const lastSyncedSceneVersion = useRef(0);

  // Initial load (resolves the promise Excalidraw waits on before mounting)
  // and, on every subsequent change, incoming remote updates reconciled
  // against whatever the local user is currently doing so we never clobber
  // an in-progress local edit.
  useEffect(() => {
    if (scene === undefined) {
      return;
    }

    if (!hasLoadedInitialScene.current) {
      hasLoadedInitialScene.current = true;
      lastSyncedSceneVersion.current = scene?.sceneVersion ?? 0;
      initialStatePromiseRef.current.promise.resolve(
        scene
          ? {
              elements: restoreElements(scene.elements, null, {
                repairBindings: true,
                deleteInvisibleElements: true,
              }),
              appState: restoreAppState(scene.appState, null),
              scrollToContent: true,
            }
          : null,
      );
      return;
    }

    if (!excalidrawAPI || !scene) {
      return;
    }

    if (scene.sceneVersion <= lastSyncedSceneVersion.current) {
      return;
    }

    lastSyncedSceneVersion.current = scene.sceneVersion;

    const remoteElements = restoreElements(
      scene.elements,
      null,
    ) as RemoteExcalidrawElement[];

    const reconciled = reconcileElements(
      excalidrawAPI.getSceneElementsIncludingDeleted(),
      remoteElements,
      excalidrawAPI.getAppState(),
    );

    excalidrawAPI.updateScene({
      elements: reconciled,
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, [scene, excalidrawAPI, initialStatePromiseRef]);

  const throttledSave = useMemo(
    () =>
      throttle(
        (elements: string, appState: string) => {
          saveSceneMutation({ workspaceId, elements, appState }).then(
            (newVersion) => {
              lastSyncedSceneVersion.current = newVersion;
            },
            (error) => {
              // the workspace can go away under a save that's already in
              // flight — deleting the board you're drawing on flushes one on
              // the way out — and there's nothing left to persist it to
              console.warn("Failed to save scene", error);
            },
          );
        },
        SAVE_DEBOUNCE_MS,
        { leading: false, trailing: true },
      ),
    [saveSceneMutation, workspaceId],
  );

  useEffect(() => {
    return () => {
      // flush rather than cancel: on a workspace switch this teardown is the
      // last chance to persist the trailing edit, and the pending call still
      // closes over the workspace it was made in
      throttledSave.flush();
    };
  }, [throttledSave]);

  const queueSave = useCallback(
    (elements: readonly OrderedExcalidrawElement[], appState: AppState) => {
      throttledSave(
        JSON.stringify(elements),
        JSON.stringify(clearAppStateForDatabase(appState)),
      );
    },
    [throttledSave],
  );

  return { queueSave };
};
