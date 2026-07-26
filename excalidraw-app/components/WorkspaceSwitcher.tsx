import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { TopCenterPanel } from "@excalidraw/excalidraw/index";
import { Island } from "@excalidraw/excalidraw/components/Island";
import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";
import clsx from "clsx";

import { api } from "../convex/_generated/api";

import "./WorkspaceSwitcher.scss";

import type { Id } from "../convex/_generated/dataModel";

const CaretIcon = () => (
  <svg viewBox="0 0 20 20" width="12" height="12" fill="none">
    <path
      d="M5 7.5L10 12.5L15 7.5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none">
    <path
      d="M10 4v12M4 10h12"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

const GridIcon = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none">
    <path
      d="M3.5 3.5h5v5h-5v-5zm8 0h5v5h-5v-5zm-8 8h5v5h-5v-5zm8 0h5v5h-5v-5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

const PencilIcon = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none">
    <path
      d="M13.5 3.5l3 3L7 16l-3.5.5.5-3.5 9.5-9.5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none">
    <path
      d="M4.5 6h11M8 6V4.5h4V6m-6 0l.75 9.5h6.5L14 6M8.5 8.5v5m3-5v5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LinkIcon = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none">
    <path
      d="M8.5 11.5l3-3M7 13l-1 1a2.5 2.5 0 01-3.5-3.5l2.5-2.5A2.5 2.5 0 018.5 8M13 7l1-1a2.5 2.5 0 013.5 3.5L15 12a2.5 2.5 0 01-3.5 0"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const WorkspaceSwitcher = ({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) => {
  const navigate = useNavigate();
  const workspaces = useQuery(api.workspaces.list);
  const createWorkspace = useMutation(api.workspaces.create);
  const renameWorkspace = useMutation(api.workspaces.rename);
  const shareWorkspace = useMutation(api.workspaces.share);
  const unshareWorkspace = useMutation(api.workspaces.unshare);
  const removeWorkspace = useMutation(api.workspaces.remove);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  // the name being typed for a new workspace; null while not creating
  const [draftName, setDraftName] = useState<string | null>(null);
  // the workspace being renamed, if any; `original` guards against committing
  // a no-op rename
  const [renaming, setRenaming] = useState<{
    id: Id<"workspaces">;
    name: string;
    original: string;
  } | null>(null);
  // the workspace whose share link is on screen, with the token the server
  // handed back — the link is only ever shown here, never in the board list
  const [sharing, setSharing] = useState<{
    id: Id<"workspaces">;
    name: string;
    shareToken: string;
  } | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  // the workspace awaiting a delete confirmation — deleting is permanent, so
  // the trash icon asks rather than acts
  const [deleting, setDeleting] = useState<{
    id: Id<"workspaces">;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // anything Escape should back out of before it closes the whole menu
  const isEditing =
    draftName !== null ||
    renaming !== null ||
    sharing !== null ||
    deleting !== null;

  const current = workspaces?.find(
    (workspace) => workspace._id === workspaceId,
  );

  const resetEditing = useCallback(() => {
    setDraftName(null);
    setRenaming(null);
    setSharing(null);
    setHasCopied(false);
    setDeleting(null);
  }, []);

  // focus & select the name as soon as an input is rendered, so the prefilled
  // default can be typed over
  const focusInput = useCallback((input: HTMLInputElement | null) => {
    input?.select();
  }, []);

  const handleRename = useCallback(async () => {
    if (!renaming) {
      return;
    }
    const { id, name, original } = renaming;
    setRenaming(null);
    // an unchanged or blank name is a no-op (the server keeps the old one)
    if (name.trim() && name.trim() !== original) {
      await renameWorkspace({ workspaceId: id, name });
    }
  }, [renaming, renameWorkspace]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        // clicking away commits an in-flight rename (the input's own blur
        // doesn't fire once the menu unmounts), but discards a pending create
        handleRename();
        setIsOpen(false);
        resetEditing();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // escape backs out of an in-progress edit first, then the menu
        if (isEditing) {
          resetEditing();
        } else {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, isEditing, resetEditing, handleRename]);

  const closeMenu = () => {
    setIsOpen(false);
    resetEditing();
  };

  const startCreating = () => {
    setRenaming(null);
    setSharing(null);
    setDeleting(null);
    setDraftName(`Untitled workspace ${(workspaces?.length ?? 0) + 1}`);
  };

  const handleDelete = async () => {
    if (!deleting || isDeleting) {
      return;
    }
    const { id } = deleting;
    setIsDeleting(true);
    try {
      await removeWorkspace({ workspaceId: id });
      // out to the picker either way — the board may have been the one we were
      // sitting on, and after deleting one you're picking where to go next
      closeMenu();
      navigate("/");
    } catch (error) {
      // leave the confirmation up so it can be retried rather than swallowing
      // the failure and looking like it worked
      console.error("Failed to delete workspace", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // minting is idempotent, so reopening the panel shows the same link rather
  // than invalidating the copy already handed out
  const startSharing = async (workspace: {
    _id: Id<"workspaces">;
    name: string;
  }) => {
    setDraftName(null);
    setRenaming(null);
    setDeleting(null);
    setHasCopied(false);
    const shareToken = await shareWorkspace({ workspaceId: workspace._id });
    setSharing({ id: workspace._id, name: workspace.name, shareToken });
  };

  const shareUrl = sharing
    ? `${window.location.origin}/join/${sharing.shareToken}`
    : "";

  const copyShareUrl = async () => {
    await copyTextToSystemClipboard(shareUrl);
    setHasCopied(true);
  };

  const stopSharing = async () => {
    if (!sharing) {
      return;
    }
    const { id } = sharing;
    resetEditing();
    await unshareWorkspace({ workspaceId: id });
  };

  const handleCreate = async () => {
    if (isCreating || draftName === null) {
      return;
    }
    setIsCreating(true);
    try {
      const newWorkspaceId = await createWorkspace({ name: draftName });
      closeMenu();
      navigate(`/board/${newWorkspaceId}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <TopCenterPanel>
      <div
        className="workspace-switcher"
        ref={containerRef}
        style={{ alignSelf: "center", height: "fit-content" }}
      >
        <Island padding={1}>
          <button
            type="button"
            className="workspace-switcher__trigger"
            onClick={() => (isOpen ? closeMenu() : setIsOpen(true))}
            aria-expanded={isOpen}
          >
            <span className="workspace-switcher__name">
              {current?.name ?? "Loading…"}
            </span>
            <CaretIcon />
          </button>
        </Island>
        {isOpen && (
          <div className="workspace-switcher__menu Island">
            <div className="workspace-switcher__list">
              {workspaces === undefined && (
                <div className="workspace-switcher__empty">Loading…</div>
              )}
              {workspaces?.map((workspace) =>
                renaming?.id === workspace._id ? (
                  <form
                    key={workspace._id}
                    className="workspace-switcher__form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleRename();
                    }}
                  >
                    <input
                      ref={focusInput}
                      className="workspace-switcher__input"
                      value={renaming.name}
                      onChange={(event) =>
                        setRenaming({
                          ...renaming,
                          name: event.target.value,
                        })
                      }
                      onBlur={handleRename}
                      aria-label="Workspace name"
                    />
                  </form>
                ) : (
                  <div
                    key={workspace._id}
                    className={clsx("workspace-switcher__row", {
                      "workspace-switcher__row--active":
                        workspace._id === workspaceId,
                    })}
                  >
                    <button
                      type="button"
                      className="workspace-switcher__item"
                      onClick={() => {
                        closeMenu();
                        if (workspace._id !== workspaceId) {
                          navigate(`/board/${workspace._id}`);
                        }
                      }}
                    >
                      {workspace.name}
                    </button>
                    {/* renaming and sharing are the owner's to do; a board you
                        joined via a link you can only open */}
                    {workspace.isOwner && (
                      <>
                        <button
                          type="button"
                          className="workspace-switcher__action"
                          title={
                            workspace.isShared
                              ? "Manage share link"
                              : "Share workspace"
                          }
                          aria-label={`Share ${workspace.name}`}
                          onClick={() => startSharing(workspace)}
                        >
                          <LinkIcon />
                        </button>
                        <button
                          type="button"
                          className="workspace-switcher__action"
                          title="Rename workspace"
                          aria-label={`Rename ${workspace.name}`}
                          onClick={() => {
                            setDraftName(null);
                            setSharing(null);
                            setDeleting(null);
                            setRenaming({
                              id: workspace._id,
                              name: workspace.name,
                              original: workspace.name,
                            });
                          }}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          className="workspace-switcher__action"
                          title="Delete workspace"
                          aria-label={`Delete ${workspace.name}`}
                          onClick={() => {
                            setDraftName(null);
                            setRenaming(null);
                            setSharing(null);
                            setDeleting({
                              id: workspace._id,
                              name: workspace.name,
                            });
                          }}
                        >
                          <TrashIcon />
                        </button>
                      </>
                    )}
                  </div>
                ),
              )}
            </div>
            <div className="workspace-switcher__separator" />
            {deleting ? (
              <div className="workspace-switcher__panel">
                <div className="workspace-switcher__panel-title">
                  Delete “{deleting.name}”?
                </div>
                <p className="workspace-switcher__hint">
                  This permanently deletes the workspace, everything drawn on
                  it, and everyone's access to it.
                </p>
                <div className="workspace-switcher__confirm-row">
                  <button
                    type="button"
                    className="workspace-switcher__cancel"
                    onClick={() => setDeleting(null)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="workspace-switcher__danger"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            ) : sharing ? (
              <div className="workspace-switcher__panel">
                <div className="workspace-switcher__panel-title">
                  Share “{sharing.name}”
                </div>
                <div className="workspace-switcher__form">
                  <input
                    readOnly
                    className="workspace-switcher__input"
                    value={shareUrl}
                    onFocus={(event) => event.target.select()}
                    aria-label="Share link"
                  />
                  <button
                    type="button"
                    className="workspace-switcher__confirm"
                    onClick={copyShareUrl}
                  >
                    {hasCopied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="workspace-switcher__hint">
                  Anyone with this link can sign in and edit this workspace.
                </p>
                <button
                  type="button"
                  className="workspace-switcher__create"
                  onClick={stopSharing}
                >
                  Stop sharing
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="workspace-switcher__create"
                  onClick={() => {
                    closeMenu();
                    navigate("/");
                  }}
                >
                  <GridIcon />
                  All workspaces
                </button>
                {draftName === null ? (
                  <button
                    type="button"
                    className="workspace-switcher__create"
                    onClick={startCreating}
                    disabled={isCreating}
                  >
                    <PlusIcon />
                    New workspace
                  </button>
                ) : (
                  <form
                    className="workspace-switcher__form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleCreate();
                    }}
                  >
                    <input
                      ref={focusInput}
                      className="workspace-switcher__input"
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      placeholder="Workspace name"
                      aria-label="New workspace name"
                      disabled={isCreating}
                    />
                    <button
                      type="submit"
                      className="workspace-switcher__confirm"
                      disabled={isCreating}
                    >
                      Create
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </TopCenterPanel>
  );
};
