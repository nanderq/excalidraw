import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";

import type { AuthConfig } from "convex/server";

const authConfig: AuthConfig = {
  providers: [getAuthConfigProvider()],
};

export default authConfig;
