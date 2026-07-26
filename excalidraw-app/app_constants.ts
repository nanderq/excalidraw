// should be aligned with MAX_ALLOWED_FILE_BYTES
export const FILE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024; // 4 MiB

export const STORAGE_KEYS = {
  LOCAL_STORAGE_THEME: "excalidraw-theme",
  LOCAL_STORAGE_DEBUG: "excalidraw-debug",

  IDB_LIBRARY: "excalidraw-library",
  IDB_TTD_CHATS: "excalidraw-ttd-chats",

  // do not use apart from migrations
  __LEGACY_LOCAL_STORAGE_LIBRARY: "excalidraw-library",
} as const;
