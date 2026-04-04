export interface ThumbnailOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number; // 0-1
  format: 'image/jpeg' | 'image/png' | 'image/webp';
}

const DEFAULT_OPTIONS: ThumbnailOptions = {
  maxWidth: 200,
  maxHeight: 200,
  quality: 0.7,
  format: 'image/jpeg',
};

/**
 * Generate a thumbnail from an image Blob using the browser Canvas API.
 */
export async function generateImageThumbnail(
  imageBlob: Blob,
  options?: Partial<ThumbnailOptions>
): Promise<Blob> {
  const opts: ThumbnailOptions = { ...DEFAULT_OPTIONS, ...options };

  const imageBitmap = await createImageBitmap(imageBlob);

  const { width, height } = calculateDimensions(
    imageBitmap.width,
    imageBitmap.height,
    opts.maxWidth,
    opts.maxHeight
  );

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context from OffscreenCanvas');
  }

  ctx.drawImage(imageBitmap, 0, 0, width, height);
  imageBitmap.close();

  const blob = await canvas.convertToBlob({
    type: opts.format,
    quality: opts.quality,
  });

  return blob;
}

/**
 * Generate a thumbnail from a video URL by seeking to 1 second
 * and capturing a frame via a canvas.
 */
export async function generateVideoThumbnail(
  videoUrl: string,
  options?: Partial<ThumbnailOptions>
): Promise<Blob> {
  const opts: ThumbnailOptions = { ...DEFAULT_OPTIONS, ...options };

  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.preload = 'auto';

  const frameBlob = await new Promise<Blob>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.removeEventListener('loadeddata', onLoaded);
      video.src = '';
      video.load(); // release resources
    };

    const onError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Failed to load video: ${videoUrl}`));
    };

    const onSeeked = () => {
      if (settled) return;
      settled = true;

      const { width, height } = calculateDimensions(
        video.videoWidth,
        video.videoHeight,
        opts.maxWidth,
        opts.maxHeight
      );

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        cleanup();
        reject(new Error('Failed to get 2D context from canvas'));
        return;
      }

      ctx.drawImage(video, 0, 0, width, height);
      cleanup();

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob returned null'));
          }
        },
        opts.format,
        opts.quality
      );
    };

    const onLoaded = () => {
      // Seek to 1 second, or 0 if the video is shorter
      video.currentTime = Math.min(1, video.duration || 0);
    };

    video.addEventListener('loadeddata', onLoaded);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    video.src = videoUrl;
  });

  return frameBlob;
}

/**
 * Generate a thumbnail from any supported media Blob.
 * Dispatches to the image or video generator based on the provided mimeType.
 */
export async function generateThumbnail(
  blob: Blob,
  mimeType: string,
  options?: Partial<ThumbnailOptions>
): Promise<Blob> {
  if (mimeType.startsWith('image/')) {
    return generateImageThumbnail(blob, options);
  }

  if (mimeType.startsWith('video/')) {
    // Video requires a URL — create a temporary object URL
    const url = URL.createObjectURL(blob);
    try {
      return await generateVideoThumbnail(url, options);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  throw new Error(`Unsupported media type for thumbnail generation: ${mimeType}`);
}

/**
 * Convert a Blob to a data URL string (e.g. "data:image/jpeg;base64,...").
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader did not return a string'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Calculate scaled dimensions that fit within maxWidth x maxHeight
 * while preserving the original aspect ratio.
 */
function calculateDimensions(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (srcWidth <= maxWidth && srcHeight <= maxHeight) {
    return { width: srcWidth, height: srcHeight };
  }

  const widthRatio = maxWidth / srcWidth;
  const heightRatio = maxHeight / srcHeight;
  const scale = Math.min(widthRatio, heightRatio);

  return {
    width: Math.round(srcWidth * scale),
    height: Math.round(srcHeight * scale),
  };
}
