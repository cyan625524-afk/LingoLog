import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  RefreshCw,
  Copy,
  Check,
  Zap,
  LogOut,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ShieldCheck,
} from 'lucide-react';
import { sound } from '../../utils/audio';
import {
  getSyncConfig,
  saveSyncConfig,
  clearSyncConfig,
  isSyncConfigured,
  generateSyncCode,
  isValidSyncCode,
  pullSync,
  pushSync,
  forcePull,
  forcePush,
  describeSyncResult,
  SyncResult,
} from '../../utils/sync';
import { UserProfile } from '../../types';

interface SyncLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onSaveUserProfile: (p: UserProfile) => void;
  onSyncSuccess: () => void;
}

export const SyncLoginModal: React.FC<SyncLoginModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onSaveUserProfile,
  onSyncSuccess,
}) => {
  const [syncConfig, setSyncConfig] = useState(() => getSyncConfig());
  const [endpointInput, setEndpointInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [conflictResult, setConflictResult] = useState<SyncResult | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showFullCode, setShowFullCode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSyncConfig();
      setSyncConfig(cfg);
      setEndpointInput(cfg.endpoint || '');
      setCodeInput(cfg.code || '');
      setStatusMessage(null);
      setConflictResult(null);
      setCopiedCode(false);
    }
  }, [isOpen]);

  // Escape listener
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

  const isConfigured = isSyncConfigured();

  // 1. Generate new sync code
  const handleGenerateCode = () => {
    sound.playKeyClick();
    const newCode = generateSyncCode();
    setCodeInput(newCode);
    setStatusMessage({
      type: 'info',
      text: '已生成全新高熵同步码！请妥善保存，在其他设备填入相同代码即可多端互通。',
    });
  };

  // 2. Connect & Login
  const handleConnect = async () => {
    sound.playKeyClick();
    setStatusMessage(null);
    setConflictResult(null);

    const endpoint = endpointInput.trim();
    const code = codeInput.trim();

    if (!endpoint) {
      setStatusMessage({ type: 'error', text: '请填写 Cloudflare Worker 部署地址' });
      return;
    }
    if (!isValidSyncCode(code)) {
      setStatusMessage({ type: 'error', text: '同步码格式不正确（需为 20-64 位防混淆字母与数字）' });
      return;
    }

    const saveRes = saveSyncConfig(endpoint, code);
    if (!saveRes.ok) {
      setStatusMessage({ type: 'error', text: saveRes.message || '本地配置保存失败' });
      return;
    }

    setIsConnecting(true);
    try {
      // First try pulling from cloud
      const pullRes = await pullSync(15000);
      if (pullRes.state === 'conflict') {
        setConflictResult(pullRes);
        setStatusMessage({ type: 'info', text: '云端与本地均有改动，请选择保留哪一方数据。' });
        setIsConnecting(false);
        return;
      }

      if (pullRes.state === 'error' || pullRes.state === 'offline') {
        setStatusMessage({ type: 'error', text: pullRes.message || '同步失败，请检查服务地址与网络' });
        setIsConnecting(false);
        return;
      }

      // If remote has no data yet (rev 0), push local state to remote
      if (pullRes.rev === 0 || pullRes.state === 'unchanged') {
        const pushRes = await pushSync();
        if (pushRes.state === 'pushed') {
          sound.playSuccess();
          const cfg = getSyncConfig();
          setSyncConfig(cfg);
          onSaveUserProfile({
            ...userProfile,
            isLoggedIn: true,
            role: '特级电报员 (已云同步)',
          });
          setStatusMessage({ type: 'success', text: `登录并初始化成功！已将本地档案上传至云端 (v${pushRes.rev})。` });
          onSyncSuccess();
          setIsConnecting(false);
          return;
        }
      }

      sound.playSuccess();
      const cfg = getSyncConfig();
      setSyncConfig(cfg);
      onSaveUserProfile({
        ...userProfile,
        isLoggedIn: true,
        role: '特级电报员 (已云同步)',
      });
      setStatusMessage({ type: 'success', text: `连接成功！${describeSyncResult(pullRes)}` });
      onSyncSuccess();
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: `连接异常: ${e?.message || '未知错误'}` });
    } finally {
      setIsConnecting(false);
    }
  };

  // 3. Manual Pull
  const handleManualPull = async () => {
    sound.playKeyClick();
    setIsConnecting(true);
    setStatusMessage(null);
    try {
      const res = await pullSync(15000);
      if (res.state === 'conflict') {
        setConflictResult(res);
        setStatusMessage({ type: 'info', text: '云端与本地均有改动，请选择保留哪一份。' });
      } else if (res.state === 'pulled') {
        sound.playSuccess();
        setSyncConfig(getSyncConfig());
        onSyncSuccess();
        setStatusMessage({ type: 'success', text: `拉取成功！已同步至云端最新版本 v${res.rev}` });
      } else {
        setStatusMessage({ type: 'info', text: describeSyncResult(res) });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: `拉取异常: ${e?.message || '未知错误'}` });
    } finally {
      setIsConnecting(false);
    }
  };

  // 4. Manual Push
  const handleManualPush = async () => {
    sound.playKeyClick();
    setIsConnecting(true);
    setStatusMessage(null);
    try {
      const res = await pushSync();
      if (res.state === 'conflict') {
        setConflictResult(res);
        setStatusMessage({ type: 'info', text: '云端版本更新，未覆盖。请选择操作方案。' });
      } else if (res.state === 'pushed') {
        sound.playSuccess();
        setSyncConfig(getSyncConfig());
        setStatusMessage({ type: 'success', text: `推送成功！云端版本已递增至 v${res.rev}` });
      } else {
        setStatusMessage({ type: 'info', text: describeSyncResult(res) });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: `推送异常: ${e?.message || '未知错误'}` });
    } finally {
      setIsConnecting(false);
    }
  };

  // 5. Force Pull / Force Push for conflict
  const handleResolveConflict = async (resolution: 'cloud' | 'local') => {
    sound.playKeyClick();
    setIsConnecting(true);
    try {
      if (resolution === 'cloud') {
        const res = await forcePull();
        sound.playSuccess();
        setSyncConfig(getSyncConfig());
        onSyncSuccess();
        setConflictResult(null);
        setStatusMessage({ type: 'success', text: `已强制使用云端数据覆盖本地 (v${res.rev})` });
      } else {
        const res = await forcePush();
        sound.playSuccess();
        setSyncConfig(getSyncConfig());
        setConflictResult(null);
        setStatusMessage({ type: 'success', text: `已强制使用本地数据覆盖云端 (v${res.rev})` });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: `处理失败: ${e?.message || '未知错误'}` });
    } finally {
      setIsConnecting(false);
    }
  };

  // 6. Logout / Disconnect
  const handleLogout = () => {
    sound.playKeyClick();
    if (window.confirm('确定要退出多端同步吗？本地学习记录会完整保留，但不再与云端自动同步。')) {
      clearSyncConfig();
      setSyncConfig(getSyncConfig());
      setEndpointInput('');
      setCodeInput('');
      onSaveUserProfile({
        ...userProfile,
        isLoggedIn: false,
        role: '访客学员 (本地离线)',
      });
      setStatusMessage({ type: 'info', text: '已断开云端同步并切换为本地访客模式。' });
    }
  };

  const copySyncCode = () => {
    sound.playKeyClick();
    navigator.clipboard.writeText(syncConfig.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div
      id="sync-login-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sound.playKeyClick();
          onClose();
        }
      }}
      className="fixed inset-0 z-[60] bg-stone-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#f4edd3] border-2 border-stone-900 rounded-xs shadow-[8px_8px_0px_#0e1610] flex flex-col text-stone-900 overflow-hidden cursor-default"
      >
        {/* Mustard Top Header */}
        <div className="bg-[#d49e3d] px-4 py-3 border-b-2 border-stone-900 flex items-center justify-between text-stone-900 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#243427] inline-block shadow-[0_0_6px_#243427]" />
            <span className="font-serif-display font-black text-sm tracking-wide">
              — 多端同步与身份认证 (Cloudflare D1) —
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
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="punch-hole-dot" />
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 text-xs font-sans">
          {/* Status Message Alert */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xs border-2 text-xs font-medium flex items-start gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : statusMessage.type === 'error'
                  ? 'bg-red-100 dark:bg-red-950/40 border-red-800 text-red-900 dark:text-red-200'
                  : 'bg-amber-100 dark:bg-amber-950/40 border-amber-800 text-amber-900 dark:text-amber-200'
              }`}
            >
              <span>{statusMessage.type === 'success' ? '✓' : '⚠️'}</span>
              <span className="flex-1">{statusMessage.text}</span>
            </div>
          )}

          {/* Conflict Resolution Box */}
          {conflictResult && (
            <div className="p-3 bg-amber-50 border-2 border-amber-700 rounded-xs space-y-2 text-amber-950">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span>检测到双端数据版本冲突</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                云端版本与当前设备均有新修改。请决定保留哪一端的内容：
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => handleResolveConflict('cloud')}
                  className="py-1.5 px-2 bg-stone-900 text-white font-bold rounded-xs cursor-pointer hover:bg-stone-800 flex items-center justify-center gap-1"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>以云端为准 (覆盖本地)</span>
                </button>
                <button
                  onClick={() => handleResolveConflict('local')}
                  className="py-1.5 px-2 bg-[#d49e3d] text-stone-950 font-bold border border-stone-900 rounded-xs cursor-pointer hover:bg-[#c99333] flex items-center justify-center gap-1"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span>以本地为准 (覆盖云端)</span>
                </button>
              </div>
            </div>
          )}

          {/* Content: Mode Branch */}
          {isConfigured ? (
            /* Logged in / Configured State */
            <div className="space-y-4">
              <div className="bg-[#eee5c6] p-4 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] space-y-3">
                <div className="flex items-center justify-between border-b border-stone-400 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block shadow-[0_0_6px_#059669]" />
                    <span className="font-serif-display font-black text-sm text-stone-900">
                      云端同步已连接
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-xs bg-[#243427] text-[#d49e3d]">
                    版本 v{syncConfig.lastRev}
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 font-mono block">同步服务节点</span>
                    <span className="font-mono text-xs text-stone-800 break-all select-all font-semibold">
                      {syncConfig.endpoint}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-stone-500 font-mono">专属同步码 (唯一凭证)</span>
                      <button
                        onClick={() => setShowFullCode(!showFullCode)}
                        className="text-[10px] text-[#d49e3d] hover:underline cursor-pointer font-mono"
                      >
                        {showFullCode ? '隐藏' : '明文显示'}
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex-1 font-mono text-xs p-1.5 bg-white border border-stone-900 rounded-xs select-all truncate">
                        {showFullCode
                          ? syncConfig.code
                          : `${syncConfig.code.slice(0, 5)}-****-****-${syncConfig.code.slice(-5)}`}
                      </div>
                      <button
                        onClick={copySyncCode}
                        className="p-1.5 bg-[#faf7ee] hover:bg-white text-stone-900 border border-stone-900 rounded-xs flex items-center gap-1 cursor-pointer font-bold"
                        title="复制同步码"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCode ? '已复制' : '复制'}</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-stone-500 mt-1">
                      💡 在手机或另一台电脑上点击头像，填入相同服务地址和此同步码，即可多端漫游。
                    </p>
                  </div>

                  {syncConfig.lastSyncAt && (
                    <div className="text-[10px] text-stone-500 font-mono pt-1">
                      最近同步时间: {new Date(syncConfig.lastSyncAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleManualPull}
                  disabled={isConnecting}
                  className="py-2 px-3 bg-[#faf7ee] hover:bg-white text-stone-900 font-serif-display font-black border-2 border-stone-900 rounded-xs shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#d49e3d] ${isConnecting ? 'animate-spin' : ''}`} />
                  <span>立即拉取云端</span>
                </button>

                <button
                  onClick={handleManualPush}
                  disabled={isConnecting}
                  className="py-2 px-3 bg-[#d49e3d] hover:bg-[#c99333] text-stone-950 font-serif-display font-black border-2 border-stone-900 rounded-xs shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>立即推送到云端</span>
                </button>
              </div>

              <div className="pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full py-2 bg-stone-200 hover:bg-red-100 text-stone-700 hover:text-red-700 font-bold border border-stone-400 rounded-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>断开多端同步 / 退出登录</span>
                </button>
              </div>
            </div>
          ) : (
            /* Not logged in: Configure Form */
            <div className="space-y-3.5">
              <div className="bg-[#eee5c6] p-3 rounded-xs border border-stone-900 text-stone-800 leading-relaxed text-[11px]">
                <div className="font-bold flex items-center gap-1 text-stone-900 mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>纯客户端 130-bit 加密凭证</span>
                </div>
                无需账号密码。通过 Cloudflare Worker + D1 数据库托管，同步码仅在本地和传输头中使用，服务端只存哈希，不收集任何个人隐私。
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-1 font-serif-display">
                  Cloudflare Worker 同步节点地址
                </label>
                <input
                  type="text"
                  value={endpointInput}
                  onChange={(e) => setEndpointInput(e.target.value)}
                  placeholder="https://lingolog-sync.<your-subdomain>.workers.dev"
                  className="w-full p-2 bg-white border-2 border-stone-900 rounded-xs font-mono text-xs text-stone-900 placeholder:text-stone-400 focus:outline-hidden"
                />
                <span className="text-[10px] text-stone-500 mt-0.5 block font-mono">
                  部署方法见项目 `cloudflare-sync/README.md`
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-stone-800 font-serif-display">
                    专属电报同步码 (26 位)
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    className="text-[10px] font-bold text-[#d49e3d] hover:underline flex items-center gap-0.5 cursor-pointer font-mono"
                  >
                    <Zap className="w-3 h-3" />
                    <span>生成新同步码</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="例如: 01234-56789-ABCDE-FGHJK-MNPQR"
                  className="w-full p-2 bg-white border-2 border-stone-900 rounded-xs font-mono text-xs text-stone-900 placeholder:text-stone-400 uppercase tracking-wider focus:outline-hidden"
                />
                <span className="text-[10px] text-stone-500 mt-0.5 block">
                  第一台设备点右上角“生成新同步码”；后续设备填入相同代码即可合并。
                </span>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full py-2.5 bg-[#d49e3d] hover:bg-[#c99333] active:translate-y-0.5 text-stone-950 font-serif-display font-black text-sm border-2 border-stone-900 rounded-xs shadow-[2px_2px_0px_#101711] flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  <Cloud className="w-4 h-4" />
                  <span>{isConnecting ? '正在连通云端数据库...' : '连接并登录多端同步'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
