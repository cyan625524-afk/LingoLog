import React from 'react';
import { Keyboard, FileText, BookOpen, BarChart2 } from 'lucide-react';
import { sound } from '../utils/audio';
import { NavTab } from '../types';

interface NavbarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  reviewDueCount?: number;
  onOpenStats?: () => void;
  hidden?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  reviewDueCount = 0,
  onOpenStats,
  hidden = false,
}) => {
  const activeKey: 'learn' | 'review' | 'library' | 'progress' | 'profile' =
    currentTab === 'review'
      ? 'review'
      : currentTab === 'archive' || currentTab === 'library'
      ? 'library'
      : currentTab === 'progress' || currentTab === 'stats'
      ? 'progress'
      : currentTab === 'profile'
      ? 'profile'
      : 'learn';

  return (
    <div
      className={`fixed bottom-3 sm:bottom-4 left-0 right-0 z-40 px-3 sm:px-4 pointer-events-none flex justify-center select-none md:hidden transition-all duration-300 ${
        hidden ? 'opacity-0 translate-y-12 pointer-events-none' : 'opacity-100 translate-y-0'
      }`}
    >
      <nav
        id="lingolog-bottom-navbar"
        aria-label="主要导航栏"
        className="pointer-events-auto w-full max-w-xs bg-[var(--tel-green-900)]/95 dark:bg-[#09130d]/95 backdrop-blur-md rounded-full px-3 py-1.5 shadow-[0_12px_32px_rgba(5,15,10,0.4)] border-2 border-[var(--tel-brass-gold)]/60 flex items-center justify-around transition-all"
      >
        {/* 1. Learn (学习) */}
        <button
          onClick={() => {
            sound.playKeyClick();
            onTabChange('learn');
          }}
          className={`relative flex flex-col items-center justify-center transition-all ${
            activeKey === 'learn'
              ? 'bg-[var(--tel-green-700)] text-white px-3.5 py-1 rounded-full shadow-xs border border-[var(--tel-green-500)]/40'
              : 'text-stone-300 dark:text-stone-400 px-2 py-1'
          }`}
        >
          <Keyboard className="w-4 h-4 text-[var(--tel-brass-gold)]" />
          <span className="text-[10px] font-serif-display mt-0.5 font-bold">学习</span>
        </button>

        {/* 2. Review (复习) */}
        <button
          onClick={() => {
            sound.playKeyClick();
            onTabChange('review');
          }}
          className={`relative flex flex-col items-center justify-center transition-all ${
            activeKey === 'review'
              ? 'bg-[var(--tel-green-700)] text-white px-3.5 py-1 rounded-full shadow-xs border border-[var(--tel-green-500)]/40'
              : 'text-stone-300 dark:text-stone-400 px-2 py-1'
          }`}
        >
          <div className="relative">
            <FileText className="w-4 h-4 text-[var(--tel-brass-gold)]" />
            {reviewDueCount > 0 && (
              <span className="absolute -top-1.5 -right-3 min-w-3.5 h-3.5 px-0.5 rounded-full bg-[var(--tel-signal-red)] text-white text-[8px] font-mono font-bold flex items-center justify-center">
                {reviewDueCount > 99 ? '99+' : reviewDueCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-serif-display mt-0.5 font-bold">复习</span>
        </button>

        {/* 3. Archive (归档) */}
        <button
          onClick={() => {
            sound.playKeyClick();
            onTabChange('library');
          }}
          className={`relative flex flex-col items-center justify-center transition-all ${
            activeKey === 'library'
              ? 'bg-[var(--tel-green-700)] text-white px-3.5 py-1 rounded-full shadow-xs border border-[var(--tel-green-500)]/40'
              : 'text-stone-300 dark:text-stone-400 px-2 py-1'
          }`}
        >
          <BookOpen className="w-4 h-4 text-[var(--tel-brass-gold)]" />
          <span className="text-[10px] font-serif-display mt-0.5 font-bold">归档</span>
        </button>

        {/* 4. Progress (进度) */}
        <button
          onClick={() => {
            sound.playKeyClick();
            onTabChange('progress');
          }}
          className={`relative flex flex-col items-center justify-center transition-all ${
            activeKey === 'progress'
              ? 'bg-[var(--tel-green-700)] text-white px-3.5 py-1 rounded-full shadow-xs border border-[var(--tel-green-500)]/40'
              : 'text-stone-300 dark:text-stone-400 px-2 py-1'
          }`}
        >
          <BarChart2 className="w-4 h-4 text-[var(--tel-brass-gold)]" />
          <span className="text-[10px] font-serif-display mt-0.5 font-bold">进度</span>
        </button>
      </nav>
    </div>
  );
};
