import DOMPurify from "dompurify";

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Uses DOMPurify to strip potentially dangerous tags and attributes.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "a",
      "span",
      "div",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "style", "class"],
    KEEP_CONTENT: true,
  });
}

/**
 * Renders sanitized HTML as a React-compatible string.
 * Always sanitize before using with dangerouslySetInnerHTML.
 */
export function renderSafeHtml(html: string): string {
  return sanitizeHtml(html);
}
