import React, { useEffect, useState } from 'react';
import { Key, Eye, EyeOff, Power, PowerOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { AppSettings } from '../../types';
import { sound } from '../../utils/audio';
import {
  verifyApiEngine,
  resolveEngineStatus,
  describeEngine,
} from '../../utils/apiEngine';

interface ApiEngineControlsProps {
  settings: AppSettings;
  onSaveSettings: (next: AppSettings) => void;
  /** full = 「我的」页（含隐私说明）；compact = 侧边抽屉 */
  variant?: 'full' | 'compact';
  /** 操作结果提示（复用父级的 toast） */
  onToast?: (msg: string) => void;
  /** 同一页面出现多个实例时用来区分输入框 id */
  idPrefix?: string;
  /**
   * 自检因为「模型名过期」失败时，把服务端查到的可用模型名交给父级写回设置。
   * 不给也可以，那就退化成只显示一行文字。
   */
  onPickModel?: (modelName: string) => void;
}

type CheckState =
  | { phase: 'idle' }
  | { phase: 'testing' }
  | { phase: 'ok'; message: string }
  | { phase: 'fail'; message: string; availableModels?: string[] };

/**
 * 智能翻译引擎的开关控件。
 *
 * 设计要点：密钥输入框里的是**草稿**，点了「开启引擎」才会生效。
 * 这和 App 里其他「改一下立刻存」的设置不同，是刻意的 —— 密钥一旦错了，
 * 用户需要的是明确告知，而不是静默保存。
 */
export const ApiEngineControls: React.FC<ApiEngineControlsProps> = ({
  settings,
  onSaveSettings,
  variant = 'full',
  onToast,
  idPrefix = 'engine',
  onPickModel,
}) => {
  const isFull = variant === 'full';
  const [keyDraft, setKeyDraft] = useState(settings.customApiKey || '');
  const [reveal, setReveal] = useState(false);
  const [check, setCheck] = useState<CheckState>({ phase: 'idle' });

  // 保存过的密钥被外部改动时（导入备份 / 同步拉取）同步回输入框
  useEffect(() => {
    setKeyDraft(settings.customApiKey || '');
  }, [settings.customApiKey]);

  const status = resolveEngineStatus(settings);
  const trimmedDraft = keyDraft.trim();
  const isTesting = check.phase === 'testing';
  const draftNotSaved = trimmedDraft !== (settings.customApiKey || '').trim();

  const handleEnable = async () => {
    sound.playKeyClick();
    if (!trimmedDraft) {
      setCheck({ phase: 'fail', message: '请先填入 API 密钥。' });
      return;
    }

    setCheck({ phase: 'testing' });
    const result = await verifyApiEngine({
      apiKey: trimmedDraft,
      provider: settings.apiProvider,
      modelName: settings.modelName,
      baseUrl: settings.customBaseUrl,
    });

    if (result.ok) {
      sound.playSuccess?.();
      onSaveSettings({
        ...settings,
        customApiKey: trimmedDraft,
        apiEnabled: true,
        apiVerifiedAt: new Date().toISOString(),
      });
      setCheck({ phase: 'ok', message: result.message });
      onToast?.('引擎已开启');
    } else {
      // 自检失败不写入，保持原状 —— 宁可维持旧配置，也不要留一个「开着的坏引擎」
      setCheck({
        phase: 'fail',
        message: result.message,
        availableModels: result.availableModels,
      });
      onToast?.('自检未通过，引擎未开启');
    }
  };

  const handleDisable = () => {
    sound.playKeyClick();
    onSaveSettings({ ...settings, apiEnabled: false });
    setCheck({ phase: 'idle' });
    onToast?.('引擎已关闭，改走公开翻译');
  };

  const handleClearKey = () => {
    sound.playKeyClick();
    setKeyDraft('');
    setCheck({ phase: 'idle' });
    onSaveSettings({ ...settings, customApiKey: '', apiEnabled: false });
    onToast?.('已清除本地保存的密钥');
  };

  // ── 样式按 variant 分档，行为完全一致 ──────────────────────────────
  const inputCls = isFull
    ? 'w-full text-xs p-2 pr-9 rounded-xs border-2 border-stone-900 bg-white dark:bg-[#121c13] text-stone-900 dark:text-stone-100 font-mono shadow-[2px_2px_0px_#101711]'
    : 'w-full text-xs p-1.5 pr-8 rounded-xs border border-stone-900 bg-[#faf7ee] text-stone-900 font-mono';
  const btnCls = isFull
    ? 'px-3.5 py-2 rounded-xs text-xs font-serif-display font-bold border-2 border-stone-900 shadow-[2px_2px_0px_#101711] cursor-pointer transition-all active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5'
    : 'px-2.5 py-1.5 rounded-xs text-[11px] font-serif-display font-bold border border-stone-900 shadow-[1px_1px_0px_#101711] cursor-pointer transition-all active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1';
  const boxCls = isFull
    ? 'p-2.5 rounded-xs border-2 border-stone-900/40 text-[11px] font-serif leading-relaxed'
    : 'p-2 rounded-xs border border-stone-900/30 text-[10px] font-serif leading-relaxed';

  const statusDot =
    status === 'on' ? 'bg-emerald-600' : status === 'off' ? 'bg-stone-400' : 'bg-stone-300';
  const statusText =
    status === 'on' ? '已开启' : status === 'off' ? '已关闭' : '未配置';
  const statusHint =
    status === 'on'
      ? describeEngine(settings)
      : status === 'off'
      ? '密钥已保存但未启用，当前走公开翻译'
      : '未填密钥，当前走公开翻译';

  const verifiedLabel =
    status === 'on' && settings.apiVerifiedAt
      ? ` · ${new Date(settings.apiVerifiedAt).toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })} 验证通过`
      : '';

  return (
    <div className={isFull ? 'space-y-1.5 pt-1' : 'space-y-1.5'}>
      <label
        className={
          isFull
            ? 'text-xs font-serif font-bold text-stone-800 dark:text-stone-200 flex items-center justify-between'
            : 'text-[11px] text-stone-600 font-serif flex items-center gap-1'
        }
      >
        <span className="flex items-center gap-1.5">
          <Key className={isFull ? 'w-3.5 h-3.5 text-[#d49e3d]' : 'w-3 h-3'} />
          <span>{isFull ? 'API 密钥：' : 'API Key：'}</span>
        </span>
        {isFull && (
          <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">
            需点「开启引擎」才生效
          </span>
        )}
      </label>

      {/* 密钥输入（草稿）+ 显隐切换 */}
      <div className="relative">
        <input
          id={`${idPrefix}-key-input`}
          type={reveal ? 'text' : 'password'}
          value={keyDraft}
          onChange={(e) => {
            setKeyDraft(e.target.value);
            setCheck({ phase: 'idle' });
          }}
          placeholder={
            isFull
              ? `粘贴 ${describeEngine(settings).split(' · ')[0]} 的密钥`
              : '粘贴密钥'
          }
          autoComplete="off"
          spellCheck={false}
          className={inputCls}
        />
        <button
          type="button"
          onClick={() => {
            sound.playKeyClick();
            setReveal((v) => !v);
          }}
          title={reveal ? '隐藏密钥' : '显示密钥（便于核对是否复制完整）'}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 cursor-pointer"
        >
          {reveal ? (
            <EyeOff className={isFull ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
          ) : (
            <Eye className={isFull ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
          )}
        </button>
      </div>

      {/* 状态条：三态 + 说明 */}
      <div
        className={`${boxCls} flex items-center gap-2 ${
          status === 'on'
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-700/50 text-emerald-900 dark:text-emerald-200'
            : 'bg-stone-100 dark:bg-stone-900/40 border-stone-400/60 text-stone-600 dark:text-stone-300'
        }`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />
        <span className="font-bold shrink-0">{statusText}</span>
        <span className="truncate">
          {statusHint}
          {verifiedLabel}
        </span>
      </div>

      {/* 输入框里有未开启的新密钥 —— 这是最容易让人困惑的状态，必须点破 */}
      {draftNotSaved && !isTesting && (
        <p className={`${boxCls} bg-amber-50 dark:bg-amber-950/30 border-amber-600/50 text-amber-900 dark:text-amber-200`}>
          输入框里是尚未启用的新密钥。点「开启引擎」保存并验证。
        </p>
      )}

      {/* 自检结果 */}
      {check.phase === 'ok' && (
        <p className={`${boxCls} bg-emerald-50 dark:bg-emerald-950/30 border-emerald-700/50 text-emerald-900 dark:text-emerald-200 flex items-start gap-1.5`}>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{check.message}</span>
        </p>
      )}
      {check.phase === 'fail' && (
        <div className={`${boxCls} bg-[#fdf2f1] dark:bg-[#3a1f1d]/60 border-[#99332e]/50 text-[#8b2f2a] dark:text-[#e08b86]`}>
          <div className="flex items-start gap-1.5">
            <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">
              <span className="font-bold">自检未通过：</span>
              {check.message}
            </span>
          </div>

          {/* 模型名过期是这里最常见的失败原因。直接把可用的名字列出来给用户点 ——
              「你自己去厂商文档里查现在叫什么」不是一个能用的错误提示。 */}
          {check.availableModels && check.availableModels.length > 0 && onPickModel && (
            <div className="mt-2 pt-2 border-t border-dashed border-[#99332e]/30 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-serif opacity-80">点一个换上去：</span>
              {check.availableModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    sound.playKeyClick();
                    onPickModel(m);
                    setCheck({ phase: 'idle' });
                    onToast?.(`模型名已改为 ${m}，再点一次「开启引擎」`);
                  }}
                  className="px-1.5 py-0.5 rounded-xs border border-[#99332e]/60 bg-white/70 dark:bg-black/20 font-mono text-[10px] hover:bg-white cursor-pointer"
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className={`grid gap-2 ${status === 'on' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button
          id={`${idPrefix}-enable-btn`}
          type="button"
          onClick={handleEnable}
          disabled={isTesting || !trimmedDraft}
          className={`${btnCls} ${
            status === 'on'
              ? 'bg-[#faf7ee] dark:bg-[#243427] text-stone-800 dark:text-stone-100 hover:bg-white'
              : 'bg-[#d49e3d] text-stone-950 hover:bg-[#c99333]'
          }`}
        >
          {isTesting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>自检中…</span>
            </>
          ) : (
            <>
              <Power className="w-3.5 h-3.5" />
              <span>{status === 'on' ? '重新验证' : '开启引擎'}</span>
            </>
          )}
        </button>

        {status === 'on' && (
          <button
            id={`${idPrefix}-disable-btn`}
            type="button"
            onClick={handleDisable}
            disabled={isTesting}
            className={`${btnCls} bg-[#faf7ee] dark:bg-[#243427] text-stone-800 dark:text-stone-100 hover:bg-white`}
          >
            <PowerOff className="w-3.5 h-3.5 text-[#99332e] dark:text-[#e08b86]" />
            <span>关闭引擎</span>
          </button>
        )}
      </div>

      {trimmedDraft && (
        <button
          type="button"
          onClick={handleClearKey}
          className="text-[10px] font-mono text-stone-500 dark:text-stone-400 hover:text-[#99332e] dark:hover:text-[#e08b86] underline cursor-pointer"
        >
          清除本地保存的密钥
        </button>
      )}
    </div>
  );
};
