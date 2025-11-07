/**
 * Utility functions for composition engine
 */

/**
 * Generate a unique element ID
 */
export function generateElementId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Format frame count to timecode (HH:MM:SS:FF)
 */
export function framesToTimecode(frames: number, fps: number): string {
  const totalSeconds = frames / fps;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const remainingFrames = frames % fps;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${remainingFrames.toString().padStart(2, "0")}`;
}

/**
 * Parse timecode to frame count
 */
export function timecodeToFrames(timecode: string, fps: number): number {
  const parts = timecode.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid timecode format. Expected HH:MM:SS:FF");
  }

  const [hours, minutes, seconds, frames] = parts.map((p) => parseInt(p, 10));
  return (hours * 3600 + minutes * 60 + seconds) * fps + frames;
}

/**
 * Check if two elements overlap in time
 */
export function elementsOverlap(
  el1: { from: number; durationInFrames: number },
  el2: { from: number; durationInFrames: number }
): boolean {
  const el1End = el1.from + el1.durationInFrames;
  const el2End = el2.from + el2.durationInFrames;

  return el1.from < el2End && el2.from < el1End;
}

/**
 * Get element end frame
 */
export function getElementEndFrame(element: {
  from: number;
  durationInFrames: number;
}): number {
  return element.from + element.durationInFrames;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Ease-in-out interpolation
 */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Calculate easing value
 */
export function applyEasing(
  t: number,
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out"
): number {
  if (!easing || easing === "linear") return t;

  switch (easing) {
    case "ease-in":
      return t * t;
    case "ease-out":
      return t * (2 - t);
    case "ease-in-out":
      return easeInOut(t);
    default:
      return t;
  }
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Debounce a function
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

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
