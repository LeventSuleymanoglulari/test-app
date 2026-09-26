import { contextBridge, ipcRenderer } from "electron";
import type {
  ApplyCommand,
  ApplyOutcome,
  RawgOp,
  RawgResult,
  ShelfQuery,
  ShelfSnapshot,
} from "@oyun/library";

const api = {
  view(query: ShelfQuery): Promise<ShelfSnapshot> {
    return ipcRenderer.invoke("library:view", query);
  },
  apply(command: ApplyCommand): Promise<ApplyOutcome> {
    return ipcRenderer.invoke("library:apply", command);
  },
  rawg(op: RawgOp): Promise<RawgResult> {
    return ipcRenderer.invoke("library:rawg", op);
  },
  hasKey(): Promise<boolean> {
    return ipcRenderer.invoke("vault:get");
  },
  setKey(key: string): Promise<void> {
    return ipcRenderer.invoke("vault:set", key);
  },
  clearKey(): Promise<void> {
    return ipcRenderer.invoke("vault:clear");
  },
  openExternal(url: string): Promise<void> {
    return ipcRenderer.invoke("shell:openExternal", url);
  },
};

contextBridge.exposeInMainWorld("oyun", api);

export type OyunApi = typeof api;
