import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  Excalidraw,
  MainMenu,
  convertToExcalidrawElements,
} from "@excalidraw/excalidraw";
import { FONT_FAMILY, ROUNDNESS } from "@excalidraw/common";
import { getCommonBounds } from "@excalidraw/element";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element/transform";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";

import { api } from "../convex/_generated/api";
import { useHandleAppTheme } from "../useHandleAppTheme";

import type { FunctionReturnType } from "convex/server";

type WorkspaceSummary = FunctionReturnType<typeof api.workspaces.list>[number];

const CARD_WIDTH = 240;
const CARD_HEIGHT = 150;
const GAP = 32;
const MAX_COLUMNS = 3;

// sentinel link for the "new workspace" card — every link click is
// intercepted in `onLinkOpen`, so this is never actually navigated to
const NEW_WORKSPACE_LINK = "/workspaces/new";

// excalidraw's own default palette, so the picker is drawn from the same
// material as anything you'd sketch on the canvas
const CARD_COLORS = [
  { background: "#ffec99", stroke: "#1e1e1e" },
  { background: "#b2f2bb", stroke: "#1e1e1e" },
  { background: "#a5d8ff", stroke: "#1e1e1e" },
  { background: "#ffc9c9", stroke: "#1e1e1e" },
];

const buildScene = (
  workspaces: WorkspaceSummary[],
): ExcalidrawElementSkeleton[] => {
  const cardCount = workspaces.length + 1;
  const columns = Math.min(MAX_COLUMNS, cardCount);
  const gridWidth = columns * CARD_WIDTH + (columns - 1) * GAP;

  const position = (index: number) => ({
    x: (index % columns) * (CARD_WIDTH + GAP),
    y: Math.floor(index / columns) * (CARD_HEIGHT + GAP),
  });

  const title: ExcalidrawElementSkeleton = {
    type: "text",
    // a centered text element is laid out around `x`, and its width is
    // measured from the text itself, so anchor it to the grid's midpoint
    x: gridWidth / 2,
    y: -110,
    text: "Pick a workspace",
    fontSize: 36,
    fontFamily: FONT_FAMILY.Excalifont,
    textAlign: "center",
    strokeColor: "#1e1e1e",
  };

  const cards = workspaces.flatMap(
    (workspace, index): ExcalidrawElementSkeleton[] => {
      const colors = CARD_COLORS[index % CARD_COLORS.length];
      const { x, y } = position(index);
      const card: ExcalidrawElementSkeleton = {
        type: "rectangle",
        x,
        y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: colors.background,
        strokeColor: colors.stroke,
        fillStyle: "solid",
        strokeWidth: 2,
        roughness: 1,
        roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
        link: `/board/${workspace._id}`,
        label: {
          text: workspace.name,
          fontSize: 20,
          fontFamily: FONT_FAMILY.Excalifont,
          strokeColor: "#1e1e1e",
        },
      };

      if (workspace.isOwner) {
        return [card];
      }

      // boards you joined through someone's share link sit in the same grid as
      // your own, so caption them rather than leaving them indistinguishable
      return [
        card,
        {
          type: "text",
          x: x + CARD_WIDTH / 2,
          y: y + CARD_HEIGHT + 8,
          text: "Shared with you",
          fontSize: 12,
          fontFamily: FONT_FAMILY.Excalifont,
          textAlign: "center",
          strokeColor: "#868e96",
        },
      ];
    },
  );

  const newCard: ExcalidrawElementSkeleton = {
    type: "rectangle",
    ...position(workspaces.length),
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: "transparent",
    strokeColor: "#1e1e1e",
    strokeStyle: "dashed",
    strokeWidth: 2,
    roughness: 1,
    roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    link: NEW_WORKSPACE_LINK,
    label: {
      text: "+ New workspace",
      fontSize: 20,
      fontFamily: FONT_FAMILY.Excalifont,
      strokeColor: "#1e1e1e",
    },
  };

  return [title, ...cards, newCard];
};

export const WorkspacePicker = () => {
  const navigate = useNavigate();
  const workspaces = useQuery(api.workspaces.list);
  const createWorkspace = useMutation(api.workspaces.create);
  const { editorTheme, appTheme, setAppTheme } = useHandleAppTheme();
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);

  const elements = useMemo(
    () =>
      workspaces ? convertToExcalidrawElements(buildScene(workspaces)) : [],
    [workspaces],
  );

  const centerScene = useCallback(() => {
    if (excalidrawAPI && elements.length) {
      // bounds rather than the elements themselves: `setViewport` resolves
      // element targets against the committed scene, which this can run ahead of
      excalidrawAPI.setViewport({
        target: getCommonBounds(elements),
        fit: "scale-down",
      });
    }
  }, [excalidrawAPI, elements]);

  // the card list changes as workspaces are created/renamed, and `initialData`
  // is only read once, so push subsequent scenes through the API
  useEffect(() => {
    if (!excalidrawAPI || !elements.length) {
      return;
    }
    excalidrawAPI.updateScene({ elements });
    centerScene();
  }, [excalidrawAPI, elements, centerScene]);

  useEffect(() => {
    window.addEventListener("resize", centerScene);
    return () => window.removeEventListener("resize", centerScene);
  }, [centerScene]);

  // captured when the editor actually mounts (i.e. once the workspaces have
  // loaded) — not on the first render, when there'd be nothing to show yet
  const initialDataRef = useRef<ExcalidrawInitialDataState | null>(null);
  if (workspaces !== undefined && !initialDataRef.current) {
    initialDataRef.current = {
      elements,
      appState: { viewModeEnabled: true },
      scrollToContent: true,
    };
  }

  if (workspaces === undefined || !initialDataRef.current) {
    return <div style={{ padding: "2rem" }}>Loading…</div>;
  }

  return (
    <div style={{ height: "100%" }} className="excalidraw-app">
      <Excalidraw
        onExcalidrawAPI={setExcalidrawAPI}
        initialData={initialDataRef.current}
        viewModeEnabled
        theme={editorTheme}
        onThemeChange={setAppTheme}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: false,
            export: false,
            loadScene: false,
            saveAsImage: false,
            saveToActiveFile: false,
            // the picker's menu offers the same app-level theme selector the
            // board does, and ToggleTheme renders nothing while the action is
            // disabled here
            toggleTheme: true,
          },
        }}
        onLinkOpen={(element, event) => {
          // links here are navigation targets inside the app, never real URLs
          event.preventDefault();
          if (element.link === NEW_WORKSPACE_LINK) {
            createWorkspace({ name: "Untitled workspace" }).then(
              (workspaceId) => navigate(`/board/${workspaceId}`),
            );
          } else if (element.link) {
            navigate(element.link);
          }
        }}
      >
        {/* supplying a menu replaces the library's fallback one, so carry over
            the items it was already showing here and add the same app-level
            theme selector the board page has */}
        <MainMenu>
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.Help />
          <MainMenu.Separator />
          <MainMenu.Group title="Excalidraw links">
            <MainMenu.DefaultItems.Socials />
          </MainMenu.Group>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme
            allowSystemTheme
            theme={appTheme}
          />
        </MainMenu>
      </Excalidraw>
    </div>
  );
};
