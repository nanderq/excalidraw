import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { ExcalidrawAPIProvider } from "@excalidraw/excalidraw";

import { Provider, appJotaiStore } from "./app-jotai";
import { AuthScreen } from "./components/AuthScreen";
import { JoinWorkspace } from "./components/JoinWorkspace";
import { TopErrorBoundary } from "./components/TopErrorBoundary";
import { WorkspaceNotice } from "./components/WorkspaceNotice";
import { WorkspacePicker } from "./components/WorkspacePicker";
import { ExcalidrawWrapper } from "./App";
import { api } from "./convex/_generated/api";

import type { ReactNode } from "react";
import type { Id } from "./convex/_generated/dataModel";

const RequireAuth = ({ children }: { children: ReactNode }) => {
  const location = useLocation();

  // carry the destination through the sign-in detour, so a share link handed
  // to someone with no session still lands them on the board
  const signInTo = `/sign-in?redirect=${encodeURIComponent(
    `${location.pathname}${location.search}`,
  )}`;

  return (
    <>
      <AuthLoading>
        <div style={{ padding: "2rem" }}>Loading…</div>
      </AuthLoading>
      <Unauthenticated>
        <Navigate to={signInTo} replace />
      </Unauthenticated>
      <Authenticated>{children}</Authenticated>
    </>
  );
};

// With no workspace selected we show the picker, drawn on a canvas out of the
// same shapes and text you'd sketch with inside a board (see WorkspacePicker).
// Switching between boards once you're in one happens via WorkspaceSwitcher.

const Board = () => {
  const { workspaceId } = useParams<{ workspaceId: Id<"workspaces"> }>();

  // a board is private to its creator and whoever joined via a share link, so
  // settle access before mounting the editor — everything under it (scene
  // sync, files, presence) is scoped to a workspace it may not read
  const workspace = useQuery(
    api.workspaces.get,
    workspaceId ? { workspaceId } : "skip",
  );

  if (!workspaceId) {
    return <Navigate to="/" replace />;
  }

  if (workspace === undefined) {
    return <div style={{ padding: "2rem" }}>Loading…</div>;
  }

  if (workspace === null) {
    return (
      <WorkspaceNotice
        title="You don't have access to this workspace"
        description="Workspaces are private to whoever created them. Ask the owner for a share link if you should be able to open this one."
      />
    );
  }

  // keyed on the workspace so switching boards tears the editor down and
  // rebuilds it: `initialData` is only read once at mount, and the sync/file
  // state below it lives in refs that would otherwise carry over
  return (
    <ExcalidrawAPIProvider key={workspaceId}>
      <ExcalidrawWrapper workspaceId={workspaceId} />
    </ExcalidrawAPIProvider>
  );
};

const Root = () => {
  return (
    <TopErrorBoundary>
      <Provider store={appJotaiStore}>
        <BrowserRouter>
          <Routes>
            <Route path="/sign-in" element={<AuthScreen />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <WorkspacePicker />
                </RequireAuth>
              }
            />
            <Route
              path="/board/:workspaceId"
              element={
                <RequireAuth>
                  <Board />
                </RequireAuth>
              }
            />
            <Route
              path="/join/:shareToken"
              element={
                <RequireAuth>
                  <JoinWorkspace />
                </RequireAuth>
              }
            />
          </Routes>
        </BrowserRouter>
      </Provider>
    </TopErrorBoundary>
  );
};

export default Root;
