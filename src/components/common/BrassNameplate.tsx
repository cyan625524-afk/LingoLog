import React from 'react';

interface BrassNameplateProps {
  title: string;
  subtitle?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BrassNameplate: React.FC<BrassNameplateProps> = ({
  title,
  subtitle,
  className = '',
  size = 'md',
}) => {
  const padClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : size === 'lg' ? 'px-4 py-2 text-sm' : 'px-3 py-1 text-xs';

  return (
    <div
      className={`relative inline-flex items-center justify-between gap-2.5 brass-plate rounded-sm select-none ${padClass} ${className}`}
    >
      {/* Left Screw Rivet */}
      <div className="brass-rivet shrink-0" />

      {/* Plate Content */}
      <div className="flex flex-col items-center justify-center text-center">
        <span className="font-bold tracking-wider uppercase font-serif-display text-[#1c1404]">
          {title}
        </span>
        {subtitle && (
          <span className="text-[8px] font-mono tracking-widest text-[#4d360a] uppercase">
            {subtitle}
          </span>
        )}
      </div>

      {/* Right Screw Rivet */}
      <div className="brass-rivet shrink-0" />
    </div>
  );
};
