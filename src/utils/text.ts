/**
 * Converts a string to a URL-friendly slug.
 * Replaces spaces and special characters with hyphens, converts to lowercase.
 * @param text The input string.
 * @returns The slugified string.
 */
export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '') // Remove special characters
    .replace(/--+/g, '-'); // Replace multiple - with single -
}

/**
 * Truncates a string to a specified maximum length, appending an ellipsis if truncated.
 * @param text The input string.
 * @param maxLength The maximum length of the string (including the ellipsis).
 * @param ellipsis The string to append if truncated (defaults to '...').
 * @returns The truncated string.
 */
export function truncate(text: string, maxLength: number, ellipsis: string = '...'): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  if (maxLength <= ellipsis.length) {
    return ellipsis.substring(0, maxLength);
  }
  return text.substring(0, maxLength - ellipsis.length) + ellipsis;
}

export default {
  slugify,
  truncate,
}; 