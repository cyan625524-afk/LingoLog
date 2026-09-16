import React, { useState } from 'react';
import { Download, Smartphone, X, Check } from 'lucide-react';
import { usePWAInstall } from '../../utils/usePWAInstall';
import { sound } from '../../utils/audio';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'settings' }> = ({
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={() => {
          sound.playKeyClick();
          install();
        }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
          variant === 'header'
            ? 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs'
            : 'bg-[#46553b] text-white hover:bg-[#38462f] shadow-xs'
        }`}
        title="安装 LingoLog 到桌面或主屏幕"
      >
        <Download className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span>安装应用</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => {
            sound.playKeyClick();
            setShowIOSGuide(true);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            variant === 'header'
              ? 'bg-stone-200/80 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-600'
              : 'bg-[#46553b] text-white hover:bg-[#38462f]'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-[#46553b] dark:text-[#a0b891]" />
          <span>添加到主屏幕</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-2xl bg-[#fdfcf7] dark:bg-[#1f261b] p-6 shadow-2xl border border-stone-300 dark:border-stone-700 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-[#46553b] dark:text-[#a0b891]" />
                  <h3 className="text-sm font-bold font-serif-display text-stone-900 dark:text-stone-100">
                    安装到 iPhone / iPad 主屏幕
                  </h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-stone-400 hover:text-stone-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-stone-600 dark:text-stone-300 space-y-2.5 font-serif-body">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-800 font-mono font-bold flex items-center justify-center text-[10px] shrink-0">
                    1
                  </span>
                  <span>点击 Safari 浏览器底部的 <strong>分享 (Share)</strong> 按钮</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-800 font-mono font-bold flex items-center justify-center text-[10px] shrink-0">
                    2
                  </span>
                  <span>在菜单列表中向下滑动，选择 <strong>“添加到主屏幕” (Add to Home Screen)</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-800 font-mono font-bold flex items-center justify-center text-[10px] shrink-0">
                    3
                  </span>
                  <span>点击右上角 <strong>“添加”</strong>，即可像原生 App 一样即开即用！</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 rounded-xl bg-[#46553b] text-white text-xs font-bold hover:bg-[#38462f] cursor-pointer"
              >
                我知道了
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
