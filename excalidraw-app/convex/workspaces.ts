import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { lookupAccess, requireOwner } from "./access";

import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/** what the client needs to render a board: the token itself never goes out */
const summarize = (workspace: Doc<"workspaces">, isOwner: boolean) => ({
  _id: workspace._id,
  name: workspace.name,
  createdAt: workspace.createdAt,
  isOwner,
  isShared: workspace.shareToken !== undefined,
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);

    // newest first, by creation — a stable order, so the switcher doesn't
    // reshuffle while the active workspace's `lastActivityAt` ticks
    const owned = await ctx.db
      .query("workspaces")
      .withIndex("by_createdBy_createdAt", (q) => q.eq("createdBy", user._id))
      .order("desc")
      .collect();

    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_userId_joinedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    const joined = await Promise.all(
      memberships.map((membership) => ctx.db.get(membership.workspaceId)),
    );

    return [
      ...owned.map((workspace) => summarize(workspace, true)),
      // a workspace can go away while a stale membership row points at it
      ...joined.flatMap((workspace) =>
        workspace ? [summarize(workspace, false)] : [],
      ),
    ];
  },
});

/**
 * Whether the caller may open this board, and in what capacity — `null` when
 * they may not. Lets the editor route decide before it mounts anything that
 * would otherwise fail its own access check mid-render.
 */
export const get = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const access = await lookupAccess(ctx, args.workspaceId);

    return access ? summarize(access.workspace, access.isOwner) : null;
  },
});

const MAX_NAME_LENGTH = 100;

/** trims and caps a user-supplied workspace name; empty names fall back */
const normalizeName = (name: string, fallback: string) =>
  name.trim().slice(0, MAX_NAME_LENGTH) || fallback;

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const now = Date.now();

    const workspaceId = await ctx.db.insert("workspaces", {
      name: normalizeName(args.name, "Untitled workspace"),
      createdBy: user._id,
      createdAt: now,
      lastActivityAt: now,
    });

    await ctx.db.insert("scenes", {
      workspaceId,
      elements: "[]",
      appState: "{}",
      sceneVersion: 0,
      updatedAt: now,
      updatedBy: user._id,
    });

    return workspaceId;
  },
});

export const rename = mutation({
  args: { workspaceId: v.id("workspaces"), name: v.string() },
  handler: async (ctx, args) => {
    const { workspace } = await requireOwner(ctx, args.workspaceId);

    await ctx.db.patch(args.workspaceId, {
      name: normalizeName(args.name, workspace.name),
    });

    return null;
  },
});

/**
 * Tears down everything hanging off a workspace: its scene, its uploaded
 * images (both the rows and the blobs behind them), and the memberships that
 * shared it. Exported so the dashboard cleanup helper can't drift from what
 * the user-facing delete does.
 */
export const cascadeDeleteWorkspace = async (
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
) => {
  const scenes = await ctx.db
    .query("scenes")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const scene of scenes) {
    await ctx.db.delete(scene._id);
  }

  const files = await ctx.db
    .query("files")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const file of files) {
    // the blob too, or deleting a board would leave its images billable and
    // unreachable in storage
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(file._id);
  }

  const members = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const member of members) {
    await ctx.db.delete(member._id);
  }

  await ctx.db.delete(workspaceId);
};

/** Permanent, and the owner's call alone — a member can't delete out from under them. */
export const remove = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);

    await cascadeDeleteWorkspace(ctx, args.workspaceId);

    return null;
  },
});

// the link itself is the secret, so the token carries enough randomness that
// it can't be guessed: 20 bytes, hex-encoded
const SHARE_TOKEN_BYTES = 20;

const generateShareToken = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(SHARE_TOKEN_BYTES)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");

/**
 * Idempotent: an already-shared board keeps its token, so the owner can hand
 * out the same link twice without invalidating the first copy.
 */
export const share = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { workspace } = await requireOwner(ctx, args.workspaceId);

    if (workspace.shareToken) {
      return workspace.shareToken;
    }

    const shareToken = generateShareToken();
    await ctx.db.patch(args.workspaceId, { shareToken });

    return shareToken;
  },
});

/**
 * Stops the link from admitting anyone new. Members who already joined keep
 * their access — removing them is a separate, deliberate act.
 */
export const unshare = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);

    await ctx.db.patch(args.workspaceId, { shareToken: undefined });

    return null;
  },
});

const workspaceByShareToken = async (ctx: QueryCtx, shareToken: string) =>
  await ctx.db
    .query("workspaces")
    .withIndex("by_shareToken", (q) => q.eq("shareToken", shareToken))
    .unique();

/** name of the board a share link points at, so the invite can be previewed */
export const previewShareToken = query({
  args: { shareToken: v.string() },
  handler: async (ctx, args) => {
    await authComponent.getAuthUser(ctx);

    const workspace = await workspaceByShareToken(ctx, args.shareToken);

    return workspace ? { name: workspace.name } : null;
  },
});

export const joinByShareToken = mutation({
  args: { shareToken: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);

    const workspace = await workspaceByShareToken(ctx, args.shareToken);

    if (!workspace) {
      throw new Error("This share link is no longer valid");
    }

    // the owner following their own link, or a member re-following it, just
    // lands on the board
    const isMember =
      workspace.createdBy === user._id ||
      (await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspaceId_userId", (q) =>
          q.eq("workspaceId", workspace._id).eq("userId", user._id),
        )
        .unique()) !== null;

    if (!isMember) {
      await ctx.db.insert("workspaceMembers", {
        workspaceId: workspace._id,
        userId: user._id,
        joinedAt: Date.now(),
      });
    }

    return workspace._id;
  },
});
