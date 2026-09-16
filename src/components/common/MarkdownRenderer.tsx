import React from 'react';
import Markdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  return (
    <div className={`prose-stone prose-sm dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed ${className}`}>
      <Markdown
        components={{
          strong: ({ children }) => (
            <strong className="font-bold text-stone-950 dark:text-stone-50 bg-amber-500/10 dark:bg-amber-400/15 px-1 py-0.5 rounded text-[1.02em]">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-stone-800 dark:text-stone-200">
              {children}
            </em>
          ),
          code: ({ children }) => (
            <code className="font-mono text-[11px] bg-stone-200/80 dark:bg-stone-800 text-[#4b5c3f] dark:text-[#a0b891] px-1.5 py-0.5 rounded">
              {children}
            </code>
          ),
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 leading-relaxed text-inherit">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-4 space-y-1 mb-2 last:mb-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-4 space-y-1 mb-2 last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">
              {children}
            </li>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};
