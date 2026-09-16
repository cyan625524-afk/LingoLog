import React from 'react';

interface TeleprinterPaperCardProps {
  children: React.ReactNode;
  className?: string;
  dispatchId?: string;
  categoryName?: string;
  hasRedMargin?: boolean;
  hasTornBottom?: boolean;
  isUrgent?: boolean;
  dateStr?: string;
  onClick?: () => void;
}

export const TeleprinterPaperCard: React.FC<TeleprinterPaperCardProps> = ({
  children,
  className = '',
  dispatchId,
  categoryName,
  hasRedMargin = true,
  hasTornBottom = false,
  isUrgent = false,
  dateStr,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`relative bg-[var(--tel-paper-card)] dark:bg-[var(--tel-paper-card)] border-2 border-[var(--tel-paper-border)] dark:border-[var(--tel-paper-border)] rounded-2xl p-4 sm:p-5 shadow-[0_4px_16px_rgba(15,36,25,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-all ${
        hasTornBottom ? 'torn-paper-bottom pb-6' : ''
      } ${onClick ? 'cursor-pointer hover:border-[var(--tel-green-600)] hover:shadow-md' : ''} ${className}`}
    >
      {/* Red Telegram Margin Wire Line */}
      {hasRedMargin && (
        <div className="absolute top-0 bottom-0 left-4 sm:left-6 w-0.5 bg-[var(--tel-paper-margin)] pointer-events-none opacity-60" />
      )}

      {/* Top Telegram Header Bar if dispatchId or categoryName is provided */}
      {(dispatchId || categoryName || dateStr) && (
        <div className="flex items-center justify-between border-b border-dashed border-[var(--tel-paper-border-dark)]/40 pb-2 mb-3 text-[10px] font-mono select-none">
          <div className="flex items-center gap-2">
            {dispatchId && (
              <span className="font-bold tracking-wider text-[var(--tel-green-800)] dark:text-[var(--tel-green-200)]">
                {dispatchId}
              </span>
            )}
            {categoryName && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--tel-paper-aged)] dark:bg-[var(--tel-paper-buff)] text-stone-700 dark:text-stone-300 font-serif-display font-medium">
                {categoryName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
            {isUrgent && (
              <span className="stamp-badge stamp-badge-red text-[8px] py-0 px-1">
                URGENT
              </span>
            )}
            {dateStr && <span>{dateStr}</span>}
          </div>
        </div>
      )}

      <div className={hasRedMargin ? 'pl-3 sm:pl-4' : ''}>{children}</div>
    </div>
  );
};
