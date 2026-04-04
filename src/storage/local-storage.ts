import type { StorageProvider, StorageEntry, StorageConfig } from './storage-provider';

/**
 * Response shape from POST /api/db/projects/:id/upload
 */
interface UploadResponse {
  uploaded: number;
  files: Array<{ name: string; path: string; size: number }>;
}

/**
 * Response shape from GET /api/db/projects/:id/all-files
 */
interface AllFilesResponse {
  projectDir: string;
  files: Array<{
    name: string;
    folder: string;
    path: string;
    size: number;
    modified: string;
    url: string;
  }>;
}

/**
 * Browser-side storage provider that delegates all file operations
 * to the Express backend at /api/db/projects/:id/...
 *
 * Path convention: every path starts with "{projectId}/rest/of/path".
 * The projectId is extracted and used in the API URL; the remainder
 * becomes the subfolder + filename on the server side.
 */
export class LocalStorageProvider implements StorageProvider {
  private config: StorageConfig;
  private baseUrl: string;

  constructor(config: StorageConfig) {
    this.config = config;
    this.baseUrl = '/api/db';
  }

  async save(path: string, data: Blob | ArrayBuffer | string): Promise<string> {
    const { projectId, filePath } = this.parsePath(path);

    // Separate directory (subfolder) from filename
    const lastSlash = filePath.lastIndexOf('/');
    const subfolder = lastSlash >= 0 ? filePath.substring(0, lastSlash) : 'uploads';
    const filename = lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;

    // Convert data to a Blob if needed
    let blob: Blob;
    if (typeof data === 'string') {
      blob = new Blob([data], { type: 'text/plain' });
    } else if (data instanceof ArrayBuffer) {
      blob = new Blob([data]);
    } else {
      blob = data;
    }

    // Enforce max file size
    if (blob.size > this.config.maxFileSizeBytes) {
      throw new Error(
        `File exceeds maximum size of ${this.config.maxFileSizeBytes} bytes (got ${blob.size})`
      );
    }

    // Build multipart form
    const formData = new FormData();
    formData.append('subfolder', subfolder);
    formData.append('files', blob, filename);

    const response = await fetch(
      `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/upload`,
      { method: 'POST', body: formData }
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Upload failed (${response.status}): ${errBody}`);
    }

    const result: UploadResponse = await response.json();
    if (result.uploaded === 0) {
      throw new Error('Upload returned 0 files saved');
    }

    return path;
  }

  async read(path: string): Promise<Blob> {
    const { projectId, filePath } = this.parsePath(path);
    const url = `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/serve-file/${encodeURIComponent(filePath)}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Read failed (${response.status}): ${path}`);
    }

    return response.blob();
  }

  async delete(path: string): Promise<void> {
    // The Express backend does not expose a dedicated delete-file endpoint.
    // We send a DELETE to a conventional path; if the server returns 404
    // (endpoint not implemented) we throw a clear error so callers know
    // server-side support is required.
    const { projectId, filePath } = this.parsePath(path);
    const url = `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(filePath)}`;

    const response = await fetch(url, { method: 'DELETE' });

    if (response.status === 404) {
      throw new Error(
        'Delete not supported: the server does not expose a file-delete endpoint yet. ' +
        `Attempted DELETE ${url}`
      );
    }

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Delete failed (${response.status}): ${errBody}`);
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      const { projectId, filePath } = this.parsePath(path);
      const url = `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/serve-file/${encodeURIComponent(filePath)}`;

      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  async list(directory: string): Promise<StorageEntry[]> {
    const { projectId, filePath: dirPrefix } = this.parsePath(directory);
    const url = `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/all-files`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`List failed (${response.status}): ${directory}`);
    }

    const result: AllFilesResponse = await response.json();

    // Filter to entries within the requested directory
    const normalizedPrefix = dirPrefix ? dirPrefix.replace(/\/$/, '') : '';

    return result.files
      .filter((f) => {
        const entryPath = f.folder ? `${f.folder}/${f.name}` : f.name;
        if (!normalizedPrefix) return true;
        return entryPath.startsWith(normalizedPrefix);
      })
      .map((f): StorageEntry => {
        const entryPath = f.folder ? `${f.folder}/${f.name}` : f.name;
        return {
          path: `${projectId}/${entryPath}`,
          name: f.name,
          isDirectory: false, // The all-files endpoint only returns files
          sizeBytes: f.size,
          modifiedAt: f.modified ? new Date(f.modified) : new Date(),
          mimeType: guessMimeType(f.name),
        };
      });
  }

  getUrl(path: string): string {
    const { projectId, filePath } = this.parsePath(path);
    return `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/serve-file/${encodeURIComponent(filePath)}`;
  }

  async getSize(path: string): Promise<number> {
    const blob = await this.read(path);
    return blob.size;
  }

  async copy(sourcePath: string, destPath: string): Promise<string> {
    const data = await this.read(sourcePath);
    return this.save(destPath, data);
  }

  async move(sourcePath: string, destPath: string): Promise<string> {
    const result = await this.copy(sourcePath, destPath);
    await this.delete(sourcePath);
    return result;
  }

  private parsePath(path: string): { projectId: string; filePath: string } {
    const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
    const slashIndex = normalized.indexOf('/');
    if (slashIndex < 0) {
      return { projectId: normalized, filePath: '' };
    }
    return {
      projectId: normalized.substring(0, slashIndex),
      filePath: normalized.substring(slashIndex + 1),
    };
  }
}

/**
 * Simple extension-based MIME type lookup for common media files.
 */
function guessMimeType(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    pdf: 'application/pdf',
    json: 'application/json',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return ext ? mimeMap[ext] : undefined;
}
