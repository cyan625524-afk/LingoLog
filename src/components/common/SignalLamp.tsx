import React from 'react';

export type LampStatus = 'green' | 'red' | 'amber' | 'off';

interface SignalLampProps {
  status: LampStatus;
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  pulsing?: boolean;
}

export const SignalLamp: React.FC<SignalLampProps> = ({
  status,
  label,
  className = '',
  size = 'md',
  pulsing = false,
}) => {
  const sizeClasses =
    size === 'sm' ? 'w-2.5 h-2.5' : size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';

  const lampClass =
    status === 'green'
      ? 'signal-lamp-green'
      : status === 'red'
      ? 'signal-lamp-red'
      : status === 'amber'
      ? 'signal-lamp-amber'
      : 'signal-lamp-off';

  return (
    <div className={`inline-flex items-center gap-1.5 select-none ${className}`}>
      <div
        className={`signal-lamp ${sizeClasses} ${lampClass} ${
          pulsing && status !== 'off' ? 'animate-pulse' : ''
        }`}
      />
      {label && (
        <span className="text-[10px] font-mono tracking-wider uppercase text-stone-600 dark:text-stone-300">
          {label}
        </span>
      )}
    </div>
  );
};
