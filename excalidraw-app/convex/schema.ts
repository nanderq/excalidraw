import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
    lastActivityAt: v.number(),
    // set while the owner has an active share link, cleared on revoke. Holding
    // the token is what lets someone join — see workspaces.joinByShareToken
    shareToken: v.optional(v.string()),
  })
    .index("by_lastActivityAt", ["lastActivityAt"])
    // listing is ordered by creation, not activity — `lastActivityAt` changes
    // on every scene save, which would reshuffle the switcher as you draw
    .index("by_createdBy_createdAt", ["createdBy", "createdAt"])
    .index("by_shareToken", ["shareToken"]),

  // rows exist only for users invited via a share link; the creator's access
  // comes from `workspaces.createdBy`, so boards created before sharing
  // existed need no backfill
  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.string(),
    joinedAt: v.number(),
  })
    .index("by_userId_joinedAt", ["userId", "joinedAt"])
    .index("by_workspaceId_userId", ["workspaceId", "userId"])
    .index("by_workspaceId", ["workspaceId"]),

  scenes: defineTable({
    workspaceId: v.id("workspaces"),
    elements: v.string(),
    appState: v.string(),
    sceneVersion: v.number(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }).index("by_workspaceId", ["workspaceId"]),

  files: defineTable({
    workspaceId: v.id("workspaces"),
    fileId: v.string(),
    storageId: v.id("_storage"),
    mimeType: v.string(),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_fileId", ["workspaceId", "fileId"]),
});
