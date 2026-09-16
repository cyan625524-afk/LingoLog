import React, { useState, useEffect } from 'react';
import { sound } from '../../utils/audio';

interface PocketWatchProps {
  className?: string;
  size?: number; // Outer diameter of the watch body in pixels
}

export const PocketWatch: React.FC<PocketWatchProps> = ({
  className = '',
  size = 96,
}) => {
  const [time, setTime] = useState<Date>(new Date());
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  // Angle calculations (in degrees)
  const secondDeg = seconds * 6;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const hourDeg = ((hours % 12) + minutes / 60 + seconds / 3600) * 30;

  // Format digital string
  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const dateString = `${time.getMonth() + 1}月${time.getDate()}日`;

  const romanNumerals = [
    { text: 'XII', angle: 0 },
    { text: 'I', angle: 30 },
    { text: 'II', angle: 60 },
    { text: 'III', angle: 90 },
    { text: 'IV', angle: 120 },
    { text: 'V', angle: 150 },
    { text: 'VI', angle: 180 },
    { text: 'VII', angle: 210 },
    { text: 'VIII', angle: 240 },
    { text: 'IX', angle: 270 },
    { text: 'X', angle: 300 },
    { text: 'XI', angle: 330 },
  ];

  const handleWatchClick = () => {
    sound.playKeyClick();
  };

  return (
    <div
      className={`relative inline-flex flex-col items-center select-none group cursor-pointer transition-transform duration-300 ${className}`}
      onClick={handleWatchClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`当前时间：${timeString} · 点击聆听复古机芯`}
    >
      {/* Curved Brass Chain draping out from the top bow */}
      <svg
        className="absolute -top-6 -left-8 w-20 h-10 pointer-events-none z-0 overflow-visible opacity-90"
        viewBox="0 0 80 40"
        fill="none"
      >
        <path
          d="M 52 24 C 40 8, 22 10, 8 26 C 2 32, -4 28, -6 34"
          stroke="url(#chainGradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="2.5 3.5"
          className="drop-shadow-xs"
        />
        <defs>
          <linearGradient id="chainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d9a536" />
            <stop offset="50%" stopColor="#f3ce7a" />
            <stop offset="100%" stopColor="#926919" />
          </linearGradient>
        </defs>
      </svg>

      {/* Top Pocket Watch Crown & Suspension Bow */}
      <div className="flex flex-col items-center -mb-2 z-10">
        {/* Arched Bow / Ring */}
        <div className="w-6 h-4.5 rounded-t-full border-[2.5px] border-[#d9a536] dark:border-[#b88924] shadow-xs -mb-1 bg-transparent" />
        {/* Knurled Winding Crown */}
        <div className="w-4 h-2.5 rounded-xs bg-linear-to-r from-[#b37e1b] via-[#f7d688] to-[#9c6a12] border border-[#7a520d] shadow-inner flex items-center justify-around px-0.5">
          <div className="w-[1px] h-full bg-[#694406]/60" />
          <div className="w-[1px] h-full bg-[#694406]/60" />
          <div className="w-[1px] h-full bg-[#694406]/60" />
        </div>
      </div>

      {/* Pocket Watch Main Bezel & Dial Body */}
      <div
        style={{ width: size, height: size }}
        className="relative rounded-full p-[5px] bg-linear-to-br from-[#f8d88e] via-[#caa042] to-[#6d4b0d] shadow-[0_10px_25px_rgba(30,22,10,0.35),inset_0_2px_4px_rgba(255,255,255,0.6)] border border-[#785312] z-10 transition-transform group-hover:scale-105"
      >
        {/* Coin-edge inner bezel ring */}
        <div className="w-full h-full rounded-full p-[2.5px] bg-linear-to-tr from-[#8a5f13] via-[#e5be65] to-[#fdedb5] shadow-inner flex items-center justify-center">
          {/* Dial Face */}
          <div className="relative w-full h-full rounded-full bg-[#faf6eb] dark:bg-[#20291a] shadow-[inset_0_2px_8px_rgba(0,0,0,0.25)] overflow-hidden flex items-center justify-center">
            {/* Fine Railtrack Minute Circle with SVG */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
              {/* Outer decorative track */}
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="currentColor"
                className="text-[#caa042]/40 dark:text-[#caa042]/20"
                strokeWidth="1"
              />
              <circle
                cx="50"
                cy="50"
                r="43"
                fill="none"
                stroke="currentColor"
                className="text-[#caa042]/40 dark:text-[#caa042]/20"
                strokeWidth="0.6"
              />

              {/* 60 Minute Tick Marks */}
              {[...Array(60)].map((_, i) => {
                const isMajor = i % 5 === 0;
                const rad = ((i * 6 - 90) * Math.PI) / 180;
                const rOuter = 46;
                const rInner = isMajor ? 40 : 43;
                const x1 = 50 + rOuter * Math.cos(rad);
                const y1 = 50 + rOuter * Math.sin(rad);
                const x2 = 50 + rInner * Math.cos(rad);
                const y2 = 50 + rInner * Math.sin(rad);

                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="currentColor"
                    className={
                      isMajor
                        ? 'text-stone-700 dark:text-stone-300'
                        : 'text-stone-400 dark:text-stone-600'
                    }
                    strokeWidth={isMajor ? '1.2' : '0.6'}
                  />
                );
              })}

              {/* Roman Numerals */}
              {romanNumerals.map(({ text, angle }) => {
                const rad = ((angle - 90) * Math.PI) / 180;
                const radius = 33;
                const x = 50 + radius * Math.cos(rad);
                const y = 50 + radius * Math.sin(rad);

                return (
                  <text
                    key={text}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="font-serif-display font-black fill-stone-800 dark:fill-stone-200 select-none text-[8.5px]"
                  >
                    {text}
                  </text>
                );
              })}

              {/* Brand mark */}
              <text
                x="50"
                y="26"
                textAnchor="middle"
                className="font-serif-display font-bold fill-[#8b6521] dark:fill-[#caa042] select-none text-[4.2px] tracking-[0.15em]"
              >
                LINGOLOG
              </text>
              <text
                x="50"
                y="30"
                textAnchor="middle"
                className="font-mono font-medium fill-stone-400 dark:fill-stone-500 select-none text-[3px] tracking-widest"
              >
                CHRONOMETER
              </text>

              {/* Small Date Window / Seconds Subdial */}
              <rect
                x="41"
                y="67"
                width="18"
                height="8"
                rx="2"
                fill="none"
                stroke="currentColor"
                className="text-[#caa042]/50"
                strokeWidth="0.6"
              />
              <text
                x="50"
                y="72.5"
                textAnchor="middle"
                className="font-mono font-bold fill-stone-700 dark:fill-stone-300 select-none text-[4.5px]"
              >
                {dateString}
              </text>
            </svg>

            {/* Hour Hand (Ornate Vintage Spade Shape) */}
            <div
              className="absolute w-full h-full pointer-events-none"
              style={{
                transform: `rotate(${hourDeg}deg)`,
                transformOrigin: '50% 50%',
              }}
            >
              <div className="absolute top-[28%] left-1/2 -translate-x-1/2 w-[3px] h-[22%] bg-stone-900 dark:bg-stone-100 rounded-t-full shadow-xs flex flex-col items-center">
                {/* Spade loop */}
                <div className="w-2 h-2 rounded-full border-[1.5px] border-stone-900 dark:border-stone-100 -mt-1 bg-transparent" />
              </div>
            </div>

            {/* Minute Hand (Slender Leaf/Spear Shape) */}
            <div
              className="absolute w-full h-full pointer-events-none"
              style={{
                transform: `rotate(${minuteDeg}deg)`,
                transformOrigin: '50% 50%',
              }}
            >
              <div className="absolute top-[16%] left-1/2 -translate-x-1/2 w-[2px] h-[34%] bg-stone-800 dark:bg-stone-200 rounded-t-full shadow-xs" />
            </div>

            {/* Second Hand (Wine-red Needle with Counterbalance) */}
            <div
              className="absolute w-full h-full pointer-events-none"
              style={{
                transform: `rotate(${secondDeg}deg)`,
                transformOrigin: '50% 50%',
              }}
            >
              {/* Needle pointer */}
              <div className="absolute top-[12%] left-1/2 -translate-x-1/2 w-[1px] h-[38%] bg-[#a33829] shadow-xs" />
              {/* Counterbalance tail */}
              <div className="absolute top-[50%] left-1/2 -translate-x-1/2 w-[1.5px] h-[12%] bg-[#a33829] flex flex-col items-center justify-end pb-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#a33829]" />
              </div>
            </div>

            {/* Center Cap & Pinion */}
            <div className="absolute w-3 h-3 rounded-full bg-linear-to-br from-[#f8d88e] to-[#785312] border border-[#523709] shadow-xs z-20 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-stone-950" />
            </div>

            {/* Curved Glass Highlight / Reflection Glare */}
            <div className="absolute -top-1/4 -left-1/4 w-3/2 h-3/2 rounded-full bg-linear-to-br from-white/35 via-white/5 to-transparent pointer-events-none z-30" />
          </div>
        </div>
      </div>

      {/* Digital Real-Time Tooltip Badge (Visible on hover or mobile glance) */}
      <div className="mt-1 px-2 py-0.5 rounded-full bg-stone-900/80 dark:bg-stone-800/90 text-amber-300 font-mono text-[10px] font-bold shadow-xs border border-amber-500/30 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
        <span>{timeString}</span>
      </div>
    </div>
  );
};
