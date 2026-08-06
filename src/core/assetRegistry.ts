import type { AssetKey, SfxKey } from '../eras/types';

/**
 * Central registry for named assets (textures, models, audio). Content tasks
 * register era-specific assets here by key so the foundation can resolve them
 * without hard-coding paths.
 */
export class AssetRegistry {
  private textures = new Map<string, unknown>();
  private models = new Map<string, unknown>();
  private audio = new Map<string, unknown>();

  registerTexture(key: AssetKey, value: unknown): void {
    this.textures.set(key, value);
  }

  registerModel(key: AssetKey, value: unknown): void {
    this.models.set(key, value);
  }

  registerAudio(key: SfxKey, value: unknown): void {
    this.audio.set(key, value);
  }

  getTexture<T = unknown>(key: AssetKey): T | undefined {
    return this.textures.get(key) as T | undefined;
  }

  getModel<T = unknown>(key: AssetKey): T | undefined {
    return this.models.get(key) as T | undefined;
  }

  getAudio<T = unknown>(key: SfxKey): T | undefined {
    return this.audio.get(key) as T | undefined;
  }

  has(key: AssetKey): boolean {
    return this.textures.has(key) || this.models.has(key) || this.audio.has(key);
  }
}

/** The shared application asset registry instance. */
export const assetRegistry = new AssetRegistry();
