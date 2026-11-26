/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class VideoStorage {
  /**
   * Session-only stub (No persistent storage in IndexedDB)
   */
  public static async saveVideoBlob(key: string, blob: Blob, name: string): Promise<boolean> {
    return true;
  }

  /**
   * Session-only stub (No persistent storage loading)
   */
  public static async loadVideoBlob(key: string): Promise<{ blob: Blob; name: string } | null> {
    return null;
  }

  /**
   * Inspect video duration, width, height using temporary video element (Transient memory only)
   */
  public static inspectVideoMetadata(videoSource: string | Blob): Promise<{ duration: number; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const vid = document.createElement('video');
      vid.preload = 'metadata';
      vid.playsInline = true;
      vid.muted = true;

      let blobUrl = '';
      if (typeof videoSource === 'string') {
        vid.src = videoSource;
      } else {
        blobUrl = URL.createObjectURL(videoSource);
        vid.src = blobUrl;
      }

      const cleanup = () => {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        vid.removeAttribute('src');
        vid.load();
      };

      const timer = setTimeout(() => {
        cleanup();
        resolve({ duration: 10, width: 1280, height: 720 });
      }, 4000);

      vid.onloadedmetadata = () => {
        clearTimeout(timer);
        const dur = vid.duration && !isNaN(vid.duration) && isFinite(vid.duration) ? vid.duration : 10;
        const w = vid.videoWidth || 1280;
        const h = vid.videoHeight || 720;
        cleanup();
        resolve({ duration: dur, width: w, height: h });
      };

      vid.onerror = () => {
        clearTimeout(timer);
        cleanup();
        resolve({ duration: 10, width: 1280, height: 720 });
      };
    });
  }
}
