import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";

import { api } from "../convex/_generated/api";

import { WorkspaceNotice } from "./WorkspaceNotice";

/**
 * Landing point for a share link. Following one is itself the intent to open
 * the board, so this joins and redirects without asking again — the only stop
 * is a link that no longer works.
 */
export const JoinWorkspace = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();
  const preview = useQuery(
    api.workspaces.previewShareToken,
    shareToken ? { shareToken } : "skip",
  );
  const join = useMutation(api.workspaces.joinByShareToken);

  // the mutation is fire-once: the query re-runs reactively (and `join` is a
  // new function reference on each render), which would otherwise re-enter
  const hasJoined = useRef(false);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    if (!shareToken || !preview || hasJoined.current) {
      return;
    }
    hasJoined.current = true;
    join({ shareToken }).then(
      (workspaceId) => navigate(`/board/${workspaceId}`, { replace: true }),
      // most likely revoked between the preview and the join, but whatever
      // went wrong, don't leave the spinner up forever
      () => setHasFailed(true),
    );
  }, [shareToken, preview, join, navigate]);

  if (!shareToken || preview === null || hasFailed) {
    return (
      <WorkspaceNotice
        title="This link no longer works"
        description="The share link was revoked, or the workspace it pointed at is gone. Ask whoever shared it for a new link."
      />
    );
  }

  return <div style={{ padding: "2rem" }}>Opening workspace…</div>;
};
