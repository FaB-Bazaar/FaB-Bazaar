/**
 * Clipboard Utilities
 *
 * Provides cross-browser clipboard copy functionality with fallback support.
 * Uses modern Clipboard API when available, falls back to execCommand for older browsers.
 */

export interface ClipboardResult {
  success: boolean;
  error?: string;
}

/**
 * Copy text to clipboard with browser compatibility handling
 *
 * @param text - The text to copy to clipboard
 * @returns Promise with success status and optional error message
 *
 * @example
 * const result = await copyToClipboard("Hello World");
 * if (result.success) {
 *   console.log("Copied successfully!");
 * } else {
 *   console.error("Copy failed:", result.error);
 * }
 */
export async function copyToClipboard(text: string): Promise<ClipboardResult> {
  try {
    // Modern Clipboard API (preferred) - works in secure contexts (HTTPS)
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return { success: true };
    }

    // Fallback for older browsers or non-secure contexts (HTTP)
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Make textarea invisible and off-screen
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        return { success: true };
      } else {
        throw new Error('execCommand returned false');
      }
    } catch (err) {
      document.body.removeChild(textArea);
      throw err;
    }
  } catch (error) {
    console.error('Clipboard copy failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to copy to clipboard'
    };
  }
}
