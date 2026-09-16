import React from 'react';

export type StampVariant = 'urgent' | 'passed' | 'confirmed' | 'archived' | 'archive' | 'official' | 'gold' | 'custom';

interface TelegramStampProps {
  text: string;
  subtext?: string;
  variant?: StampVariant;
  className?: string;
  rotate?: number; // rotation in degrees
}

export const TelegramStamp: React.FC<TelegramStampProps> = ({
  text,
  subtext,
  variant = 'urgent',
  className = '',
  rotate = -3,
}) => {
  let colorClasses = 'text-[var(--tel-signal-red)] border-[var(--tel-signal-red)] bg-[var(--tel-signal-red-bg)]';

  if (variant === 'passed' || variant === 'confirmed' || variant === 'official') {
    colorClasses = 'text-[var(--tel-signal-green)] border-[var(--tel-signal-green)] bg-[var(--tel-signal-green-bg)]';
  } else if (variant === 'gold') {
    colorClasses = 'text-[var(--tel-brass-deep)] dark:text-[var(--tel-brass-gold)] border-[var(--tel-brass-gold)] bg-amber-500/10';
  } else if (variant === 'archived' || variant === 'archive') {
    colorClasses = 'text-stone-600 dark:text-stone-400 border-stone-500 bg-stone-500/10';
  }

  return (
    <div
      style={{ transform: `rotate(${rotate}deg)` }}
      className={`inline-flex flex-col items-center justify-center border-2 border-dashed px-2 py-0.5 rounded-sm font-telegram uppercase tracking-widest text-[10px] font-black select-none shadow-2xs ${colorClasses} ${className}`}
    >
      <span>{text}</span>
      {subtext && (
        <span className="text-[7.5px] tracking-normal font-mono opacity-80 border-t border-dashed border-current pt-0.5 mt-0.5">
          {subtext}
        </span>
      )}
    </div>
  );
};
