import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";

import "../excalidraw-app/sentry";

import { authClient } from "./auth-client";
import Root from "./Root";

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
registerSW();

// NOT `{ expectAuth: true }` — with it, the socket stays permanently paused
// for unauthenticated visitors instead of opening unauthenticated as
// documented (https://github.com/get-convex/better-auth/issues/301), which
// silently breaks every useQuery on pages like /sign-in with no console error.
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

root.render(
  <StrictMode>
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <Root />
    </ConvexBetterAuthProvider>
  </StrictMode>,
);
