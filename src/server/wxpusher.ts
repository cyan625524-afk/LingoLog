import { createClient } from '@supabase/supabase-js';

export interface WxPusherQrCodeResult {
  success: boolean;
  code?: string;
  url?: string;
  shortUrl?: string;
  expires?: number;
  error?: string;
  message?: string;
}

export interface WxPusherScanResult {
  success: boolean;
  scanned: boolean;
  uid?: string | null;
  error?: string;
}

export interface WxPusherSendOptions {
  uid: string;
  title: string;
  content: string;
  summary?: string;
  url?: string;
  appToken?: string;
}

/**
 * 获取可用的 WxPusher AppToken。
 * 优先级：请求显式传入的 token > 环境变量 WXPUSHER_APP_TOKEN
 */
export function getAppToken(explicitToken?: string): string {
  return (explicitToken || process.env.WXPUSHER_APP_TOKEN || '').trim();
}

/**
 * 向 WxPusher 申请关注带参二维码
 */
export async function createWxPusherQrCode(appToken?: string, extra?: string): Promise<WxPusherQrCodeResult> {
  const token = getAppToken(appToken);
  if (!token) {
    return {
      success: false,
      error: 'missing_app_token',
      message: '尚未配置 WxPusher AppToken。请在环境变量或设置中配置。',
    };
  }

  try {
    const res = await fetch('https://wxpusher.zjiecode.com/api/fun/create/qrcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appToken: token,
        extra: (extra || 'lingolog_user').slice(0, 64),
        validTime: 1800, // 30 分钟有效期
      }),
    });

    const json = (await res.json()) as any;
    if (json.code === 1000 && json.data) {
      return {
        success: true,
        code: json.data.code,
        url: json.data.url,
        shortUrl: json.data.shortUrl,
        expires: json.data.expires,
      };
    }

    return {
      success: false,
      error: json.msg || 'WxPusher 申请二维码失败',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || '网络连接异常，无法连接 WxPusher',
    };
  }
}

/**
 * 轮询或检查带参二维码的微信扫码结果
 */
export async function checkWxPusherScan(code: string): Promise<WxPusherScanResult> {
  if (!code) {
    return { success: false, scanned: false, error: '缺少二维码 code' };
  }

  try {
    const res = await fetch(`https://wxpusher.zjiecode.com/api/fun/scan-qrcode-uid?code=${encodeURIComponent(code)}`);
    const json = (await res.json()) as any;

    if (json.code === 1000 && json.data) {
      let uid: string | null = null;
      if (typeof json.data === 'string') {
        uid = json.data.trim();
      } else if (typeof json.data === 'object' && json.data.uid) {
        uid = String(json.data.uid).trim();
      }

      if (uid) {
        return { success: true, scanned: true, uid };
      }
    }

    return { success: true, scanned: false, uid: null };
  } catch (err: any) {
    return { success: false, scanned: false, error: err?.message || '检查扫码状态失败' };
  }
}

/**
 * 发送微信模板消息（状态栏推送）
 */
export async function sendWxPusherMessage(options: WxPusherSendOptions): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!options.uid) {
    return { success: false, error: '未指定目标用户的 WxPusher UID 或 SPT' };
  }

  const cleanTarget = options.uid.trim();

  // 1. 如果填入的是极简推送令牌 (SPT_xxx)，直接调用极简推送接口，无需 AppToken
  if (cleanTarget.startsWith('SPT_')) {
    try {
      const res = await fetch('https://wxpusher.zjiecode.com/api/send/message/simple-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spt: cleanTarget,
          content: options.content,
          summary: options.summary || options.title,
          contentType: 2, // HTML 格式
          url: options.url || 'https://lingo-log-three.vercel.app',
        }),
      });

      const json = (await res.json()) as any;
      if (json.code === 1000) {
        return { success: true, data: json.data };
      }
      return { success: false, error: json.msg || 'SPT 极简推送投递失败' };
    } catch (err: any) {
      return { success: false, error: err?.message || '网络连接异常，无法发送 SPT 极简通知' };
    }
  }

  // 2. 标准推送 (UID_xxx)
  const token = getAppToken(options.appToken);
  if (!token) {
    return { success: false, error: '尚未配置 WxPusher AppToken。如果使用的是个人推送，请填入 SPT_ 开头的极简推送令牌。' };
  }

  try {
    const res = await fetch('https://wxpusher.zjiecode.com/api/send/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appToken: token,
        content: options.content,
        summary: options.summary || options.title,
        contentType: 2, // 2: HTML 格式，富文本展示效果最佳
        uids: [options.uid],
        url: options.url || 'https://lingo-log-three.vercel.app',
      }),
    });

    const json = (await res.json()) as any;
    if (json.code === 1000) {
      return { success: true, data: json.data };
    }

    return { success: false, error: json.msg || 'WxPusher 投递消息失败' };
  } catch (err: any) {
    return { success: false, error: err?.message || '网络连接异常，无法发送微信通知' };
  }
}

/**
 * 定时任务巡检：检查当前时间是否有开启微信提醒且今日尚未打卡的用户
 */
export async function runDailyReminderInspection(querySecret?: string) {
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && querySecret !== expectedSecret) {
    return { success: false, status: 401, error: 'unauthorized', message: 'CRON 密钥校验失败' };
  }

  // 计算东八区（北京时间）当前时间
  const now = new Date();
  const shanghaiFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  // 格式例如 "2026-09-19, 21:05"
  const formatted = shanghaiFormatter.format(now);
  const [datePart, timePart] = formatted.split(',').map((s) => s.trim());
  const currentHour = timePart ? parseInt(timePart.split(':')[0], 10) : 21;
  const todayStr = datePart; // "YYYY-MM-DD"

  // 构造北京时间今天 00:00:00 对应的 ISO 时间戳（用于比较 Supabase 的 updated_at）
  // 北京时间 UTC+8，今天 00:00:00 北京时间 = 昨天 16:00:00 UTC
  const todayStartUtcMs = new Date(`${todayStr}T00:00:00+08:00`).getTime();

  const sbUrl = process.env.VITE_SUPABASE_URL || 'https://dhuyngljrmxgssxpsdys.supabase.co';
  const sbKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_-mRNfbDODN-0cZOeFsEKmA_pq9Xo4yT';

  const supabase = createClient(sbUrl, sbKey, {
    auth: { persistSession: false },
  });

  const remindersToSend: Array<{
    userId: string;
    uid: string;
    appToken?: string;
    reminderTime: string;
  }> = [];

  // 1. 从 lingolog_reminders 表读取
  try {
    const { data: reminderRows, error: rErr } = await supabase
      .from('lingolog_reminders')
      .select('*')
      .eq('enabled', true);

    if (!rErr && Array.isArray(reminderRows)) {
      for (const row of reminderRows) {
        if (!row.wxpusher_uid) continue;
        const targetHour = parseInt(String(row.reminder_time || '21:00').split(':')[0], 10);
        // 如果当前小时等于设定的提醒小时，且今天还没发过提醒
        if (targetHour === currentHour && row.last_notified_date !== todayStr) {
          remindersToSend.push({
            userId: row.user_id,
            uid: row.wxpusher_uid,
            appToken: row.custom_app_token,
            reminderTime: row.reminder_time || '21:00',
          });
        }
      }
    }
  } catch (e) {
    console.warn('[cron-remind] 查询 lingolog_reminders 失败 (可能是表尚未创建，继续尝试备用查询):', e);
  }

  // 2. 容灾读取 lingolog_cards 中的 __reminder_ 记录
  try {
    const { data: fallbackCards } = await supabase
      .from('lingolog_cards')
      .select('id, user_id, card, updated_at')
      .like('id', '__reminder_%');

    if (Array.isArray(fallbackCards)) {
      for (const row of fallbackCards) {
        if (!row.card || !row.user_id) continue;
        const cfg = row.card as any;
        if (!cfg.enabled || !cfg.wxpusherUid) continue;
        const targetHour = parseInt(String(cfg.reminderTime || '21:00').split(':')[0], 10);
        // 避免重复加入
        const alreadyInList = remindersToSend.some((item) => item.userId === row.user_id);
        if (!alreadyInList && targetHour === currentHour && cfg.lastNotifiedDate !== todayStr) {
          remindersToSend.push({
            userId: row.user_id,
            uid: cfg.wxpusherUid,
            appToken: cfg.customAppToken,
            reminderTime: cfg.reminderTime || '21:00',
          });
        }
      }
    }
  } catch (e) {
    console.warn('[cron-remind] 容灾查询 __reminder_ 失败:', e);
  }

  const results: any[] = [];

  // 对每个到期的用户，检查今天是否已学
  for (const item of remindersToSend) {
    try {
      // 检查该用户今天是否有卡片更新记录 (updated_at >= 今日0点北京时间)
      const { data: recentCards, error: cardErr } = await supabase
        .from('lingolog_cards')
        .select('id, updated_at')
        .eq('user_id', item.userId)
        .gte('updated_at', new Date(todayStartUtcMs).toISOString())
        .limit(1);

      if (!cardErr && recentCards && recentCards.length > 0) {
        // 用户今天已经学过/打卡了，跳过提醒！
        results.push({
          userId: item.userId,
          uid: item.uid,
          status: 'skipped_already_studied',
          message: '用户今日已完成学习复习，静默不打扰',
        });
        continue;
      }

      // 用户今天尚未学习，发送微信电台待机提醒
      const content = `
<div style="max-width: 500px; margin: 0 auto; padding: 20px; background-color: #fcf8ee; border: 2px solid #292524; color: #1c1917; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-radius: 4px; box-shadow: 4px 4px 0px #1c1917;">
  <div style="border-bottom: 2px dashed #d6cfb8; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
    <span style="font-size: 13px; font-weight: bold; color: #b45309; letter-spacing: 1px;">📻 LINGOLOG 复古电报值机台</span>
    <span style="font-size: 11px; background-color: #292524; color: #fcf8ee; padding: 2px 6px; border-radius: 2px;">未打卡提醒</span>
  </div>
  
  <h2 style="color: #99332e; font-size: 19px; margin-top: 0; margin-bottom: 12px; line-height: 1.4;">
    发报员，今日尚未检测到你的学习信号！
  </h2>
  
  <p style="font-size: 14px; line-height: 1.7; color: #44403c; margin-bottom: 16px;">
    电台天线已为你对齐波段。今日还有待机复述的卡片尚未值机练习。
    抽出 3 分钟朗读几句地道英语，保持你的连续电讯记录（Streak）！
  </p>

  <div style="background-color: #f3ecd8; border-left: 3px solid #b45309; padding: 10px 14px; margin-bottom: 20px; font-size: 13px; color: #57534e;">
    💡 提示：在电台完成任意卡片复习或口语录音测评后，今日将自动记录为已学。
  </div>

  <div style="text-align: center; margin-top: 18px;">
    <a href="https://lingo-log-three.vercel.app" style="display: inline-block; background-color: #d49e3d; color: #1c1917; font-size: 14px; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 2px; border: 2px solid #1c1917; box-shadow: 3px 3px 0px #1c1917;">
      ⚡ 立即登入电台值机打卡
    </a>
  </div>
</div>
      `.trim();

      const sendRes = await sendWxPusherMessage({
        uid: item.uid,
        title: '📻 LingoLog 今日未学打卡提醒',
        summary: '发报员，今日尚未检测到你的电台学习信号，快来值机打卡吧！',
        content,
        appToken: item.appToken,
      });

      if (sendRes.success) {
        // 更新 last_notified_date 防止同一天重复发送
        try {
          await supabase
            .from('lingolog_reminders')
            .update({ last_notified_date: todayStr, updated_at: new Date().toISOString() })
            .eq('user_id', item.userId);
        } catch {}

        try {
          await supabase
            .from('lingolog_cards')
            .update({
              card: {
                type: 'reminder_config',
                wxpusherUid: item.uid,
                reminderTime: item.reminderTime,
                enabled: true,
                customAppToken: item.appToken || '',
                lastNotifiedDate: todayStr,
              } as any,
              updated_at: new Date().toISOString(),
            })
            .eq('id', `__reminder_${item.userId}`);
        } catch {}

        results.push({
          userId: item.userId,
          uid: item.uid,
          status: 'sent',
          message: '已成功向微信推送状态栏提醒',
        });
      } else {
        results.push({
          userId: item.userId,
          uid: item.uid,
          status: 'send_failed',
          error: sendRes.error,
        });
      }
    } catch (e: any) {
      results.push({
        userId: item.userId,
        uid: item.uid,
        status: 'error',
        error: e?.message || '处理异常',
      });
    }
  }

  return {
    success: true,
    inspectionTime: `${todayStr} ${currentHour}:00 (Asia/Shanghai)`,
    totalChecked: remindersToSend.length,
    results,
  };
}
