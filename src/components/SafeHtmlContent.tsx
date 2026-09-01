import { sanitizeHtml } from "@/lib/html-utils";

interface SafeHtmlContentProps {
  html: string;
  className?: string;
}

/**
 * Renders HTML content safely using sanitization to prevent XSS.
 * This component sanitizes the HTML before rendering it with dangerouslySetInnerHTML.
 */
export function SafeHtmlContent({ html, className = "" }: SafeHtmlContentProps) {
  const sanitized = sanitizeHtml(html);

  if (!sanitized) {
    return <div className={className} />;
  }

  return (
    <div
      className={`prose prose-sm max-w-none dark:prose-invert ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
