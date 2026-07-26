import { useEffect } from "react";
import usePresence from "@convex-dev/presence/react";

import type { Collaborator, SocketId } from "@excalidraw/excalidraw/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { authClient } from "../auth-client";
import { api } from "../convex/_generated/api";

import type { Id } from "../convex/_generated/dataModel";

// Presence identity/facepile only — cursor coordinates are deferred to a
// future iteration, so we deliberately never populate `pointer`/`button`/
// `selectedElementIds`, which is what the existing cursor-rendering code
// keys off of to draw anything.
export const usePresenceCollaborators = ({
  workspaceId,
  excalidrawAPI,
}: {
  workspaceId: Id<"workspaces">;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  // authClient's inferred `useSession` return type collapses to `never` due
  // to the same AuthClient union-typing bug worked around in auth-client.ts
  // (https://github.com/get-convex/better-auth/issues/195).
  const { data: session } = authClient.useSession() as {
    data: { user: { id: string } } | null;
  };
  const userId = session?.user.id ?? "";

  const presenceState = usePresence(api.presence, workspaceId, userId);

  useEffect(() => {
    if (!excalidrawAPI || !userId) {
      return;
    }

    const collaborators = new Map<SocketId, Collaborator>();

    for (const entry of presenceState ?? []) {
      if (!entry.online) {
        continue;
      }
      const isCurrentUser = entry.userId === userId;
      collaborators.set(entry.userId as SocketId, {
        id: entry.userId,
        username: entry.name ?? entry.userId,
        avatarUrl: entry.image,
        isCurrentUser,
      });
    }

    excalidrawAPI.updateScene({ collaborators });
  }, [excalidrawAPI, presenceState, userId]);
};
