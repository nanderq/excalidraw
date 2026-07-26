import { useMemo } from "react";
import { useConvex, useMutation } from "convex/react";
import { dataURLToFile, getDataURL } from "@excalidraw/excalidraw/data/blob";

import type { BinaryFileData } from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/element/types";

import { api } from "../convex/_generated/api";

import { FileManager } from "./FileManager";
import { FileStatusStore } from "./fileStatusStore";

import type { Id } from "../convex/_generated/dataModel";

export const useConvexFileManager = (workspaceId: Id<"workspaces">) => {
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveFileRef = useMutation(api.files.saveFileRef);

  return useMemo(
    () =>
      new FileManager({
        onFileStatusChange:
          FileStatusStore.updateStatuses.bind(FileStatusStore),
        getFiles: async (ids: FileId[]) => {
          const loadedFiles: BinaryFileData[] = [];
          const erroredFiles = new Map<FileId, true>();

          if (!ids.length) {
            return { loadedFiles, erroredFiles };
          }

          const urls = await convex.query(api.files.getFileUrls, {
            workspaceId,
            fileIds: ids,
          });

          await Promise.all(
            ids.map(async (id) => {
              const url = urls[id];
              if (!url) {
                erroredFiles.set(id, true);
                return;
              }
              try {
                const response = await fetch(url);
                const blob = await response.blob();
                const dataURL = await getDataURL(blob);
                loadedFiles.push({
                  id,
                  dataURL,
                  mimeType: blob.type as BinaryFileData["mimeType"],
                  created: Date.now(),
                });
              } catch (error) {
                console.error(error);
                erroredFiles.set(id, true);
              }
            }),
          );

          return { loadedFiles, erroredFiles };
        },
        saveFiles: async ({ addedFiles }) => {
          const savedFiles = new Map<FileId, BinaryFileData>();
          const erroredFiles = new Map<FileId, BinaryFileData>();

          await Promise.all(
            [...addedFiles].map(async ([id, fileData]) => {
              try {
                const uploadUrl = await generateUploadUrl({});
                const file = dataURLToFile(fileData.dataURL, id);
                const response = await fetch(uploadUrl, {
                  method: "POST",
                  headers: { "Content-Type": fileData.mimeType },
                  body: file,
                });
                const { storageId } = await response.json();
                await saveFileRef({
                  workspaceId,
                  fileId: id,
                  storageId,
                  mimeType: fileData.mimeType,
                });
                savedFiles.set(id, fileData);
              } catch (error) {
                console.error(error);
                erroredFiles.set(id, fileData);
              }
            }),
          );

          return { savedFiles, erroredFiles };
        },
      }),
    [convex, generateUploadUrl, saveFileRef, workspaceId],
  );
};
