import { createAuthClient } from "better-auth/react";
import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";

import type { BetterAuthClientPlugin } from "better-auth";
import type { AuthClient } from "@convex-dev/better-auth/react";

// crossDomainClient()'s type doesn't line up with AuthClient across the
// current better-auth/@convex-dev/better-auth version pair (upstream bug:
// https://github.com/get-convex/better-auth/issues/195) — cast to unblock.
export const authClient: AuthClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
  plugins: [convexClient(), crossDomainClient() as BetterAuthClientPlugin],
});
