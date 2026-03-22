/**
 * Google Drive API service for the zLibraries knowledge library.
 * Uses the same service account as Vertex AI (Tensorax-Key.json).
 */

import { google } from "googleapis";
import { resolve } from "path";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

let _drive = null;

/** Lazily initialise and return an authenticated Drive client. */
async function getDrive() {
  if (_drive) return _drive;

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) throw new Error("GOOGLE_APPLICATION_CREDENTIALS not set.");

  const auth = new google.auth.GoogleAuth({
    keyFile: resolve(process.cwd(), keyPath),
    scopes: SCOPES,
  });

  _drive = google.drive({ version: "v3", auth });
  return _drive;
}

/**
 * List files/folders inside a given Drive folder.
 * @param {string} folderId - The Drive folder ID (defaults to env GOOGLE_DRIVE_FOLDER_ID)
 * @param {string} [mimeFilter] - Optional MIME type filter (e.g. "application/vnd.google-apps.folder")
 * @returns {Promise<Array<{id, name, mimeType, modifiedTime, size}>>}
 */
export async function listFiles(folderId, mimeFilter) {
  const drive = await getDrive();
  const id = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!id) throw new Error("No folder ID provided and GOOGLE_DRIVE_FOLDER_ID not set.");

  let q = `'${id}' in parents and trashed = false`;
  if (mimeFilter) q += ` and mimeType = '${mimeFilter}'`;

  const results = [];
  let pageToken = null;

  do {
    const res = await drive.files.list({
      q,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink)",
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      ...(pageToken && { pageToken }),
    });
    results.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return results;
}

/**
 * Get file metadata by ID.
 * @param {string} fileId
 */
export async function getFileMetadata(fileId) {
  const drive = await getDrive();
  const res = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, modifiedTime, size, webViewLink, parents",
    supportsAllDrives: true,
  });
  return res.data;
}

/**
 * Download file content. For Google Docs/Sheets/Slides, exports as the specified MIME type.
 * @param {string} fileId
 * @param {string} [exportMime] - e.g. "text/plain", "text/csv", "application/pdf"
 * @returns {Promise<string|Buffer>}
 */
export async function downloadFile(fileId, exportMime) {
  const drive = await getDrive();

  const meta = await drive.files.get({
    fileId,
    fields: "mimeType",
    supportsAllDrives: true,
  });

  const isGoogleDoc = meta.data.mimeType.startsWith("application/vnd.google-apps.");

  if (isGoogleDoc) {
    const mime = exportMime || "text/plain";
    const res = await drive.files.export({ fileId, mimeType: mime }, { responseType: "text" });
    return res.data;
  }

  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data);
}

/**
 * Upload a file to a Drive folder.
 * @param {string} name - File name
 * @param {Buffer|string} content - File content
 * @param {string} mimeType - e.g. "application/json", "text/plain"
 * @param {string} [folderId] - Destination folder (defaults to env GOOGLE_DRIVE_FOLDER_ID)
 * @returns {Promise<{id, name, webViewLink}>}
 */
export async function uploadFile(name, content, mimeType, folderId) {
  const drive = await getDrive();
  const parent = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!parent) throw new Error("No folder ID provided and GOOGLE_DRIVE_FOLDER_ID not set.");

  const { Readable } = await import("stream");
  const body = content instanceof Buffer
    ? Readable.from(content)
    : Readable.from(Buffer.from(content, "utf-8"));

  const res = await drive.files.create({
    requestBody: { name, parents: [parent], mimeType },
    media: { mimeType, body },
    fields: "id, name, webViewLink",
    supportsAllDrives: true,
  });

  return res.data;
}

/**
 * Create a subfolder inside a Drive folder.
 * @param {string} name - Folder name
 * @param {string} [parentId] - Parent folder (defaults to env GOOGLE_DRIVE_FOLDER_ID)
 * @returns {Promise<{id, name, webViewLink}>}
 */
export async function createFolder(name, parentId) {
  const drive = await getDrive();
  const parent = parentId || process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!parent) throw new Error("No folder ID provided and GOOGLE_DRIVE_FOLDER_ID not set.");

  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parent],
    },
    fields: "id, name, webViewLink",
    supportsAllDrives: true,
  });

  return res.data;
}
