import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { requireAccess } from "./access";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await authComponent.getAuthUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveFileRef = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    fileId: v.string(),
    storageId: v.id("_storage"),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAccess(ctx, args.workspaceId);

    const existing = await ctx.db
      .query("files")
      .withIndex("by_workspaceId_fileId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("fileId", args.fileId),
      )
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("files", {
      workspaceId: args.workspaceId,
      fileId: args.fileId,
      storageId: args.storageId,
      mimeType: args.mimeType,
      createdAt: Date.now(),
    });
  },
});

export const getFileUrls = query({
  args: {
    workspaceId: v.id("workspaces"),
    fileIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAccess(ctx, args.workspaceId);

    const results: Record<string, string | null> = {};
    for (const fileId of args.fileIds) {
      const file = await ctx.db
        .query("files")
        .withIndex("by_workspaceId_fileId", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("fileId", fileId),
        )
        .unique();
      results[fileId] = file ? await ctx.storage.getUrl(file.storageId) : null;
    }
    return results;
  },
});
