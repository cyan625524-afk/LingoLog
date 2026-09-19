import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  Bell,
  Check,
  Smartphone,
  QrCode,
  Send,
  HelpCircle,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { AppSettings } from '../../types';
import { saveDailyReminderConfig, fetchDailyReminderConfig } from '../../utils/supabase';

interface WechatReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
}

export const WechatReminderModal: React.FC<WechatReminderModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [enabled, setEnabled] = useState<boolean>(settings.wxpusherEnabled ?? false);
  const [reminderTime, setReminderTime] = useState<string>(settings.reminderTime || '21:00');
  const [uid, setUid] = useState<string>(settings.wxpusherUid || '');
  const [customAppToken, setCustomAppToken] = useState<string>(settings.wxpusherAppToken || '');

  const DEFAULT_OFFICIAL_QR = 'https://open.weixin.qq.com/qr/code?username=wxpusher';

  // 微信带参二维码相关状态
  const [qrUrl, setQrUrl] = useState<string>(DEFAULT_OFFICIAL_QR);
  const [qrCodeId, setQrCodeId] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  // 操作状态
  const [isCheckingScan, setIsCheckingScan] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEnabled(settings.wxpusherEnabled ?? false);
      setReminderTime(settings.reminderTime || '21:00');
      setUid(settings.wxpusherUid || '');
      setCustomAppToken(settings.wxpusherAppToken || '');
      setToastMessage(null);
      setQrUrl(DEFAULT_OFFICIAL_QR);

      // 如果本地没有 uid，尝试异步从云端检测拉取（保证跨端同步）
      if (!settings.wxpusherUid) {
        fetchDailyReminderConfig().then((cloudCfg) => {
          if (cloudCfg && cloudCfg.wxpusherUid) {
            setUid(cloudCfg.wxpusherUid);
            setEnabled(cloudCfg.enabled);
            if (cloudCfg.reminderTime) setReminderTime(cloudCfg.reminderTime);
            if (cloudCfg.customAppToken) setCustomAppToken(cloudCfg.customAppToken);
            onSaveSettings({
              ...settings,
              wxpusherUid: cloudCfg.wxpusherUid,
              wxpusherEnabled: cloudCfg.enabled,
              reminderTime: cloudCfg.reminderTime || settings.reminderTime || '21:00',
              wxpusherAppToken: cloudCfg.customAppToken || settings.wxpusherAppToken,
            });
          }
        }).catch(() => {});
      }

      // 尝试向服务端获取专属带参二维码
      loadQrCode();
    }
  }, [isOpen, settings]);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 请求微信关注绑定二维码
  const loadQrCode = async (overrideToken?: string) => {
    setQrLoading(true);
    setQrError(null);
    try {
      const res = await fetch('/api/wxpusher-qrcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appToken: overrideToken || customAppToken || undefined,
          extra: `lingolog_${Date.now()}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && (data.url || data.code)) {
        if (data.url) setQrUrl(data.url);
        if (data.code) setQrCodeId(data.code);
      } else {
        // 服务端若未配置专属 AppToken，使用官方直通二维码
        setQrUrl(DEFAULT_OFFICIAL_QR);
        setQrCodeId(null);
      }
    } catch {
      // 容灾直接使用官方直通二维码
      setQrUrl(DEFAULT_OFFICIAL_QR);
      setQrCodeId(null);
    } finally {
      setQrLoading(false);
    }
  };

  // 检查扫码关注状态并提取 UID
  const handleCheckScan = async () => {
    sound.playKeyClick();
    if (!qrCodeId) {
      showToast('info', '扫码关注后，请在公众号内点击菜单「我的」→「我的UID」，复制粘贴到下方输入框即可完成绑定！');
      return;
    }
    setIsCheckingScan(true);
    try {
      const res = await fetch(`/api/wxpusher-check-scan?code=${encodeURIComponent(qrCodeId)}`);
      const data = await res.json().catch(() => ({}));
      if (data.success && data.scanned && data.uid) {
        sound.playSuccess();
        setUid(data.uid);
        setEnabled(true);
        showToast('success', `扫码绑定成功！已获取 UID: ${data.uid}`);
      } else {
        showToast('info', '尚未检测到扫码，也可在公众号菜单【我的】→【我的UID】中直接复制粘贴');
      }
    } catch {
      showToast('info', '扫码关注后，请在公众号菜单【我的】→【我的UID】复制填入下方');
    } finally {
      setIsCheckingScan(false);
    }
  };

  // 发送一条微信测试电报
  const handleSendTestMessage = async () => {
    sound.playKeyClick();
    const cleanUid = uid.trim();
    if (!cleanUid) {
      showToast('error', '请先微信扫码或手动填入微信 UID');
      return;
    }

    setIsTesting(true);
    try {
      const res = await fetch('/api/wxpusher-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: cleanUid,
          appToken: customAppToken.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        sound.playSuccess();
        showToast('success', '⚡ 测试电报已成功投递！请查看手机微信通知与状态栏');
      } else {
        showToast('error', data.error || data.message || '测试消息投递失败');
      }
    } catch {
      showToast('error', '网络异常，测试消息发送失败');
    } finally {
      setIsTesting(false);
    }
  };

  // 保存设置并同步至 Supabase
  const handleSave = async () => {
    sound.playKeyClick();
    const cleanUid = uid.trim();
    const nextSettings: AppSettings = {
      ...settings,
      wxpusherEnabled: enabled && Boolean(cleanUid),
      wxpusherUid: cleanUid,
      reminderTime: reminderTime,
      wxpusherAppToken: customAppToken.trim() || undefined,
    };

    onSaveSettings(nextSettings);

    // 异步同步到 Supabase 云端，支持云端巡检定时任务
    saveDailyReminderConfig({
      enabled: Boolean(nextSettings.wxpusherEnabled),
      reminderTime: nextSettings.reminderTime,
      wxpusherUid: nextSettings.wxpusherUid || '',
      customAppToken: nextSettings.wxpusherAppToken,
    }).catch((err) => {
      console.warn('[WechatReminderModal] Supabase 同步提醒设置失败:', err);
    });

    sound.playSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-lg bg-[#f4edd3] dark:bg-[#1c271e] text-stone-900 dark:text-stone-100 rounded-xs border-2 border-stone-900 shadow-[6px_6px_0px_#101711] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-[#e8dfc3] dark:bg-[#162018] border-b-2 border-stone-900">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#99332e] dark:text-[#d49e3d]" />
            <h2 className="font-serif-display font-black text-sm sm:text-base tracking-wide text-stone-900 dark:text-stone-100">
              微信每日学习提醒 · 状态栏推送
            </h2>
          </div>
          <button
            onClick={() => {
              sound.playKeyClick();
              onClose();
            }}
            className="p-1 rounded-xs hover:bg-stone-300 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scrollable */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 font-serif text-xs">
          {/* Toast Notice */}
          {toastMessage && (
            <div
              className={`p-2.5 rounded-xs border border-stone-900 font-mono text-[11px] font-bold flex items-center gap-2 shadow-[2px_2px_0px_#101711] ${
                toastMessage.type === 'success'
                  ? 'bg-[#c5e1a5] text-stone-950'
                  : toastMessage.type === 'error'
                  ? 'bg-[#ffcdd2] text-stone-950'
                  : 'bg-[#fff9c4] text-stone-950'
              }`}
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>{toastMessage.text}</span>
            </div>
          )}

          {/* Current Status Card */}
          <div className="bg-[#fffdf7] dark:bg-[#121c14] p-3 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-bold flex items-center gap-1.5 text-stone-900 dark:text-stone-100">
                <Smartphone className="w-3.5 h-3.5 text-[#d49e3d]" />
                <span>微信接收终端状态</span>
              </div>
              <div className="font-mono text-[10px] text-stone-500 dark:text-stone-400">
                {uid ? (
                  <span className="text-[#2e7d32] dark:text-[#81c784] font-bold">
                    ● 已绑定微信 UID: {uid.slice(0, 10)}...{uid.slice(-4)}
                  </span>
                ) : (
                  <span className="text-stone-500">○ 尚未绑定（请扫码关注或填入 UID）</span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                sound.playKeyClick();
                setEnabled(!enabled);
              }}
              className={`px-3 py-1 text-xs font-serif-display font-bold rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] transition-all active:translate-y-0.5 ${
                enabled && uid
                  ? 'bg-[#d49e3d] text-stone-950'
                  : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
              }`}
            >
              {enabled && uid ? '提醒已开启' : '已关闭'}
            </button>
          </div>

          {/* Step 1: Bind WeChat */}
          <div className="bg-[#fffdf7] dark:bg-[#121c14] p-3.5 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] space-y-3">
            <div className="font-serif-display font-bold text-xs text-stone-900 dark:text-stone-100 flex items-center justify-between border-b border-dashed border-stone-300 dark:border-stone-800 pb-2">
              <span className="flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-[#d49e3d]" />
                第一步：微信扫码关注绑定
              </span>
              <button
                onClick={() => loadQrCode()}
                className="text-[10px] font-mono text-[#b45309] dark:text-[#d49e3d] hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-2.5 h-2.5" /> 刷新二维码
              </button>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
              <div className="w-36 h-36 bg-white border-2 border-stone-900 rounded-xs flex items-center justify-center p-1 shadow-[2px_2px_0px_#101711] shrink-0">
                {qrLoading ? (
                  <div className="flex flex-col items-center gap-1.5 text-stone-400">
                    <RefreshCw className="w-5 h-5 animate-spin text-[#d49e3d]" />
                    <span className="text-[10px] font-mono">生成电波码...</span>
                  </div>
                ) : qrUrl ? (
                  <img
                    src={qrUrl}
                    alt="微信扫码关注"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-2 text-stone-500 font-mono text-[10px]">
                    {qrError || '微信二维码加载失败'}
                    <button
                      onClick={() => loadQrCode()}
                      className="mt-2 block mx-auto px-2 py-0.5 bg-[#d49e3d] text-stone-950 font-bold rounded-xs"
                    >
                      重试
                    </button>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="flex-1 space-y-2 text-stone-700 dark:text-stone-300 text-[11px] leading-relaxed">
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>
                    使用手机微信扫描左侧二维码，关注<strong>「开发者服务 (WxPusher)」</strong>公众号。
                  </li>
                  <li>
                    关注后微信会自动推送你的 <strong>UID</strong>；亦可点击公众号菜单<strong>「我的」→「我的UID」</strong>直接复制。
                  </li>
                  <li>
                    将获得的 <code className="bg-stone-200 dark:bg-stone-800 px-1 py-0.5 rounded text-stone-900 dark:text-stone-100 font-mono">UID_xxxx</code> 填入下方输入框，点击保存即可生效！
                  </li>
                </ol>

                <div className="pt-1 flex flex-wrap gap-2">
                  <button
                    onClick={handleCheckScan}
                    disabled={isCheckingScan}
                    className="px-3 py-1 bg-[#d49e3d] hover:bg-[#c38e30] text-stone-950 font-bold font-serif-display text-[11px] rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center gap-1.5 transition-all active:translate-y-0.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {isCheckingScan ? '正在查询扫码...' : '我已扫码，检查绑定状态'}
                  </button>
                </div>
              </div>
            </div>

            {/* Manual UID Field */}
            <div className="pt-2 border-t border-dashed border-stone-300 dark:border-stone-800 space-y-1">
              <label className="text-[10px] font-mono text-stone-500 dark:text-stone-400 flex items-center justify-between">
                <span>接收端 UID 或专属推送令牌 SPT（二选一）：</span>
                {uid && (
                  <span className="text-[#2e7d32] dark:text-[#81c784] font-bold">
                    {uid.startsWith('SPT_') ? '✓ 专属极简令牌 (SPT)' : '✓ 标准接收端 (UID)'}
                  </span>
                )}
              </label>
              <input
                type="text"
                placeholder="填入 UID_xxxx 或 App 中的专属推送令牌 SPT_xxxx"
                value={uid}
                onChange={(e) => {
                  setUid(e.target.value.trim());
                  if (e.target.value.trim()) setEnabled(true);
                }}
                className="w-full text-xs font-mono p-2 rounded-xs border-2 border-stone-900 bg-white dark:bg-[#1e2a20] text-stone-900 dark:text-stone-100 shadow-[1px_1px_0px_#101711]"
              />
            </div>
          </div>

          {/* Step 2: Reminder Time & Rules */}
          <div className="bg-[#fffdf7] dark:bg-[#121c14] p-3.5 rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] space-y-3">
            <div className="font-serif-display font-bold text-xs text-stone-900 dark:text-stone-100 flex items-center gap-1.5 border-b border-dashed border-stone-300 dark:border-stone-800 pb-2">
              <Clock className="w-3.5 h-3.5 text-[#d49e3d]" />
              第二步：设定每日巡检时间
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="font-bold text-stone-900 dark:text-stone-100">
                  每日状态栏提醒时间
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                  若到点检测到今日尚未学习打卡，微信将在此时段弹出通知
                </div>
              </div>

              <select
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="p-1.5 text-xs font-mono font-bold rounded-xs border-2 border-stone-900 bg-white dark:bg-[#1e2a20] text-stone-900 dark:text-stone-100 shadow-[1px_1px_0px_#101711] cursor-pointer"
              >
                <option value="19:00">19:00 (傍晚温习)</option>
                <option value="20:00">20:00 (黄金时段)</option>
                <option value="20:30">20:30 (夜间值机)</option>
                <option value="21:00">21:00 (睡前打卡 · 推荐)</option>
                <option value="21:30">21:30 (睡前半小时)</option>
                <option value="22:00">22:00 (深夜补救)</option>
                <option value="22:30">22:30 (熄灯前值机)</option>
              </select>
            </div>

            {/* Smart Silent Logic Badge */}
            <div className="bg-[#f0ead4] dark:bg-[#1a251b] p-2.5 rounded-xs border border-stone-300 dark:border-stone-800 flex items-start gap-2 text-[11px] text-stone-700 dark:text-stone-300">
              <ShieldCheck className="w-4 h-4 text-[#2e7d32] dark:text-[#81c784] shrink-0 mt-0.5" />
              <div>
                <strong className="text-stone-900 dark:text-stone-100">智能防打扰机制：</strong>
                当天如果在电台完成了任意卡片复习或口语录音测评，系统将自动记录为已学并<strong>静默跳过</strong>，绝不打扰你的休息。
              </div>
            </div>
          </div>

          {/* Test & Advanced Settings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <button
                onClick={handleSendTestMessage}
                disabled={isTesting || !uid.trim()}
                className={`px-3 py-1.5 text-xs font-serif-display font-bold rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] flex items-center gap-1.5 transition-all active:translate-y-0.5 ${
                  uid.trim()
                    ? 'bg-[#293d2b] hover:bg-[#354f37] text-stone-100'
                    : 'bg-stone-300 text-stone-500 cursor-not-allowed'
                }`}
              >
                <Send className="w-3.5 h-3.5 text-[#d49e3d]" />
                {isTesting ? '正在发送测试电报...' : '⚡ 发送一条测试电报到微信'}
              </button>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-[11px] font-mono text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center gap-1"
              >
                <span>高级设置</span>
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showAdvanced && (
              <div className="bg-[#fffdf7] dark:bg-[#121c14] p-3 rounded-xs border-2 border-dashed border-stone-400 dark:border-stone-700 space-y-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-stone-600 dark:text-stone-400">
                    自定义 WxPusher AppToken（可选，默认使用站点公共服务）：
                  </label>
                  <input
                    type="text"
                    placeholder="AT_xxxxxxxxxxxxxxxxxxxxxxxx"
                    value={customAppToken}
                    onChange={(e) => setCustomAppToken(e.target.value.trim())}
                    className="w-full text-xs font-mono p-1.5 rounded-xs border border-stone-900 bg-white dark:bg-[#1e2a20] text-stone-900 dark:text-stone-100"
                  />
                  <p className="text-[10px] text-stone-500">
                    如需使用自己的微信公众号应用，可在{' '}
                    <a
                      href="https://wxpusher.zjiecode.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#b45309] dark:text-[#d49e3d] underline"
                    >
                      WxPusher 平台
                    </a>{' '}
                    免费注册并填入你的 AppToken。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#e8dfc3] dark:bg-[#162018] border-t-2 border-stone-900 flex items-center justify-between gap-3">
          <div className="text-[10px] font-mono text-stone-500 dark:text-stone-400 flex items-center gap-1">
            <Radio className="w-3 h-3 text-[#d49e3d]" />
            <span>基于 WxPusher 微信状态栏推送</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playKeyClick();
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-xs text-xs font-serif font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-800 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-[#d49e3d] hover:bg-[#c38e30] text-stone-950 text-xs font-serif-display font-black rounded-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] transition-all active:translate-y-0.5"
            >
              保存提醒配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
