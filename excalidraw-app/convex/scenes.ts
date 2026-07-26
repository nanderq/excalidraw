import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireAccess } from "./access";

export const get = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireAccess(ctx, args.workspaceId);

    const scene = await ctx.db
      .query("scenes")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();

    if (!scene) {
      return null;
    }

    return {
      elements: JSON.parse(scene.elements),
      appState: JSON.parse(scene.appState),
      sceneVersion: scene.sceneVersion,
    };
  },
});

export const save = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    elements: v.string(),
    appState: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAccess(ctx, args.workspaceId);
    const now = Date.now();

    const existing = await ctx.db
      .query("scenes")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();

    const nextVersion = (existing?.sceneVersion ?? 0) + 1;

    if (existing) {
      await ctx.db.patch(existing._id, {
        elements: args.elements,
        appState: args.appState,
        sceneVersion: nextVersion,
        updatedAt: now,
        updatedBy: user._id,
      });
    } else {
      await ctx.db.insert("scenes", {
        workspaceId: args.workspaceId,
        elements: args.elements,
        appState: args.appState,
        sceneVersion: nextVersion,
        updatedAt: now,
        updatedBy: user._id,
      });
    }

    await ctx.db.patch(args.workspaceId, { lastActivityAt: now });

    return nextVersion;
  },
});
