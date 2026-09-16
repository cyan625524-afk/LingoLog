import React from 'react';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Robust lightweight Markdown renderer for Knowledge Cards explanation & analysis.
 * Parses headers (###, ##, #), bold (**text** or __text__), list items (•, -, *), 
 * inline code (`code`), and paragraphs.
 */
export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Split content by newline to process blocks
  const lines = content.split('\n');

  const renderInlineFormatted = (text: string) => {
    // Regular expression matching bold (**text**), inline code (`text`), and italic (*text*)
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        const boldText = part.slice(2, -2);
        return (
          <strong
            key={index}
            className="font-bold text-stone-900 dark:text-amber-200 bg-amber-200/50 dark:bg-amber-900/40 px-1 py-0.5 rounded-xs"
          >
            {boldText}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        const codeText = part.slice(1, -1);
        return (
          <code
            key={index}
            className="font-mono text-[11px] bg-stone-200/80 dark:bg-stone-800 text-[#46553b] dark:text-[#a0b891] px-1 py-0.5 rounded-xs"
          >
            {codeText}
          </code>
        );
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

  return (
    <div className={`space-y-1.5 leading-relaxed ${className}`}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lineIdx} className="h-1" />;
        }

        // Header 3: ### Title
        if (trimmed.startsWith('### ')) {
          const headerText = trimmed.slice(4);
          return (
            <h4
              key={lineIdx}
              className="text-xs sm:text-sm font-bold font-serif-display text-amber-950 dark:text-amber-300 pt-1.5 pb-0.5 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#dfa938]" />
              <span>{renderInlineFormatted(headerText)}</span>
            </h4>
          );
        }

        // Header 2: ## Title
        if (trimmed.startsWith('## ')) {
          const headerText = trimmed.slice(3);
          return (
            <h3
              key={lineIdx}
              className="text-sm sm:text-base font-bold font-serif-display text-stone-900 dark:text-stone-100 pt-2 pb-0.5"
            >
              {renderInlineFormatted(headerText)}
            </h3>
          );
        }

        // Header 1: # Title
        if (trimmed.startsWith('# ')) {
          const headerText = trimmed.slice(2);
          return (
            <h2
              key={lineIdx}
              className="text-base font-bold font-serif-display text-stone-900 dark:text-stone-100 pt-2 pb-1"
            >
              {renderInlineFormatted(headerText)}
            </h2>
          );
        }

        // Bullet list item: • or - or *
        if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.slice(2);
          return (
            <div key={lineIdx} className="flex items-start gap-1.5 pl-1 text-xs">
              <span className="text-[#46553b] dark:text-[#a0b891] font-bold select-none mt-0.5">•</span>
              <div className="flex-1 text-stone-800 dark:text-stone-200">
                {renderInlineFormatted(itemText)}
              </div>
            </div>
          );
        }

        // Standard Paragraph
        return (
          <p key={lineIdx} className="text-xs text-stone-800 dark:text-stone-200">
            {renderInlineFormatted(line)}
          </p>
        );
      })}
    </div>
  );
};
