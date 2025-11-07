/**
 * ChatKut Design System
 *
 * Inspired by Remotion's developer-focused aesthetic and AI SDK's chat patterns.
 *
 * Design Principles:
 * 1. Developer-first: Clean, functional, code-centric
 * 2. Dark mode native: Follow Remotion's dark aesthetic
 * 3. Minimal yet powerful: No unnecessary decoration
 * 4. Feedback-rich: Clear states for AI operations
 */

export const colors = {
  // Primary - Remotion blue inspired
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6', // Main Remotion-ish blue
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },

  // Neutral - Dark mode focused
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },

  // Accent colors
  success: {
    light: '#86efac',
    DEFAULT: '#22c55e',
    dark: '#16a34a',
  },
  warning: {
    light: '#fde047',
    DEFAULT: '#eab308',
    dark: '#ca8a04',
  },
  error: {
    light: '#fca5a5',
    DEFAULT: '#ef4444',
    dark: '#dc2626',
  },

  // AI-specific
  ai: {
    thinking: '#8b5cf6', // Purple for AI processing
    tool: '#f59e0b',     // Amber for tool calls
    user: '#3b82f6',     // Blue for user
    assistant: '#10b981', // Green for assistant
  },
} as const;

export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
} as const;

export const typography = {
  fonts: {
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace',
  },

  sizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
  },

  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  lineHeights: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
} as const;

export const borders = {
  radius: {
    none: '0',
    sm: '0.25rem',   // 4px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    full: '9999px',
  },

  width: {
    thin: '1px',
    medium: '2px',
    thick: '4px',
  },
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
} as const;

export const animations = {
  duration: {
    fast: '150ms',
    normal: '250ms',
    slow: '350ms',
  },

  easing: {
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

/**
 * Component-specific design tokens
 */
export const components = {
  button: {
    padding: {
      sm: `${spacing.xs} ${spacing.md}`,
      md: `${spacing.sm} ${spacing.lg}`,
      lg: `${spacing.md} ${spacing.xl}`,
    },
    fontSize: {
      sm: typography.sizes.sm,
      md: typography.sizes.base,
      lg: typography.sizes.lg,
    },
  },

  input: {
    padding: {
      sm: `${spacing.xs} ${spacing.sm}`,
      md: `${spacing.sm} ${spacing.md}`,
      lg: `${spacing.md} ${spacing.lg}`,
    },
    fontSize: {
      sm: typography.sizes.sm,
      md: typography.sizes.base,
      lg: typography.sizes.lg,
    },
  },

  card: {
    padding: spacing.lg,
    borderRadius: borders.radius.lg,
    shadow: shadows.md,
  },

  chat: {
    message: {
      user: {
        bg: 'bg-primary-500',
        text: 'text-white',
        align: 'ml-auto',
      },
      assistant: {
        bg: 'bg-neutral-800',
        text: 'text-neutral-100',
        align: 'mr-auto',
      },
      tool: {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/20',
      },
    },
    input: {
      height: 'min-h-[44px] max-h-[200px]',
      padding: spacing.md,
    },
  },
} as const;

/**
 * Layout constants
 */
export const layout = {
  container: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  sidebar: {
    width: '280px',
    collapsedWidth: '64px',
  },

  header: {
    height: '64px',
  },

  chat: {
    maxWidth: '800px',
    minHeight: '600px',
  },

  preview: {
    aspectRatio: '16/9',
  },
} as const;

/**
 * Z-index scale
 */
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  popover: 1300,
  tooltip: 1400,
  toast: 1500,
} as const;

/**
 * Utility: Get color with opacity
 */
export function colorWithOpacity(color: string, opacity: number): string {
  return `${color}/${Math.round(opacity * 100)}`;
}

/**
 * Utility: Generate transition string
 */
export function transition(
  property: string = 'all',
  duration: keyof typeof animations.duration = 'normal',
  easing: keyof typeof animations.easing = 'easeOut'
): string {
  return `${property} ${animations.duration[duration]} ${animations.easing[easing]}`;
}
