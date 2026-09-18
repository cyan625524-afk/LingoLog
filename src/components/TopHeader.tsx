import React from 'react';
import {
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Settings as SettingsIcon,
  BarChart2,
  BookOpen,
  Keyboard,
  FileText,
  Radio,
  User,
  Menu,
} from 'lucide-react';
import { sound } from '../utils/audio';
import { AppSettings, NavTab, UserProfile } from '../types';
import { BrassNameplate } from './common/BrassNameplate';
import { SignalLamp } from './common/SignalLamp';

interface TopHeaderProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  dueCount?: number;
  feathers?: number;
  streakDays?: number;
  focusedMinutes?: number;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenSettings: () => void;
  onOpenMobileDrawer?: () => void;
  onOpenStats?: () => void;
  isGenerating?: boolean;
  generationProgress?: number;
  generationStatus?: string;
  userProfile?: UserProfile;
  onOpenAuthModal?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentTab,
  onTabChange,
  dueCount = 0,
  feathers = 0,
  streakDays = 1,
  settings,
  onUpdateSettings,
  onOpenSettings,
  onOpenMobileDrawer,
  onOpenStats,
  isGenerating = false,
  generationProgress = 100,
  generationStatus = '',
  userProfile,
  onOpenAuthModal,
}) => {
  const toggleSound = () => {
    const next = !settings.soundEnabled;
    onUpdateSettings({ soundEnabled: next });
    sound.setConfig(next, settings.soundVolume);
    if (next) sound.playKeyClick();
  };

  const toggleTheme = () => {
    const next = settings.themeMode === 'light' ? 'dark' : 'light';
    onUpdateSettings({ themeMode: next });
    sound.playKeyClick();
  };

  // Active tab normalizer
  const activeKey =
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
    <header
      id="lingolog-top-header"
      className="w-full bg-[#182319] text-stone-100 shadow-xl z-30 select-none sticky top-0 transition-colors border-b border-[#2d3e30]"
    >
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* LEFT: British Telegraph Office Logo Emblem (Clicking on mobile slides out Profile/Settings drawer) */}
        <div
          className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group"
          onClick={() => {
            sound.playKeyClick();
            if (window.innerWidth < 768 && onOpenMobileDrawer) {
              onOpenMobileDrawer();
            } else {
              onTabChange('learn');
            }
          }}
          title="点击打开个人信息与设置"
        >
          <div className="w-9 h-9 rounded-sm bg-[#121b13] border-2 border-[#d49e3d] flex items-center justify-center shadow-xs relative">
            <span className="text-[#d49e3d] text-base font-serif font-black">❖</span>
            <span className="md:hidden absolute -bottom-1 -right-1 w-3 h-3 bg-[#243427] border border-[#d49e3d] rounded-xs flex items-center justify-center text-[7px] text-[#d49e3d]">
              ☰
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-serif-display font-black text-sm tracking-wider text-[#f5eed6] leading-none">
              LINGOLOG
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#d49e3d] font-bold leading-tight mt-0.5">
              THE TELEGRAPH OFFICE
            </span>
          </div>
        </div>

        {/* Mobile Right: Avatar (Login trigger) & "我的" button trigger */}
        <div className="flex md:hidden items-center gap-2">
          {onOpenAuthModal && (
            <button
              type="button"
              onClick={() => {
                sound.playKeyClick();
                onOpenAuthModal();
              }}
              className="relative p-0.5 rounded-sm bg-[#121c14] border border-[#d49e3d]/70 cursor-pointer flex items-center justify-center"
              title={userProfile?.isLoggedIn ? "已登录云同步 (点击管理)" : "点击头像登录并开启多端同步"}
            >
              <img
                src={userProfile?.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=teleprinter"}
                alt="User"
                className="w-6 h-6 rounded-xs object-cover"
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#182319] ${
                  userProfile?.isLoggedIn ? 'bg-emerald-500' : 'bg-stone-500'
                }`}
              />
            </button>
          )}
          <button
            onClick={() => {
              sound.playKeyClick();
              if (onOpenMobileDrawer) {
                onOpenMobileDrawer();
              } else {
                onOpenSettings();
              }
            }}
            className="px-2.5 py-1 rounded-xs bg-[#243427] border border-[#d49e3d]/60 text-[#d49e3d] text-xs font-serif-display font-bold flex items-center gap-1 cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
            <span>我的</span>
          </button>
        </div>

        {/* CENTER: Navigation Tabs (学习 · 复习 · 归档 · 进度 · 我的) - Hidden on mobile, shown on md+ screens */}
        <nav className="hidden md:flex items-center gap-1.5 sm:gap-2">
          <button
            id="header-tab-learn"
            onClick={() => {
              sound.playKeyClick();
              onTabChange('learn');
            }}
            className={`px-3 sm:px-4 py-1.5 rounded-sm text-xs font-serif-display transition-all cursor-pointer font-bold ${
              activeKey === 'learn'
                ? 'bg-[#d49e3d] text-[#141b14] shadow-xs'
                : 'text-stone-300 hover:text-white hover:bg-white/5'
            }`}
          >
            学习
          </button>

          <button
            id="header-tab-review"
            onClick={() => {
              sound.playKeyClick();
              onTabChange('review');
            }}
            className={`px-3 sm:px-4 py-1.5 rounded-sm text-xs font-serif-display transition-all cursor-pointer font-bold flex items-center gap-1.5 relative ${
              activeKey === 'review'
                ? 'bg-[#d49e3d] text-[#141b14] shadow-xs'
                : 'text-stone-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>复习</span>
            {dueCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                activeKey === 'review' ? 'bg-[#99332e] text-white' : 'bg-[#99332e] text-white'
              }`}>
                {dueCount}
              </span>
            )}
          </button>

          <button
            id="header-tab-library"
            onClick={() => {
              sound.playKeyClick();
              onTabChange('library');
            }}
            className={`px-3 sm:px-4 py-1.5 rounded-sm text-xs font-serif-display transition-all cursor-pointer font-bold ${
              activeKey === 'library'
                ? 'bg-[#d49e3d] text-[#141b14] shadow-xs'
                : 'text-stone-300 hover:text-white hover:bg-white/5'
            }`}
          >
            归档
          </button>

          <button
            id="header-tab-progress"
            onClick={() => {
              sound.playKeyClick();
              onTabChange('progress');
            }}
            className={`px-3 sm:px-4 py-1.5 rounded-sm text-xs font-serif-display transition-all cursor-pointer font-bold ${
              activeKey === 'progress'
                ? 'bg-[#d49e3d] text-[#141b14] shadow-xs'
                : 'text-stone-300 hover:text-white hover:bg-white/5'
            }`}
          >
            进度
          </button>

          <button
            id="header-tab-profile"
            onClick={() => {
              sound.playKeyClick();
              onTabChange('profile');
            }}
            className={`px-3 sm:px-4 py-1.5 rounded-sm text-xs font-serif-display transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
              activeKey === 'profile'
                ? 'bg-[#d49e3d] text-[#141b14] shadow-xs'
                : 'text-stone-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <User className={`w-3.5 h-3.5 ${activeKey === 'profile' ? 'text-[#141b14]' : 'text-[#d49e3d]'}`} />
            <span>我的</span>
          </button>
        </nav>

        {/* RIGHT: Avatar (Login trigger), Quick Sound & Merit Feathers - Hidden on mobile, shown on md+ screens */}
        <div className="hidden md:flex items-center gap-2.5 text-xs">
          {/* User Avatar (Click to open Supabase Cloud Sync / Login) */}
          {onOpenAuthModal && (
            <button
              type="button"
              onClick={() => {
                sound.playKeyClick();
                onOpenAuthModal();
              }}
              title={userProfile?.isLoggedIn ? "已连接 Supabase 云端同步 (点击管理)" : "点击头像登录：开启多端实时同步"}
              className="relative flex items-center justify-center p-0.5 rounded-sm bg-[#121c14] border border-[#d49e3d]/70 hover:border-[#d49e3d] transition-all cursor-pointer group"
            >
              <img
                src={userProfile?.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=teleprinter"}
                alt="User"
                className="w-6 h-6 rounded-xs object-cover"
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#182319] ${
                  userProfile?.isLoggedIn ? 'bg-emerald-500' : 'bg-stone-500'
                }`}
              />
            </button>
          )}

          {/* Feather Balance */}
          <div
            onClick={() => {
              sound.playKeyClick();
              onTabChange('progress');
            }}
            title="羽毛资产"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-sm bg-[#121c14] border border-[#d49e3d]/60 text-stone-200 cursor-pointer hover:border-[#d49e3d]"
          >
            <span className="text-xs">🪶</span>
            <span className="font-mono font-bold text-[#d49e3d] text-xs">
              {feathers}
            </span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            title={settings.soundEnabled ? '机械音效：开' : '机械音效：静音'}
            className="w-7 h-7 rounded-sm bg-[#121c14] hover:bg-[#202e22] border border-[#2d3e30] text-stone-200 flex items-center justify-center transition-all cursor-pointer"
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-stone-200" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-stone-400" />
            )}
          </button>
        </div>
      </div>

      {/* Perforated Dot Paper Tape Strip Beneath Top Header */}
      <div
        id="telegraph-header-punched-tape"
        className="relative w-full bg-[#121913] border-t border-b border-[#253527] h-3.5 sm:h-4 overflow-hidden select-none pointer-events-none flex items-center"
        style={{
          backgroundImage: 'radial-gradient(circle, #253627 1.5px, transparent 1.7px)',
          backgroundSize: '9px 100%',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'left center',
        }}
      >
        {/* Active Golden Telegraph Punch Dots */}
        <div
          className="h-full transition-[width] duration-200 ease-out"
          style={{
            width: isGenerating ? `${Math.min(100, Math.max(0, generationProgress))}%` : '100%',
            backgroundImage: 'radial-gradient(circle, #d49e3d 1.8px, transparent 2.1px)',
            backgroundSize: '9px 100%',
            backgroundRepeat: 'repeat-x',
            backgroundPosition: 'left center',
          }}
        />

        {/* Leading Print-Head Glow Needle during generation */}
        {isGenerating && generationProgress > 2 && generationProgress < 100 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-[left] duration-200 ease-out z-10 flex items-center justify-center"
            style={{ left: `${generationProgress}%` }}
          >
            <span className="w-2 h-2 rounded-full bg-[#ffea75] shadow-[0_0_8px_#f59e0b] animate-pulse" />
          </div>
        )}

        {/* Telegraph Transmission Status Badge */}
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="flex items-center gap-1.5 px-2 py-0.2 bg-[#121913]/92 border border-[#d49e3d]/70 rounded-xs shadow-xs text-[#f5eed6] font-mono text-[9px] font-bold tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d49e3d] animate-ping inline-block" />
              <span>{generationStatus || '拍发电文中'}</span>
              <span className="text-[#d49e3d]">{Math.round(generationProgress)}%</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
