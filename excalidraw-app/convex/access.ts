import { authComponent } from "./auth";

import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// Every workspace-scoped function takes a `workspaceId` straight from the
// client, so each one has to establish for itself that the caller is allowed
// to touch that board. Access is either ownership (`workspaces.createdBy`) or
// a membership row minted by joining a share link.

type Access = {
  user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
  workspace: Doc<"workspaces">;
  isOwner: boolean;
};

export const lookupAccess = async (
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
): Promise<Access | null> => {
  const user = await authComponent.getAuthUser(ctx);
  const workspace = await ctx.db.get(workspaceId);

  if (!workspace) {
    return null;
  }

  if (workspace.createdBy === user._id) {
    return { user, workspace, isOwner: true };
  }

  const membership = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspaceId_userId", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", user._id),
    )
    .unique();

  return membership ? { user, workspace, isOwner: false } : null;
};

/**
 * A workspace nobody shared with you is indistinguishable from one that
 * doesn't exist, so ids can't be probed by guessing.
 */
export const requireAccess = async (
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
): Promise<Access> => {
  const access = await lookupAccess(ctx, workspaceId);

  if (!access) {
    throw new Error("Workspace not found");
  }

  return access;
};

/**
 * For the owner-only actions (renaming, minting and revoking share links). A
 * member already knows the board exists, so this can say what's wrong.
 */
export const requireOwner = async (
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
): Promise<Access> => {
  const access = await requireAccess(ctx, workspaceId);

  if (!access.isOwner) {
    throw new Error("Only the workspace owner can do that");
  }

  return access;
};
