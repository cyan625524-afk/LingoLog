import React from 'react';

interface PerforatedDividerProps {
  className?: string;
  label?: string;
}

export const PerforatedDivider: React.FC<PerforatedDividerProps> = ({
  className = '',
  label,
}) => {
  return (
    <div className={`w-full flex items-center justify-center my-3 select-none ${className}`}>
      <div className="w-full punch-tape-strip flex items-center justify-center relative">
        {label && (
          <span className="bg-[var(--tel-paper-card)] dark:bg-[var(--tel-paper-card)] px-2 py-0.5 rounded text-[9px] font-mono tracking-widest text-stone-500 dark:text-stone-400 uppercase border border-[var(--tel-paper-border)]">
            {label}
          </span>
        )}
      </div>
    </div>
  );
};
