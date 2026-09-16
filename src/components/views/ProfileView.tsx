import React, { useState, useEffect } from 'react';
import { PROVIDER_PRESETS, getPreset, DEFAULT_PROVIDER_ID } from '../../data/providers';
import {
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
  Calendar,
  Award,
  BookOpen,
  History,
  Bell,
  Radio,
  FileCheck,
  Terminal,
  HelpCircle,
  Clock,
  Cloud,
} from 'lucide-react';
import { AppSettings, UserProfile, NavTab } from '../../types';
import { sound } from '../../utils/audio';
import { exportAllDataJson, importAllDataJson } from '../../utils/storage';
import { requestNotificationPermission } from '../../utils/tts';
import { ApiEngineControls } from '../common/ApiEngineControls';

interface ProfileViewProps {
  userProfile: UserProfile;
  onSaveUserProfile: (p: UserProfile) => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  onReloadData: () => void;
  cardsCount: number;
  streakDays: number;
  feathers: number;
  totalReviewCount?: number;
  onNavigateTab?: (tab: NavTab) => void;
  onOpenSyncModal?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userProfile,
  onSaveUserProfile,
  settings,
  onSaveSettings,
  onReloadData,
  cardsCount,
  streakDays,
  feathers,
  totalReviewCount = 0,
  onNavigateTab,
  onOpenSyncModal,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [profileData, setProfileData] = useState<UserProfile>(userProfile);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userProfile.name);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  useEffect(() => {
    setProfileData(userProfile);
    setNameInput(userProfile.name);
  }, [userProfile]);

  const showToast = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => {
      setSavedToast(null);
    }, 2500);
  };

  const handleToggleLogin = () => {
    sound.playKeyClick();
    const next: UserProfile = {
      ...profileData,
      isLoggedIn: !profileData.isLoggedIn,
      role: !profileData.isLoggedIn ? '特级电报员' : '访客学员',
    };
    setProfileData(next);
    onSaveUserProfile(next);
    showToast(next.isLoggedIn ? '已认证特级电报员' : '已切换为访客学员');
  };

  const handleSaveProfileName = () => {
    sound.playKeyClick();
    if (!nameInput.trim()) return;
    const next = { ...profileData, name: nameInput.trim() };
    setProfileData(next);
    setIsEditingName(false);
    onSaveUserProfile(next);
    showToast('档案姓名已更新');
  };

  const handleToggleNotification = async () => {
    sound.playKeyClick();
    if (!formData.enableReminders) {
      const granted = await requestNotificationPermission();
      if (granted) {
        const next = { ...formData, enableReminders: true };
        setFormData(next);
        onSaveSettings(next);
        showToast('到期提醒通知已开启');
      } else {
        alert('请在浏览器设置中允许发送通知以启用复习提醒。');
      }
    } else {
      const next = { ...formData, enableReminders: false };
      setFormData(next);
      onSaveSettings(next);
      showToast('到期提醒通知已关闭');
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
    showToast('卷宗备份已导出');
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
        showToast(`成功恢复 ${res.count || 0} 张卡片`);
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
    showToast('配置已实时保存');
  };

  // 当前服务商预设：用来给出模型建议、Base URL 占位和提示
  const activeProviderId = formData.apiProvider || DEFAULT_PROVIDER_ID;
  const activePreset = getPreset(activeProviderId);

  const handleProviderChange = (id: string) => {
    const preset = getPreset(id);
    // 切服务商时把模型和 Base URL 重置为该预设的默认值，避免残留上一个服务商的配置
    handleSettingChange({
      apiProvider: id,
      modelName: preset.models[0] || '',
      customBaseUrl: '',
    });
  };

  return (
    <div
      id="lingolog-profile-view"
      className="flex-1 w-full bg-[#182319] min-h-[calc(100vh-64px)] pt-5 sm:pt-8 pb-24 md:pb-12 px-4 sm:px-6 flex flex-col items-center justify-start text-stone-100 transition-colors select-none"
    >
      <div className="w-full max-w-5xl flex flex-col space-y-5 sm:space-y-6">
        {/* Toast alert */}
        {savedToast && (
          <div className="fixed top-16 right-6 z-50 bg-[#d49e3d] text-stone-950 px-4 py-2 rounded-xs border-2 border-stone-900 shadow-[3px_3px_0px_#101711] font-serif-display font-bold text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>{savedToast}</span>
          </div>
        )}

        {/* 2-Column Responsive Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {/* LEFT COLUMN: Operator Dossier & Quick Metrics (5 Cols on LG) */}
          <div className="lg:col-span-5 space-y-5 sm:space-y-6">
            {/* Operator Credentials Card */}
            <div className="bg-[#f4edd3] dark:bg-[#1f2b21] rounded-xs p-5 border-2 border-stone-900 shadow-[4px_4px_0px_#101711] text-stone-900 dark:text-stone-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b-2 border-dashed border-stone-300 dark:border-stone-800">
                <div className="flex items-center gap-2 font-serif-display font-black text-sm">
                  <User className="w-4 h-4 text-[#d49e3d]" />
                  <span>电报员身份签牌</span>
                </div>
                <span className="font-mono text-[10px] text-stone-500 dark:text-stone-400">
                  ID: {profileData.id}
                </span>
              </div>

              {/* Avatar & Name Row */}
              <div className="flex items-start gap-4">
                <div
                  onClick={() => {
                    sound.playKeyClick();
                    if (onOpenSyncModal) {
                      onOpenSyncModal();
                    } else {
                      handleToggleLogin();
                    }
                  }}
                  className="relative shrink-0 cursor-pointer group"
                  title="点击头像：登录并开启 Cloudflare 多端同步"
                >
                  <img
                    src={profileData.avatar}
                    alt={profileData.name}
                    className="w-16 h-16 rounded-xs border-2 border-stone-900 object-cover shadow-[2px_2px_0px_#101711] group-hover:brightness-105 group-hover:scale-105 transition-all"
                  />
                  <span
                    className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#f4edd3] dark:border-[#1f2b21] ${
                      profileData.isLoggedIn ? 'bg-emerald-600' : 'bg-stone-400'
                    }`}
                    title={profileData.isLoggedIn ? '在线已登录 (已连接多端同步)' : '访客未登录 (点击登录)'}
                  />
                  <div className="absolute inset-0 bg-stone-950/60 opacity-0 group-hover:opacity-100 rounded-xs flex flex-col items-center justify-center text-[10px] text-white font-mono transition-opacity">
                    <Cloud className="w-4 h-4 text-[#d49e3d] mb-0.5" />
                    <span>多端登录</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  {isEditingName ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="w-full text-xs font-serif-display font-bold p-1.5 bg-white dark:bg-[#121c13] text-stone-900 dark:text-stone-100 border-2 border-stone-900 rounded-xs"
                      />
                      <button
                        onClick={handleSaveProfileName}
                        className="p-1.5 bg-[#d49e3d] text-stone-900 rounded-xs border-2 border-stone-900 shadow-[1px_1px_0px_#101711] cursor-pointer hover:bg-[#c99333]"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-serif-display font-black text-base text-stone-900 dark:text-white truncate">
                        {profileData.name}
                      </span>
                      <button
                        onClick={() => setIsEditingName(true)}
                        className="text-[11px] text-[#d49e3d] hover:underline font-mono cursor-pointer font-bold"
                      >
                        [修改]
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="px-2 py-0.5 rounded-xs bg-[#243427] text-[#d49e3d] border border-stone-900 font-bold">
                      {profileData.role}
                    </span>
                    <span className="text-stone-500 dark:text-stone-400 text-[11px]">
                      {profileData.isLoggedIn ? '官方特级证书' : '学员身份'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status & One-Click Login / Sync Toggle */}
              <div className="pt-3 border-t border-dashed border-stone-300 dark:border-stone-800 flex items-center justify-between">
                <span className="text-xs font-serif text-stone-600 dark:text-stone-300">
                  当前状态：
                  <span className="font-bold ml-1 text-stone-900 dark:text-white">
                    {profileData.isLoggedIn ? '特级电报员已认证' : '访客学员凭证'}
                  </span>
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
                  className="px-3 py-1.5 rounded-xs border-2 border-stone-900 bg-[#faf7ee] hover:bg-white dark:bg-[#243427] dark:hover:bg-[#2d4031] text-xs font-serif-display font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_#101711] cursor-pointer transition-all active:translate-y-0.5"
                >
                  {profileData.isLoggedIn ? (
                    <>
                      <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>多端同步 / 切换</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>多端登录认证</span>
                    </>
                  )}
                </button>
              </div>

              {/* 4 Quick Key Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center font-mono">
                <div className="p-2.5 bg-[#faf7ee] dark:bg-[#162117] rounded-xs border border-stone-400 dark:border-stone-700">
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 font-serif">
                    归档卷宗
                  </div>
                  <div className="font-black text-sm text-stone-900 dark:text-white mt-0.5">
                    {cardsCount}
                  </div>
                </div>

                <div className="p-2.5 bg-[#faf7ee] dark:bg-[#162117] rounded-xs border border-stone-400 dark:border-stone-700">
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 font-serif">
                    连续值机
                  </div>
                  <div className="font-black text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {streakDays} 天
                  </div>
                </div>

                <div className="p-2.5 bg-[#faf7ee] dark:bg-[#162117] rounded-xs border border-stone-400 dark:border-stone-700">
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 font-serif">
                    功勋羽毛
                  </div>
                  <div className="font-black text-sm text-[#d49e3d] mt-0.5">
                    {feathers} 🪶
                  </div>
                </div>

                <div className="p-2.5 bg-[#faf7ee] dark:bg-[#162117] rounded-xs border border-stone-400 dark:border-stone-700">
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 font-serif">
                    累计复习
                  </div>
                  <div className="font-black text-sm text-stone-900 dark:text-white mt-0.5">
                    {totalReviewCount} 次
                  </div>
                </div>
              </div>
            </div>

            {/* Sound & Practice Controls */}
            <div className="bg-[#f4edd3] dark:bg-[#1f2b21] rounded-xs p-5 border-2 border-stone-900 shadow-[4px_4px_0px_#101711] text-stone-900 dark:text-stone-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b-2 border-dashed border-stone-300 dark:border-stone-800">
                <div className="flex items-center gap-2 font-serif-display font-black text-sm">
                  <Volume2 className="w-4 h-4 text-[#d49e3d]" />
                  <span>声音音效与每日调度</span>
                </div>
                <Sliders className="w-3.5 h-3.5 text-stone-400" />
              </div>

              {/* Sound toggle */}
              <div className="flex items-center justify-between py-1">
                <div className="space-y-0.5">
                  <div className="text-xs font-serif font-bold text-stone-900 dark:text-white">
                    机械打字机与莫尔斯音效
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">
                    按键、翻牌与归档时伴随复古机械音响
                  </div>
                </div>
                <button
                  onClick={() =>
                    handleSettingChange({ soundEnabled: !formData.soundEnabled })
                  }
                  className={`px-3.5 py-1.5 rounded-xs text-xs font-serif-display font-bold border-2 border-stone-900 shadow-[2px_2px_0px_#101711] cursor-pointer transition-all active:translate-y-0.5 ${
                    formData.soundEnabled
                      ? 'bg-[#d49e3d] text-stone-950'
                      : 'bg-[#faf7ee] dark:bg-[#2a382c] text-stone-500'
                  }`}
                >
                  {formData.soundEnabled ? '已开启' : '已静音'}
                </button>
              </div>

              {/* Review quota */}
              <div className="flex items-center justify-between pt-3 border-t border-dashed border-stone-300 dark:border-stone-800">
                <div className="space-y-0.5">
                  <div className="text-xs font-serif font-bold text-stone-900 dark:text-white">
                    每日值机复习上限限额
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">
                    单日自动排期的复习卡片数量（5 ~ 50）
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={formData.dailyReviewLimit}
                    onChange={(e) =>
                      handleSettingChange({
                        dailyReviewLimit: Math.max(5, Math.min(50, parseInt(e.target.value) || 10)),
                      })
                    }
                    className="w-16 p-1.5 text-center text-xs font-mono font-bold rounded-xs border-2 border-stone-900 bg-white dark:bg-[#121c13] text-stone-900 dark:text-stone-100 shadow-[1px_1px_0px_#101711]"
                  />
                  <span className="text-xs font-serif text-stone-500">张</span>
                </div>
              </div>

              {/* Review reminder notification */}
              <div className="flex items-center justify-between pt-3 border-t border-dashed border-stone-300 dark:border-stone-800">
                <div className="space-y-0.5">
                  <div className="text-xs font-serif font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-[#d49e3d]" />
                    <span>浏览器到期提醒通知</span>
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">
                    当积压电文需要值机复习时弹窗提醒
                  </div>
                </div>
                <button
                  onClick={handleToggleNotification}
                  className={`px-3.5 py-1.5 rounded-xs text-xs font-serif-display font-bold border-2 border-stone-900 shadow-[2px_2px_0px_#101711] cursor-pointer transition-all active:translate-y-0.5 ${
                    formData.enableReminders
                      ? 'bg-[#d49e3d] text-stone-950'
                      : 'bg-[#faf7ee] dark:bg-[#2a382c] text-stone-500'
                  }`}
                >
                  {formData.enableReminders ? '已开启' : '已关闭'}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: AI Engine, Backup & Station Records (7 Cols on LG) */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            {/* AI Engine & API Key Configuration */}
            <div className="bg-[#f4edd3] dark:bg-[#1f2b21] rounded-xs p-5 border-2 border-stone-900 shadow-[4px_4px_0px_#101711] text-stone-900 dark:text-stone-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b-2 border-dashed border-stone-300 dark:border-stone-800">
                <div className="flex items-center gap-2 font-serif-display font-black text-sm">
                  <Cpu className="w-4 h-4 text-[#d49e3d]" />
                  <span>智能翻译引擎配置</span>
                </div>
                <span className="text-[10px] font-mono text-[#d49e3d] font-bold">
                  AI ENGINE
                </span>
              </div>

              {/* 服务商选择 */}
              <div className="space-y-1.5">
                <label className="text-xs font-serif font-bold text-stone-800 dark:text-stone-200">
                  服务商：
                </label>
                <select
                  value={activeProviderId}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full text-xs p-2 rounded-xs border-2 border-stone-900 bg-white dark:bg-[#121c13] text-stone-900 dark:text-stone-100 font-mono shadow-[2px_2px_0px_#101711] cursor-pointer"
                >
                  {PROVIDER_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {activePreset.note && (
                  <p className="text-[10px] font-mono text-stone-500 dark:text-stone-400">
                    {activePreset.note}
                  </p>
                )}
              </div>

              {/* 模型：可下拉可选，也可手填（各家模型名变动很快） */}
              <div className="space-y-1.5">
                <label className="text-xs font-serif font-bold text-stone-800 dark:text-stone-200 flex items-center justify-between">
                  <span>模型：</span>
                  <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">
                    可直接手填
                  </span>
                </label>
                <input
                  list="lingolog-model-options"
                  value={formData.modelName}
                  onChange={(e) => handleSettingChange({ modelName: e.target.value })}
                  placeholder="选择或输入模型名"
                  className="w-full text-xs p-2 rounded-xs border-2 border-stone-900 bg-white dark:bg-[#121c13] text-stone-900 dark:text-stone-100 font-mono shadow-[2px_2px_0px_#101711]"
                />
                <datalist id="lingolog-model-options">
                  {activePreset.models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>

              {/* Base URL：只有 OpenAI 兼容协议需要 */}
              {activePreset.provider === 'openai-compatible' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-serif font-bold text-stone-800 dark:text-stone-200">
                    Base URL：
                  </label>
                  <input
                    value={formData.customBaseUrl || ''}
                    onChange={(e) => handleSettingChange({ customBaseUrl: e.target.value })}
                    placeholder={activePreset.baseUrl || 'https://你的服务商地址/v1'}
                    className="w-full text-xs p-2 rounded-xs border-2 border-stone-900 bg-white dark:bg-[#121c13] text-stone-900 dark:text-stone-100 font-mono shadow-[2px_2px_0px_#101711]"
                  />
                  <p className="text-[10px] font-serif text-stone-500 dark:text-stone-400">
                    留空则用默认地址
                    {activePreset.baseUrl ? `：${activePreset.baseUrl}` : '（需自己填）'}
                  </p>
                </div>
              )}

              {/* API 密钥 + 开启 / 关闭引擎 */}
              <div className="space-y-2 pt-2 border-t border-dashed border-stone-300 dark:border-stone-700">
                <ApiEngineControls
                  settings={formData}
                  onSaveSettings={onSaveSettings}
                  onToast={showToast}
                  variant="full"
                  idPrefix="lingolog-engine"
                  onPickModel={(m) => {
                    // 不走 handleSettingChange：那条路会弹「配置已实时保存」，
                    // 盖掉我们更该说的话（改了模型名还得再点一次开启）
                    const next = { ...formData, modelName: m };
                    setFormData(next);
                    onSaveSettings(next);
                  }}
                />
                <p className="text-[10px] font-serif text-stone-500 dark:text-stone-400 leading-relaxed pt-1.5 border-t border-dashed border-stone-300 dark:border-stone-700">
                  <span className="font-bold">密钥隐私说明：</span>
                  只保存在你这台设备的浏览器里，服务端不落盘、不写日志。开启引擎后，每次请求时它会发送到本应用服务端，仅用于转发给你选择的服务商（当前：{activePreset.label}）。
                  <br />
                  <span className="text-[#99332e] dark:text-[#e08b86] font-bold">
                    如果这个网址是别人部署的，或者地址栏是 http:// 而非 https://，请不要填。
                  </span>
                </p>
              </div>
            </div>

            {/* Archive Data Vault & Backup */}
            <div className="bg-[#f4edd3] dark:bg-[#1f2b21] rounded-xs p-5 border-2 border-stone-900 shadow-[4px_4px_0px_#101711] text-stone-900 dark:text-stone-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b-2 border-dashed border-stone-300 dark:border-stone-800">
                <div className="flex items-center gap-2 font-serif-display font-black text-sm">
                  <Shield className="w-4 h-4 text-[#d49e3d]" />
                  <span>卷宗数据备份与安全导出</span>
                </div>
                <FileCheck className="w-3.5 h-3.5 text-stone-400" />
              </div>

              <p className="text-xs font-serif text-stone-600 dark:text-stone-300 leading-relaxed">
                全量导出所有学练电文、生词记忆曲线（SRS）、值机签到热力图及羽毛资产记录。导出的 JSON 文件可在任何设备上随时恢复。
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handleExportJson}
                  className="py-2.5 px-4 rounded-xs bg-[#faf7ee] hover:bg-white dark:bg-[#243427] dark:hover:bg-[#2d4031] border-2 border-stone-900 text-stone-900 dark:text-stone-100 font-serif-display font-bold flex items-center justify-center gap-2 shadow-[2px_2px_0px_#101711] cursor-pointer text-xs active:translate-y-0.5 transition-all"
                >
                  <Download className="w-4 h-4 text-[#d49e3d]" />
                  <span>导出本地卷宗 (JSON)</span>
                </button>

                <label className="py-2.5 px-4 rounded-xs bg-[#faf7ee] hover:bg-white dark:bg-[#243427] dark:hover:bg-[#2d4031] border-2 border-stone-900 text-stone-900 dark:text-stone-100 font-serif-display font-bold flex items-center justify-center gap-2 shadow-[2px_2px_0px_#101711] cursor-pointer text-xs active:translate-y-0.5 transition-all">
                  <Upload className="w-4 h-4 text-[#d49e3d]" />
                  <span>导入卷宗恢复数据</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJson}
                    className="hidden"
                  />
                </label>
              </div>

              {importStatus && (
                <div className="p-2.5 rounded-xs bg-[#bbf7d0]/40 dark:bg-emerald-950/40 border border-emerald-600/60 text-xs font-mono text-emerald-900 dark:text-emerald-200">
                  {importStatus}
                </div>
              )}
            </div>

            {/* Station Office Records & Architecture Info */}
            <div className="bg-[#121c13] rounded-xs p-5 border-2 border-stone-900 shadow-[4px_4px_0px_#0e1610] text-stone-300 space-y-3 font-serif">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <div className="flex items-center gap-2 font-serif-display font-black text-xs text-[#d49e3d]">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>电务总署值机终端规则</span>
                </div>
                <span className="font-mono text-[10px] text-stone-500">
                  BUILD v2.6.4
                </span>
              </div>

              <ul className="text-xs space-y-2 text-stone-400 font-mono">
                <li className="flex items-start gap-2">
                  <span className="text-[#d49e3d] shrink-0">✦</span>
                  <span><strong>离线与隐私</strong>：所有生成的电文与记忆算法均在本地存储，未登录亦可正常学练。</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#d49e3d] shrink-0">✦</span>
                  <span><strong>艾宾浩斯曲线</strong>：系统自动依据遗忘曲线测算最佳复习时段，智能推进电文归档。</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#d49e3d] shrink-0">✦</span>
                  <span><strong>值机热力图</strong>：连续每日值机积累连签记录，漏签可前往进度板块兑换补签磁带。</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
