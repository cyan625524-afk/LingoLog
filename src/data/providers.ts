/**
 * 服务商预设表
 *
 * 设计取舍：baseUrl 和 model 都允许用户手改，因为模型名变动很快。
 *
 * ⚠️ 这里的模型名是「照当前文档抄的」，而厂商下线旧模型的节奏比发版还快。
 * 已知的坟场：moonshot-v1-* 系列 2026/08/31 全线下线、deepseek-chat /
 * deepseek-reasoner 2026/07/24 并入 deepseek-v4-flash。
 * 所以自检失败时不要慌，也不用来改代码 —— 设置页点「开启引擎」失败后，
 * 服务端会把该密钥真正能用的模型名列出来，照着改一下模型名即可。
 */

export type ApiProvider = 'gemini' | 'openai-compatible';

export interface ProviderPreset {
  id: string;
  label: string;
  provider: ApiProvider;
  /** 为空表示由用户手填 */
  baseUrl: string;
  models: string[];
  keyHint: string;
  note?: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek 深度求索',
    provider: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyHint: 'sk-...',
    note: '国内直连，无需代理',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    provider: 'gemini',
    baseUrl: '',
    models: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'],
    keyHint: 'AIzaSy...',
    note: '国内需要代理才能直连',
  },
  {
    id: 'moonshot',
    label: 'Kimi 月之暗面',
    provider: 'openai-compatible',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k3', 'kimi-k2.7-code', 'kimi-k2.6'],
    keyHint: 'sk-...',
    note: '国内直连',
  },
  {
    id: 'dashscope',
    label: '通义千问（阿里云百炼）',
    provider: 'openai-compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen3.8-flash', 'qwen3.8-max', 'qwen3.7-plus'],
    keyHint: 'sk-...',
    note: '国内直连',
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    provider: 'openai-compatible',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5.2', 'glm-5.1', 'glm-5'],
    keyHint: '...',
    note: '国内直连',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    provider: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o'],
    keyHint: 'sk-...',
    note: '国内需要代理',
  },
  {
    id: 'custom',
    label: '自定义（任意 OpenAI 兼容接口）',
    provider: 'openai-compatible',
    baseUrl: '',
    models: [],
    keyHint: '按服务商要求填写',
    note: '自己填 Base URL 和模型名',
  },
];

export const DEFAULT_PROVIDER_ID = 'deepseek';

/**
 * 已确认下线的模型名 → 当前等价模型。
 *
 * 用途只有一个：把老用户 localStorage / 云端同步里的「死名字」救回来。
 * 判据必须是**厂商公告下线**，不是「我们觉得该升级了」—— 把还能用的名字
 * 强行改掉，等于替用户做决定，而且会让「我明明选了 3.6 怎么变 3.8」变成
 * 一个无法解释的 bug。
 */
export const RETIRED_MODEL_ALIASES: Record<string, string> = {
  // 我们的历史默认值，这个名字从来不存在（漏了 v4）
  'deepseek-flash': 'deepseek-v4-flash',
  // 官方公告 2026/07/24 弃用，非思考/思考模式并入 v4-flash
  'deepseek-chat': 'deepseek-v4-flash',
  'deepseek-reasoner': 'deepseek-v4-pro',
  'deepseek-v3.2': 'deepseek-v4-flash',
  // 官方公告 2026/08/31 下线
  'moonshot-v1-8k': 'kimi-k3',
  'moonshot-v1-32k': 'kimi-k3',
  'moonshot-v1-128k': 'kimi-k3',
  'moonshot-v1-auto': 'kimi-k3',
  'kimi-k2.5': 'kimi-k3',
  'kimi-k2': 'kimi-k3',
};

/** 死名字 → 活名字；本来就是活名字则原样返回 */
export function reviveModelName(name: string): string {
  const trimmed = (name || '').trim();
  return RETIRED_MODEL_ALIASES[trimmed] || trimmed;
}

export function getPreset(id: string): ProviderPreset {
  return PROVIDER_PRESETS.find((p) => p.id === id) ?? PROVIDER_PRESETS[0];
}

/** 由 preset id 反查它属于哪种调用协议 */
export function resolveProvider(id: string): ApiProvider {
  return getPreset(id).provider;
}
