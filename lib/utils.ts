/**
 * Utility functions for UI components
 */

/**
 * Merge Tailwind classes with proper precedence
 * Simple implementation without external dependencies
 */
export function cn(...inputs: (string | undefined | null | boolean)[]) {
  return inputs.filter(Boolean).join(" ");
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

/**
 * Format duration in seconds to MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Debounce function for input handlers
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}

/**
 * Check if file is video
 */
export function isVideoFile(filename: string): boolean {
  const videoExtensions = ["mp4", "mov", "avi", "mkv", "webm", "flv"];
  const ext = getFileExtension(filename).toLowerCase();
  return videoExtensions.includes(ext);
}

/**
 * Check if file is audio
 */
export function isAudioFile(filename: string): boolean {
  const audioExtensions = ["mp3", "wav", "aac", "flac", "ogg", "m4a"];
  const ext = getFileExtension(filename).toLowerCase();
  return audioExtensions.includes(ext);
}

/**
 * Check if file is image
 */
export function isImageFile(filename: string): boolean {
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
  const ext = getFileExtension(filename).toLowerCase();
  return imageExtensions.includes(ext);
}

/**
 * Get asset type from filename
 */
export function getAssetType(
  filename: string
): "video" | "audio" | "image" | "unknown" {
  if (isVideoFile(filename)) return "video";
  if (isAudioFile(filename)) return "audio";
  if (isImageFile(filename)) return "image";
  return "unknown";
}
