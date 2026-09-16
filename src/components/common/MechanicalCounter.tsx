import React from 'react';

interface MechanicalCounterProps {
  value: number | string;
  label?: string;
  className?: string;
  digits?: number;
}

export const MechanicalCounter: React.FC<MechanicalCounterProps> = ({
  value,
  label,
  className = '',
  digits = 3,
}) => {
  const formattedVal =
    typeof value === 'number' ? String(value).padStart(digits, '0') : String(value);

  return (
    <div className={`inline-flex items-center gap-1.5 select-none ${className}`}>
      <div className="mechanical-counter-box text-xs font-mono font-bold">
        {formattedVal.split('').map((ch, idx) => (
          <span
            key={idx}
            className="inline-block px-1 border-r last:border-r-0 border-stone-700/80 bg-stone-900/90 text-amber-300"
          >
            {ch}
          </span>
        ))}
      </div>
      {label && (
        <span className="text-[10px] font-mono tracking-wider text-stone-500 dark:text-stone-400 uppercase">
          {label}
        </span>
      )}
    </div>
  );
};
