import type { KeyVault } from "./types.ts";

export class MemoryKeyVault implements KeyVault {
  #key: string | null;

  constructor(initial: string | null = null) {
    this.#key = initial;
  }

  async get(): Promise<string | null> {
    return this.#key;
  }

  async set(key: string): Promise<void> {
    this.#key = key;
  }

  async clear(): Promise<void> {
    this.#key = null;
  }
}
