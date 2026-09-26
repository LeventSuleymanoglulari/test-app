import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { KeyVault } from "@oyun/library";

export class FileKeyVault implements KeyVault {
  #path: string;

  private constructor(path: string) {
    this.#path = path;
  }

  static async open(configPath: string): Promise<FileKeyVault> {
    await mkdir(dirname(configPath), { recursive: true });
    return new FileKeyVault(configPath);
  }

  async get(): Promise<string | null> {
    try {
      const raw = await readFile(this.#path, "utf8");
      const key = raw.trim();
      return key || null;
    } catch {
      return null;
    }
  }

  async set(key: string): Promise<void> {
    await mkdir(dirname(this.#path), { recursive: true });
    await writeFile(this.#path, key.trim(), { encoding: "utf8", mode: 0o600 });
  }

  async clear(): Promise<void> {
    await rm(this.#path, { force: true });
  }
}
