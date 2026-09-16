/**
 * 智能翻译引擎的「开启 / 关闭」状态与自检。
 *
 * 为什么需要这个文件：在这之前，设置页的密钥是「边打字边保存」的 —— 用户填完
 * 不知道是否生效，填错了也没有任何反馈，App 会静默降级成公开翻译。用户看到的是
 * 「我明明配了密钥，怎么还是机器翻译」。所以配置必须变成一次显式的动作：
 * 填写 → 点「开启引擎」→ 服务端真发一次最小请求 → 明确告知成功或失败。
 */

import { AppSettings } from '../types';
import { getPreset } from '../data/providers';

export type EngineStatus = 'off' | 'unconfigured' | 'on';

export interface EngineCheckResult {
  ok: boolean;
  message: string;
  model?: string;
  protocol?: string;
  latencyMs?: number;
  /** 自检因模型名失败时，服务端会带回该密钥真正可用的模型名，供界面一键改对 */
  availableModels?: string[];
}

/** 三个状态：完全没填 / 填了但关着 / 已开启 */
export function resolveEngineStatus(settings: AppSettings): EngineStatus {
  if (settings.apiEnabled && settings.customApiKey) return 'on';
  if (settings.customApiKey) return 'off';
  return 'unconfigured';
}

/** 一句话描述当前引擎（用于状态条） */
export function describeEngine(settings: AppSettings): string {
  const preset = getPreset(settings.apiProvider);
  const model = settings.modelName || preset.models[0] || '未填模型';
  return `${preset.label} · ${model}`;
}

/**
 * 让服务端真发一次最小请求验证配置。
 * 不做任何本地预校验以外的假设 —— 密钥格式、模型名、Base URL 三项都要服务商点头才算通过。
 */
export async function verifyApiEngine(input: {
  apiKey: string;
  provider: string;
  modelName: string;
  baseUrl: string;
}): Promise<EngineCheckResult> {
  const key = (input.apiKey || '').trim();
  if (!key) {
    return { ok: false, message: '请先填入 API 密钥。' };
  }

  try {
    const res = await fetch('/api/verify-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: key,
        provider: input.provider,
        modelName: input.modelName,
        baseUrl: input.baseUrl,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!data || typeof data.ok !== 'boolean') {
      // 走到这里说明不是业务失败，而是服务端本身没答上话。
      // 404 要单独说清楚：本应用的服务端里没有这个接口，几乎只有一个原因 ——
      // 正在跑的进程是「加这个接口之前」启动的旧版本（改了代码没重启）。
      // 不点破的话，用户只能看到一个无从下手的 404，会以为是自己密钥填错了。
      if (res.status === 404) {
        return {
          ok: false,
          message:
            '本机服务端没有自检接口（HTTP 404）—— 正在运行的很可能还是旧版本。重启服务后再试。',
        };
      }
      if (res.status === 429) {
        return { ok: false, message: '请求太频繁，等一分钟再试。' };
      }
      if (res.status >= 500) {
        return {
          ok: false,
          message: `服务端没响应（HTTP ${res.status}），可能正在重启或已退出。`,
        };
      }
      return { ok: false, message: `服务端返回异常（HTTP ${res.status}），无法完成自检。` };
    }

    return {
      ok: Boolean(data.ok),
      message: typeof data.message === 'string' && data.message ? data.message : data.ok ? '已连通。' : '自检未通过。',
      model: data.model,
      protocol: data.protocol,
      latencyMs: data.latencyMs,
      availableModels: Array.isArray(data.availableModels)
        ? data.availableModels.filter((m: unknown): m is string => typeof m === 'string')
        : undefined,
    };
  } catch {
    return { ok: false, message: '连不上本应用的服务端，请确认服务在运行。' };
  }
}
