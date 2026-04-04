export interface StorageProvider {
  save(path: string, data: Blob | ArrayBuffer | string): Promise<string>;
  read(path: string): Promise<Blob>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  list(directory: string): Promise<StorageEntry[]>;
  getUrl(path: string): string;
  getSize(path: string): Promise<number>;
  copy(sourcePath: string, destPath: string): Promise<string>;
  move(sourcePath: string, destPath: string): Promise<string>;
}

export interface StorageEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  sizeBytes: number;
  modifiedAt: Date;
  mimeType?: string;
}

export interface StorageConfig {
  provider: 'local' | 'gcs' | 's3';
  basePath: string;
  maxFileSizeBytes: number;
  allowedMimeTypes?: string[];
}

export function createStorageConfig(overrides?: Partial<StorageConfig>): StorageConfig {
  return {
    provider: 'local',
    basePath: 'assets',
    maxFileSizeBytes: 100 * 1024 * 1024, // 100MB
    ...overrides,
  };
}
