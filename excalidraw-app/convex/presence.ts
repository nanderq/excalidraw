import { v } from "convex/values";
import { Presence } from "@convex-dev/presence";

import { mutation, query } from "./_generated/server";
import { components } from "./_generated/api";
import { authComponent } from "./auth";
import { requireAccess } from "./access";

import type { Id } from "./_generated/dataModel";

export const presence = new Presence(components.presence);

export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    // the room is the workspace, so joining one is the same permission as
    // opening the board — and you can only announce yourself as yourself
    const { user } = await requireAccess(ctx, roomId as Id<"workspaces">);

    if (userId !== user._id) {
      throw new Error("Cannot report presence for another user");
    }

    return await presence.heartbeat(ctx, roomId, userId, sessionId, interval);
  },
});

export const list = query({
  args: { roomToken: v.string() },
  handler: async (ctx, { roomToken }) => {
    const entries = await presence.list(ctx, roomToken);
    return await Promise.all(
      entries.map(async (entry) => {
        const user = await authComponent.getAnyUserById(ctx, entry.userId);
        return {
          ...entry,
          name: user?.name,
          image: user?.image ?? undefined,
        };
      }),
    );
  },
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    // Can't check auth here since it may be called over HTTP via sendBeacon.
    return await presence.disconnect(ctx, sessionToken);
  },
});
