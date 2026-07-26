import {
  fireEvent,
  render,
  toggleMenu,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";
import { vi } from "vitest";

import { WorkspacePicker } from "../components/WorkspacePicker";

import type { Id } from "../convex/_generated/dataModel";

const workspace = (id: string, name: string, isOwner = true) => ({
  _id: id as Id<"workspaces">,
  name,
  createdAt: 0,
  isOwner,
  isShared: false,
});

const workspaces = [
  workspace("aaa", "Roadmap"),
  workspace("bbb", "Sketches", false),
];

const navigate = vi.fn();
const createWorkspace = vi.fn(async () => "ccc");

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

vi.mock("convex/react", () => ({
  useQuery: () => workspaces,
  useMutation: () => createWorkspace,
}));

const { h } = window;

describe("WorkspacePicker", () => {
  it("draws a card per workspace, plus a create card, out of canvas shapes", async () => {
    await render(<WorkspacePicker />);

    await waitFor(() => {
      expect(h.elements.length).toBeGreaterThan(0);
    });

    const rectangles = h.elements.filter((el) => el.type === "rectangle");
    const texts = h.elements.filter((el) => el.type === "text");

    // one card per workspace + the "new workspace" card
    expect(rectangles.length).toBe(workspaces.length + 1);
    expect(rectangles.map((el) => el.link)).toEqual([
      "/board/aaa",
      "/board/bbb",
      "/workspaces/new",
    ]);

    // the card names are labels bound to their cards, not free-floating text
    expect(
      texts
        .filter((el) => (el as any).containerId)
        .map((el) => (el as any).text),
    ).toEqual(["Roadmap", "Sketches", "+ New workspace"]);

    // free-floating: the heading, plus a caption under the one board that was
    // shared with this user rather than created by them
    expect(
      texts
        .filter((el) => !(el as any).containerId)
        .map((el) => (el as any).text),
    ).toEqual(["Pick a workspace", "Shared with you"]);
  });

  it("offers the same light/dark/system theme selector the board page has", async () => {
    // the picker persists the app-level theme, so don't leak it to other tests
    const storedTheme = localStorage.getItem("excalidraw-theme");

    try {
      const { container } = await render(<WorkspacePicker />);

      await waitFor(() => {
        expect(h.elements.length).toBeGreaterThan(0);
      });

      toggleMenu(container);

      // guards `UIOptions.canvasActions.toggleTheme`: with it off, as it was
      // here, the item renders away entirely
      const themeChoices = [
        ...container.querySelectorAll<HTMLInputElement>('input[name="theme"]'),
      ];
      expect(themeChoices).toHaveLength(3);

      // and it's wired up, not just present — picking dark drives the theme
      fireEvent.click(themeChoices[1]);

      await waitFor(() => {
        expect(h.state.theme).toBe("dark");
      });
    } finally {
      if (storedTheme === null) {
        localStorage.removeItem("excalidraw-theme");
      } else {
        localStorage.setItem("excalidraw-theme", storedTheme);
      }
    }
  });

  it("lays the cards out in a grid without overlapping", async () => {
    await render(<WorkspacePicker />);

    await waitFor(() => {
      expect(h.elements.length).toBeGreaterThan(0);
    });

    const rectangles = h.elements.filter((el) => el.type === "rectangle");

    for (const [index, rectangle] of rectangles.entries()) {
      expect(rectangle.x).toBe(index * (240 + 32));
      expect(rectangle.y).toBe(0);
    }
  });
});
