import {
  CaptureUpdateAction,
  ExcalidrawAPIProvider,
  newElementWith,
} from "@excalidraw/excalidraw";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { act, render, waitFor } from "@excalidraw/excalidraw/tests/test-utils";
import { vi } from "vitest";

import { StoreIncrement } from "@excalidraw/element";

import type { DurableIncrement, EphemeralIncrement } from "@excalidraw/element";

import { ExcalidrawWrapper as ExcalidrawApp } from "../App";

import type { Id } from "../convex/_generated/dataModel";

const { h } = window;

const TEST_WORKSPACE_ID = "test-workspace" as Id<"workspaces">;

Object.defineProperty(window, "crypto", {
  value: {
    getRandomValues: (arr: number[]) =>
      arr.forEach((v, i) => (arr[i] = Math.floor(Math.random() * 256))),
    subtle: {
      generateKey: () => {},
      exportKey: () => ({ k: "sTdLvMC_M3V8_vGa3UVRDg" }),
    },
  },
});

vi.mock("../collab/useSceneSync", () => ({
  useSceneSync: ({ initialStatePromiseRef }: any) => {
    initialStatePromiseRef.current.promise.resolve(null);
    return { queueSave: () => {} };
  },
}));

vi.mock("../data/useConvexFileManager", () => ({
  useConvexFileManager: () => ({
    getFiles: async () => ({ loadedFiles: [], erroredFiles: new Map() }),
    saveFiles: async () => ({ savedFiles: new Map(), erroredFiles: new Map() }),
  }),
}));

vi.mock("../collab/usePresenceCollaborators", () => ({
  usePresenceCollaborators: () => {},
}));

// the editor is rendered bare here, without the router and Convex provider it
// normally sits inside — the workspace chrome around it (main menu, switcher)
// reaches for both
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: () => [],
  useMutation: () => vi.fn(),
}));

describe("store increments", () => {
  it("should emit two ephemeral increments even though updates get batched", async () => {
    const durableIncrements: DurableIncrement[] = [];
    const ephemeralIncrements: EphemeralIncrement[] = [];

    await render(
      <ExcalidrawAPIProvider>
        <ExcalidrawApp workspaceId={TEST_WORKSPACE_ID} />
      </ExcalidrawAPIProvider>,
    );

    h.store.onStoreIncrementEmitter.on((increment) => {
      if (StoreIncrement.isDurable(increment)) {
        durableIncrements.push(increment);
      } else {
        ephemeralIncrements.push(increment);
      }
    });

    // eslint-disable-next-line dot-notation
    expect(h.store["scheduledMicroActions"].length).toBe(0);
    expect(durableIncrements.length).toBe(0);
    expect(ephemeralIncrements.length).toBe(0);

    const rectProps = {
      type: "rectangle",
      id: "A",
      height: 200,
      width: 100,
      x: 0,
      y: 0,
    } as const;

    const rect = API.createElement({ ...rectProps });

    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    await waitFor(() => {
      // expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(durableIncrements.length).toBe(1);
    });

    // simulate two batched remote updates
    act(() => {
      h.app.updateScene({
        elements: [newElementWith(h.elements[0], { x: 100 })],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      h.app.updateScene({
        elements: [newElementWith(h.elements[0], { x: 200 })],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      // we scheduled two micro actions,
      // which confirms they are going to be executed as part of one batched component update
      // eslint-disable-next-line dot-notation
      expect(h.store["scheduledMicroActions"].length).toBe(2);
    });

    await waitFor(() => {
      // altough the updates get batched,
      // we expect two ephemeral increments for each update,
      // and each such update should have the expected change
      expect(ephemeralIncrements.length).toBe(2);
      expect(ephemeralIncrements[0].change.elements.A).toEqual(
        expect.objectContaining({ x: 100 }),
      );
      expect(ephemeralIncrements[1].change.elements.A).toEqual(
        expect.objectContaining({ x: 200 }),
      );
      // eslint-disable-next-line dot-notation
      expect(h.store["scheduledMicroActions"].length).toBe(0);
    });
  });
});
