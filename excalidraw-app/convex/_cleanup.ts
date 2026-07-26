import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { cascadeDeleteWorkspace } from "./workspaces";

// Maintenance helper, run from the Convex dashboard for orphans the owner
// can't reach. Internal rather than public: boards are private, so nothing
// unauthenticated should be able to delete one by id. The owner-facing path is
// `workspaces.remove`.
export const deleteWorkspace = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await cascadeDeleteWorkspace(ctx, args.workspaceId);

    return null;
  },
});
