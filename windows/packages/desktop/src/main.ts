import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Library,
  LibraryFileError,
  type ApplyCommand,
  type RawgOp,
  type ShelfQuery,
} from "@oyun/library";
import { FileKeyVault } from "./vault-file.ts";

const here = dirname(fileURLToPath(import.meta.url));

let library: Library;
let keyVault: FileKeyVault;

function libraryPath(): string {
  return (
    process.env.OYUN_LIBRARY_PATH ??
    join(app.getPath("documents"), "Oyun Kütüphanesi", "library.json")
  );
}

function keyPath(): string {
  return join(app.getPath("userData"), "oyun-kutuphanesi", "rawg.key");
}

async function createWindow(): Promise<void> {
  keyVault = await FileKeyVault.open(keyPath());
  try {
    library = await Library.open({ path: libraryPath(), keyVault });
  } catch (err) {
    if (err instanceof LibraryFileError) {
      dialog.showErrorBox("Oyun Kütüphanesi", err.message);
      app.quit();
      return;
    }
    throw err;
  }

  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    title: "Oyun Kütüphanesi",
    webPreferences: {
      preload: join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadFile(join(here, "renderer", "index.html"));

  const shot = process.env.OYUN_SHOT;
  if (shot) {
    await mainWindow.webContents.executeJavaScript(
      `new Promise((resolve) => {
        const started = Date.now();
        const tick = () => {
          const row = document.querySelector("[data-select]");
          if (row) {
            row.click();
            setTimeout(() => {
              document.querySelector('[data-shelf="library"]')?.click();
              setTimeout(resolve, 200);
            }, 200);
            return;
          }
          if (Date.now() - started > 4000) resolve(true);
          else setTimeout(tick, 50);
        };
        tick();
      })`,
    );
    const image = await mainWindow.webContents.capturePage();
    writeFileSync(shot, image.toPNG());
    app.quit();
  }
}

function registerIpc(): void {
  ipcMain.handle("library:view", (_e, query: ShelfQuery) => library.view(query));
  ipcMain.handle("library:apply", (_e, command: ApplyCommand) =>
    library.apply(command),
  );
  ipcMain.handle("library:rawg", (_e, op: RawgOp) => library.rawg(op));
  ipcMain.handle("vault:get", async () => ((await keyVault.get()) ? true : false));
  ipcMain.handle("vault:set", async (_e, key: string) => {
    await keyVault.set(key);
  });
  ipcMain.handle("vault:clear", async () => {
    await keyVault.clear();
  });
  ipcMain.handle("shell:openExternal", async (_e, url: string) => {
    try {
      const parsed = new URL(url);
      if (
        parsed.protocol === "https:" &&
        parsed.hostname === "rawg.io" &&
        !parsed.username &&
        !parsed.password &&
        parsed.port === "" &&
        parsed.search === "" &&
        parsed.hash === ""
      ) {
        await shell.openExternal(url);
      }
    } catch {
      return;
    }
  });
}

app.whenReady().then(async () => {
  registerIpc();
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
