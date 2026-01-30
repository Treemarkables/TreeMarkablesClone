/**
 * Utility to detect URLs in text and convert them to clickable links
 */

const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;

interface LinkifyProps {
  text: string;
  className?: string;
}

/**
 * Converts URLs in text to clickable links
 */
export function Linkify({ text, className = '' }: LinkifyProps) {
  if (!text) {
    return null;
  }

  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  // Reset the regex
  const regex = new RegExp(URL_REGEX);
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Get the matched URL
    let url = match[0];
    let displayUrl = url;

    // Add protocol if missing
    if (!url.match(/^https?:\/\//)) {
      url = 'http://' + url;
    }

    // Create clickable link
    parts.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline"
        onClick={(e) => e.stopPropagation()}
      >
        {displayUrl}
      </a>
    );

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return (
    <span className={className}>
      {parts.length > 0 ? parts : text}
    </span>
  );
}

/**
 * Converts URLs in multiline text to clickable links while preserving line breaks
 */
export function LinkifyMultiline({ text, className = '' }: LinkifyProps) {
  if (!text) {
    return null;
  }

  const lines = text.split('\n');

  return (
    <div className={className}>
      {lines.map((line, lineIndex) => (
        <div key={lineIndex} className="flex items-start gap-2">
          {line.trim() && <span className="text-muted-foreground flex-shrink-0">–</span>}
          <Linkify text={line} />
        </div>
      ))}
    </div>
  );
}
