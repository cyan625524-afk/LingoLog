import React, { useState, useEffect } from 'react';
import { PROVIDER_PRESETS, getPreset, DEFAULT_PROVIDER_ID } from '../../data/providers';
import {
  X,
  User,
  Shield,
  Sliders,
  Cpu,
  Volume2,
  Download,
  Upload,
  Sparkles,
  Check,
  LogOut,
  LogIn,
  Cloud,
} from 'lucide-react';
import { AppSettings, UserProfile } from '../../types';
import { sound } from '../../utils/audio';
import { exportAllDataJson, importAllDataJson } from '../../utils/storage';
import { requestNotificationPermission } from '../../utils/tts';
import { ApiEngineControls } from '../common/ApiEngineControls';

interface SideProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onSaveUserProfile: (p: UserProfile) => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  onReloadData: () => void;
  cardsCount: number;
  streakDays: number;
  feathers: number;
  totalReviewCount?: number;
  onOpenSyncModal?: () => void;
}

export const SideProfileDrawer: React.FC<SideProfileDrawerProps> = ({
  isOpen,
  onClose,
  userProfile,
  onSaveUserProfile,
  settings,
  onSaveSettings,
  onReloadData,
  cardsCount,
  streakDays,
  feathers,
  totalReviewCount = 0,
  onOpenSyncModal,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [profileData, setProfileData] = useState<UserProfile>(userProfile);
  const [isEditingName, setIsEditingName] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  useEffect(() => {
    setProfileData(userProfile);
  }, [userProfile]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        sound.playKeyClick();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggleLogin = () => {
    sound.playKeyClick();
    const next: UserProfile = {
      ...profileData,
      isLoggedIn: !profileData.isLoggedIn,
      role: !profileData.isLoggedIn ? '特级电报员' : '访客学员',
    };
    setProfileData(next);
    onSaveUserProfile(next);
  };

  const handleSaveProfileName = () => {
    sound.playKeyClick();
    setIsEditingName(false);
    onSaveUserProfile(profileData);
  };

  const handleToggleNotification = async () => {
    sound.playKeyClick();
    if (!formData.enableReminders) {
      const granted = await requestNotificationPermission();
      if (granted) {
        const next = { ...formData, enableReminders: true };
        setFormData(next);
        onSaveSettings(next);
      } else {
        alert('请在浏览器设置中允许发送通知以启用复习提醒。');
      }
    } else {
      const next = { ...formData, enableReminders: false };
      setFormData(next);
      onSaveSettings(next);
    }
  };

  const handleExportJson = () => {
    sound.playKeyClick();
    const jsonStr = exportAllDataJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lingolog_telegraph_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const res = importAllDataJson(text);
      if (res.success) {
        sound.playSuccess();
        setImportStatus(`数据导入成功！已同步 ${res.count || 0} 封电报。`);
        onReloadData();
      } else {
        setImportStatus(`导入失败：${res.message || '请确认 JSON 格式正确'}`);
      }
    };
    reader.readAsText(file);
  };

  const handleSettingChange = (patch: Partial<AppSettings>) => {
    sound.playKeyClick();
    const next = { ...formData, ...patch };
    setFormData(next);
    onSaveSettings(next);
  };

  return (
    <div
      id="side-profile-drawer-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sound.playKeyClick();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex animate-in fade-in duration-200 select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-80 max-w-[85vw] h-full bg-[#f4edd3] border-r-2 border-stone-900 shadow-2xl flex flex-col text-stone-900 animate-in slide-in-from-left duration-200 cursor-default"
      >
        {/* Mustard Header */}
        <div className="bg-[#d49e3d] px-4 py-3 border-b-2 border-stone-900 flex items-center justify-between text-stone-900 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#243427] inline-block" />
            <span className="font-serif-display font-black text-sm tracking-wide">
              — 我的与设置 —
            </span>
          </div>
          <button
            onClick={() => {
              sound.playKeyClick();
              onClose();
            }}
            className="p-1 rounded-xs hover:bg-[#c99333] text-stone-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Punch Holes Perforation Row */}
        <div className="punch-holes-row border-b border-dashed border-stone-400/70 bg-[#eee5c6] shrink-0">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="punch-hole-dot" />
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
          {/* Section 1: User Profile Card */}
          <div className="bg-[#eee5c6] p-3.5 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] space-y-3">
            <div className="flex items-center gap-3">
              <div
                onClick={() => {
                  sound.playKeyClick();
                  if (onOpenSyncModal) {
                    onOpenSyncModal();
                  } else {
                    handleToggleLogin();
                  }
                }}
                className="relative cursor-pointer group shrink-0"
                title="点击头像：登录并开启 Cloudflare 多端同步"
              >
                <img
                  src={profileData.avatar}
                  alt={profileData.name}
                  className="w-12 h-12 rounded-xs border-2 border-stone-900 object-cover shadow-[1px_1px_0px_#101711] group-hover:brightness-105 group-hover:scale-105 transition-all"
                />
                <span
                  className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#eee5c6] ${
                    profileData.isLoggedIn ? 'bg-emerald-600' : 'bg-stone-400'
                  }`}
                  title={profileData.isLoggedIn ? '在线已登录 (已连接多端同步)' : '未登录访客 (点击登录)'}
                />
                <div className="absolute inset-0 bg-stone-950/60 opacity-0 group-hover:opacity-100 rounded-xs flex flex-col items-center justify-center text-[9px] text-white font-mono transition-opacity">
                  <Cloud className="w-3.5 h-3.5 text-[#d49e3d]" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) =>
                        setProfileData({ ...profileData, name: e.target.value })
                      }
                      className="w-full text-xs font-serif-display font-bold p-1 bg-white border border-stone-900 rounded-xs"
                    />
                    <button
                      onClick={handleSaveProfileName}
                      className="p-1 bg-[#d49e3d] text-stone-900 rounded-xs border border-stone-900"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="font-serif-display font-black text-sm text-stone-900 truncate">
                      {profileData.name}
                    </span>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="text-[10px] text-stone-500 hover:text-stone-900 underline font-mono cursor-pointer"
                    >
                      编辑
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1 text-[10px] font-mono text-stone-600 mt-0.5">
                  <span className="bg-[#243427] text-[#d49e3d] px-1 py-0.2 rounded-xs font-bold">
                    {profileData.id}
                  </span>
                  <span className="truncate">{profileData.role}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-dashed border-stone-400 flex items-center justify-between text-[11px]">
              <span className="text-stone-600 font-serif">
                状态: {profileData.isLoggedIn ? '已登录·特级认证' : '未登录·访客浏览'}
              </span>
              <button
                onClick={() => {
                  sound.playKeyClick();
                  if (onOpenSyncModal) {
                    onOpenSyncModal();
                  } else {
                    handleToggleLogin();
                  }
                }}
                className="px-2.5 py-1 rounded-xs border border-stone-900 bg-[#faf7ee] hover:bg-white text-[11px] font-serif-display font-bold flex items-center gap-1 shadow-[1px_1px_0px_#101711] cursor-pointer"
              >
                {profileData.isLoggedIn ? (
                  <>
                    <Cloud className="w-3 h-3 text-emerald-700" />
                    <span>多端同步</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-3 h-3 text-emerald-700" />
                    <span>多端登录</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-1.5 pt-1 text-center font-mono text-stone-900">
              <div className="p-1.5 bg-[#faf7ee] rounded-xs border border-stone-400">
                <div className="text-[10px] text-stone-500 font-serif">归档</div>
                <div className="font-black text-xs">{cardsCount}</div>
              </div>
              <div className="p-1.5 bg-[#faf7ee] rounded-xs border border-stone-400">
                <div className="text-[10px] text-stone-500 font-serif">连签</div>
                <div className="font-black text-xs">{streakDays}天</div>
              </div>
              <div className="p-1.5 bg-[#faf7ee] rounded-xs border border-stone-400">
                <div className="text-[10px] text-stone-500 font-serif">羽毛</div>
                <div className="font-black text-xs text-[#d49e3d]">{feathers}</div>
              </div>
            </div>
          </div>

          {/* Section 2: AI 推理模型与 API Key */}
          <div className="bg-[#eee5c6] p-3.5 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold font-serif-display text-xs text-stone-900">
              <Cpu className="w-3.5 h-3.5 text-[#d49e3d]" />
              <span>智能翻译引擎</span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-stone-600 font-serif">服务商：</label>
              <select
                value={formData.apiProvider || DEFAULT_PROVIDER_ID}
                onChange={(e) => {
                  const preset = getPreset(e.target.value);
                  handleSettingChange({
                    apiProvider: e.target.value,
                    modelName: preset.models[0] || '',
                    customBaseUrl: '',
                  });
                }}
                className="w-full text-xs p-1.5 rounded-xs border border-stone-900 bg-[#faf7ee] text-stone-900 font-mono"
              >
                {PROVIDER_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-stone-600 font-serif">推理模型（可手填）：</label>
              <input
                list="lingolog-drawer-model-options"
                value={formData.modelName}
                onChange={(e) => handleSettingChange({ modelName: e.target.value })}
                placeholder="选择或输入模型名"
                className="w-full text-xs p-1.5 rounded-xs border border-stone-900 bg-[#faf7ee] text-stone-900 font-mono"
              />
              <datalist id="lingolog-drawer-model-options">
                {getPreset(formData.apiProvider || DEFAULT_PROVIDER_ID).models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-dashed border-stone-400">
              <ApiEngineControls
                settings={formData}
                onSaveSettings={onSaveSettings}
                variant="compact"
                idPrefix="lingolog-drawer-engine"
                onPickModel={(m) => handleSettingChange({ modelName: m })}
              />
              <p className="text-[10px] text-stone-500 font-serif leading-snug">
                只存在本机浏览器里，服务端不落盘、不写日志。别人部署的网址不要填。
              </p>
            </div>
          </div>

          {/* Section 3: 声音与调度 */}
          <div className="bg-[#eee5c6] p-3.5 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] space-y-3">
            <div className="flex items-center gap-1.5 font-bold font-serif-display text-xs text-stone-900">
              <Volume2 className="w-3.5 h-3.5 text-[#d49e3d]" />
              <span>声音与复习调度</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-700 font-serif">莫尔斯与打字音效</span>
              <button
                onClick={() =>
                  handleSettingChange({ soundEnabled: !formData.soundEnabled })
                }
                className={`px-3 py-1 rounded-xs text-xs font-bold border border-stone-900 shadow-[1px_1px_0px_#101711] cursor-pointer ${
                  formData.soundEnabled
                    ? 'bg-[#243427] text-[#d49e3d]'
                    : 'bg-[#faf7ee] text-stone-600'
                }`}
              >
                {formData.soundEnabled ? '已开启' : '已静音'}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-dashed border-stone-400">
              <span className="text-stone-700 font-serif">每日复习限额</span>
              <input
                type="number"
                min={5}
                max={50}
                value={formData.dailyReviewLimit}
                onChange={(e) =>
                  handleSettingChange({
                    dailyReviewLimit: Math.min(50, Math.max(5, parseInt(e.target.value, 10) || 10)),
                  })
                }
                className="w-14 p-1 text-center text-xs rounded-xs border border-stone-900 bg-[#faf7ee] font-mono font-bold"
              />
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-dashed border-stone-400">
              <span className="text-stone-700 font-serif">到期提醒通知</span>
              <button
                onClick={handleToggleNotification}
                className={`px-3 py-1 rounded-xs text-xs font-bold border border-stone-900 shadow-[1px_1px_0px_#101711] cursor-pointer ${
                  formData.enableReminders
                    ? 'bg-[#243427] text-[#d49e3d]'
                    : 'bg-[#faf7ee] text-stone-600'
                }`}
              >
                {formData.enableReminders ? '已开启' : '已关闭'}
              </button>
            </div>
          </div>

          {/* Section 4: 备份与安全 */}
          <div className="bg-[#eee5c6] p-3.5 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] space-y-2">
            <div className="flex items-center gap-1.5 font-bold font-serif-display text-xs text-stone-900">
              <Shield className="w-3.5 h-3.5 text-[#d49e3d]" />
              <span>卷宗数据备份</span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleExportJson}
                className="flex-1 py-1.5 rounded-xs bg-[#faf7ee] hover:bg-white border border-stone-900 text-stone-900 font-bold flex items-center justify-center gap-1 shadow-[1px_1px_0px_#101711] cursor-pointer font-serif-display text-xs"
              >
                <Download className="w-3.5 h-3.5 text-stone-700" />
                <span>导出 JSON</span>
              </button>

              <label className="flex-1 py-1.5 rounded-xs bg-[#faf7ee] hover:bg-white border border-stone-900 text-stone-900 font-bold flex items-center justify-center gap-1 shadow-[1px_1px_0px_#101711] cursor-pointer font-serif-display text-xs">
                <Upload className="w-3.5 h-3.5 text-stone-700" />
                <span>导入备份</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJson}
                  className="hidden"
                />
              </label>
            </div>

            {importStatus && (
              <p className="text-[11px] text-emerald-800 font-semibold pt-1">
                {importStatus}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#eee5c6] border-t-2 border-stone-900 shrink-0">
          <button
            onClick={() => {
              sound.playKeyClick();
              onClose();
            }}
            className="w-full py-2 bg-[#d49e3d] hover:bg-[#c99333] active:translate-y-0.5 text-stone-950 font-serif-display font-black text-xs rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] text-center cursor-pointer"
          >
            完成并收起抽屉
          </button>
        </div>
      </div>
    </div>
  );
};
