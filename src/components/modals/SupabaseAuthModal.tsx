import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  RefreshCw,
  LogOut,
  LogIn,
  Mail,
} from 'lucide-react';
import { sound } from '../../utils/audio';
import {
  getSupabaseConfig,
  signUpWithEmail,
  signInWithEmail,
  signOutCloud,
  getCurrentUser,
  syncCardsWithCloud,
  getLastCloudSyncTime,
  fetchDailyReminderConfig,
} from '../../utils/supabase';
import { FlashCard, UserProfile, AppSettings } from '../../types';

interface SupabaseAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: FlashCard[];
  onUpdateCards: (newCards: FlashCard[]) => void;
  userProfile: UserProfile;
  onUpdateUserProfile: (p: UserProfile) => void;
  onUpdateSettings?: React.Dispatch<React.SetStateAction<AppSettings>>;
}

export const SupabaseAuthModal: React.FC<SupabaseAuthModalProps> = ({
  isOpen,
  onClose,
  cards,
  onUpdateCards,
  userProfile,
  onUpdateUserProfile,
  onUpdateSettings,
}) => {
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isAuthMode, setIsAuthMode] = useState<'signin' | 'signup'>('signin');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLastSyncTime(getLastCloudSyncTime());
      checkUser();
    }
  }, [isOpen]);

  // Check login state
  const checkUser = async () => {
    const user = await getCurrentUser();
    if (user && user.email) {
      setCurrentUserEmail(user.email);
      onUpdateUserProfile({ ...userProfile, isLoggedIn: true, name: user.email.split('@')[0] });
    } else {
      setCurrentUserEmail(null);
      onUpdateUserProfile({ ...userProfile, isLoggedIn: false });
    }
  };

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sound.playKeyClick();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Auth Submit (Sign In or Sign Up)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    sound.playKeyClick();
    setStatusNotice(null);

    const cfg = getSupabaseConfig();
    if (!cfg.isConfigured) {
      setStatusNotice({ type: 'error', text: '云端同步服务配置异常，请稍后再试' });
      return;
    }

    if (!emailInput.trim() || !passwordInput.trim()) {
      setStatusNotice({ type: 'error', text: '请填写邮箱与登录密码' });
      return;
    }

    setIsLoading(true);

    try {
      if (isAuthMode === 'signin') {
        const res = await signInWithEmail(emailInput, passwordInput);
        if (res.error) {
          setStatusNotice({ type: 'error', text: `登录失败: ${res.error}` });
        } else if (res.user) {
          sound.playSuccess();
          setCurrentUserEmail(res.user.email || emailInput);
          onUpdateUserProfile({
            ...userProfile,
            isLoggedIn: true,
            name: (res.user.email || emailInput).split('@')[0],
          });
          setStatusNotice({ type: 'success', text: '登录成功！正在同步云端卡片……' });
          // Auto sync
          await handleManualSync();
        }
      } else {
        const res = await signUpWithEmail(emailInput, passwordInput);
        if (res.error) {
          setStatusNotice({ type: 'error', text: `注册失败: ${res.error}` });
        } else {
          sound.playSuccess();
          if (res.needsEmailConfirmation) {
            setStatusNotice({
              type: 'info',
              text: '注册确认信已发至邮箱，请点击邮件链接后登录；若 Supabase 后端关闭了确认验证，可直接点击“已有账号登录”。',
            });
            setIsAuthMode('signin');
          } else {
            setCurrentUserEmail(res.user?.email || emailInput);
            onUpdateUserProfile({
              ...userProfile,
              isLoggedIn: true,
              name: (res.user?.email || emailInput).split('@')[0],
            });
            setStatusNotice({ type: 'success', text: '注册成功并已自动登录！' });
            await handleManualSync();
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Manual Sync
  const handleManualSync = async () => {
    sound.playKeyClick();
    setIsLoading(true);
    setStatusNotice(null);

    try {
      const stats = await syncCardsWithCloud(cards);
      if (stats) {
        sound.playSuccess();
        onUpdateCards(stats.mergedCards);
        setLastSyncTime(getLastCloudSyncTime());

        // 同步拉取微信打卡提醒配置
        if (onUpdateSettings) {
          try {
            const rem = await fetchDailyReminderConfig();
            if (rem && (rem.wxpusherUid || rem.enabled !== undefined)) {
              onUpdateSettings((prev) => ({
                ...prev,
                wxpusherEnabled: rem.enabled ?? prev.wxpusherEnabled,
                reminderTime: rem.reminderTime || prev.reminderTime || '21:00',
                wxpusherUid: rem.wxpusherUid || prev.wxpusherUid || '',
                wxpusherAppToken: rem.customAppToken || prev.wxpusherAppToken,
              }));
            }
          } catch {
            // ignore
          }
        }

        setStatusNotice({
          type: 'success',
          text: `同步成功！云端现有 ${stats.cloudTotal} 张卡片（拉取新卡 ${stats.pulledCount} 张，上传 ${stats.pushedCount} 张）`,
        });
      } else {
        setStatusNotice({
          type: 'error',
          text: '同步失败：请确认在 Supabase 控制台创建了 lingolog_cards 表及对应策略。',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    sound.playKeyClick();
    setIsLoading(true);
    await signOutCloud();
    setCurrentUserEmail(null);
    onUpdateUserProfile({ ...userProfile, isLoggedIn: false });
    setIsLoading(false);
    setStatusNotice({ type: 'info', text: '已退出登录，后续卡片将只保存在本地。' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="supabase-auth-modal"
        className="w-full max-w-md bg-[#f7f2e4] rounded-xs border-2 border-stone-900 shadow-[6px_6px_0px_#101711] overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 bg-[#d49e3d] border-b-2 border-stone-900 flex items-center justify-between text-stone-950">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-stone-950" />
            <span className="font-serif-display font-black text-sm tracking-wide">
              云端登录与多端同步
            </span>
          </div>
          <button
            onClick={() => {
              sound.playKeyClick();
              onClose();
            }}
            className="p-1 rounded-xs hover:bg-[#c99333] transition-colors cursor-pointer text-stone-950"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-stone-900">
          {/* Status Message */}
          {statusNotice && (
            <div
              className={`p-3 rounded-xs text-xs font-serif leading-relaxed border ${
                statusNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                  : statusNotice.type === 'error'
                  ? 'bg-red-50 border-red-500 text-red-900'
                  : 'bg-amber-50 border-amber-500 text-amber-900'
              }`}
            >
              {statusNotice.text}
            </div>
          )}

          {/* Logged in state */}
          {currentUserEmail ? (
            <div className="space-y-4">
              <div className="p-4 bg-[#faf7ee] rounded-xs border border-stone-400 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-500 font-mono">当前登录账号</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    多端云同步已开启
                  </span>
                </div>
                <div className="font-serif-display font-black text-sm sm:text-base text-stone-950 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-stone-600" />
                  <span className="truncate">{currentUserEmail}</span>
                </div>
                {lastSyncTime && (
                  <div className="text-[11px] font-mono text-stone-500 pt-1 border-t border-stone-200">
                    上次同步：{new Date(lastSyncTime).toLocaleTimeString()}
                  </div>
                )}
              </div>

              <div className="p-3 bg-[#e8f4ea] border border-emerald-300 rounded-xs text-xs text-emerald-950 font-serif leading-relaxed">
                💡 手机和电脑打开 LingoLog 登录同一个邮箱，新增卡片和复习进度就会自动互通。
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-3 bg-[#d49e3d] hover:bg-[#c99333] text-stone-950 font-serif-display font-black text-xs rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? '同步中…' : '立即双向同步'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoading}
                  className="py-2.5 px-3 bg-[#faf7ee] hover:bg-stone-200 text-stone-800 font-serif-display font-bold text-xs rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-stone-600" />
                  <span>退出登录</span>
                </button>
              </div>
            </div>
          ) : (
            /* Not logged in: Sign In / Sign Up form */
            <div className="space-y-4">
              {/* Tab Switcher */}
              <div className="flex bg-[#faf7ee] p-0.5 rounded-xs border border-stone-900 text-xs font-serif-display font-black">
                <button
                  type="button"
                  onClick={() => {
                    sound.playKeyClick();
                    setIsAuthMode('signin');
                  }}
                  className={`flex-1 py-1.5 rounded-xs transition-all cursor-pointer ${
                    isAuthMode === 'signin' ? 'bg-[#d49e3d] text-stone-950 shadow-xs' : 'text-stone-600'
                  }`}
                >
                  账号登录
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sound.playKeyClick();
                    setIsAuthMode('signup');
                  }}
                  className={`flex-1 py-1.5 rounded-xs transition-all cursor-pointer ${
                    isAuthMode === 'signup' ? 'bg-[#d49e3d] text-stone-950 shadow-xs' : 'text-stone-600'
                  }`}
                >
                  免费注册
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-mono font-bold text-stone-700 mb-1">
                    邮箱地址
                  </label>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="your-name@example.com"
                    className="w-full px-3 py-2 text-xs bg-white text-stone-900 border-2 border-stone-900 rounded-xs focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold text-stone-700 mb-1">
                    密码 (不少于6位)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-xs bg-white text-stone-900 border-2 border-stone-900 rounded-xs focus:outline-hidden font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-2.5 bg-[#d49e3d] hover:bg-[#c99333] text-stone-950 font-serif-display font-black text-xs rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 active:translate-y-0.5"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>正在连接认证…</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-3.5 h-3.5" />
                      <span>{isAuthMode === 'signin' ? '登录并同步卡片' : '注册并初始化云端'}</span>
                    </>
                  )}
                </button>
              </form>

              {/* Cloud Sync Footer Note */}
              <div className="pt-2 text-center text-[11px] text-stone-500 font-serif border-t border-dashed border-stone-300">
                ✨ 跨设备实时云端双向同步，生词数据永不丢失
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
