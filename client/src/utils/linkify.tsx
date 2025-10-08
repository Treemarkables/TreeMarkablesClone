/**
 * Utility to convert URLs in text to clickable hyperlinks
 */

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

/**
 * Convert URLs in text to clickable links
 * @param text - The text containing URLs
 * @returns Array of React elements (text and links)
 */
export function linkify(text: string): (string | JSX.Element)[] {
  if (!text) return [text];

  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;

  // Reset regex lastIndex
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const url = match[0];
    const index = match.index;

    // Add text before the URL
    if (index > lastIndex) {
      parts.push(text.substring(lastIndex, index));
    }

    // Ensure URL has protocol
    const href = url.startsWith('http') ? url : `https://${url}`;

    // Add the clickable link
    parts.push(
      <a
        key={`link-${index}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );

    lastIndex = index + url.length;
  }

  // Add remaining text after last URL
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Component wrapper for linkified text that preserves whitespace
 */
export function LinkifiedText({ text, className = "" }: { text: string; className?: string }) {
  const parts = linkify(text);
  
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (typeof part === 'string') {
          // Preserve line breaks and whitespace
          return part.split('\n').map((line, lineIndex, array) => (
            <span key={`text-${index}-${lineIndex}`}>
              {line}
              {lineIndex < array.length - 1 && <br />}
            </span>
          ));
        }
        return part;
      })}
    </span>
  );
}
