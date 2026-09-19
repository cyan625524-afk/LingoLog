-- ==============================================================================
-- LingoLog 微信每日未学提醒 (WxPusher) - Supabase 数据库表与权限结构
-- 
-- 使用方法：
-- 1. 登录 Supabase Dashboard (https://supabase.com/dashboard)
-- 2. 进入你的 LingoLog 项目 -> SQL Editor (左侧终端图标)
-- 3. 点击 New query，将以下代码完整粘贴并点击 Run 即可！
-- ==============================================================================

-- 1. 创建每日微信提醒配置表
CREATE TABLE IF NOT EXISTS public.lingolog_reminders (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wxpusher_uid TEXT NOT NULL,
  reminder_time TEXT NOT NULL DEFAULT '21:00',
  enabled BOOLEAN NOT NULL DEFAULT true,
  custom_app_token TEXT,
  last_notified_date TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 启用行级权限控制 (RLS)
ALTER TABLE public.lingolog_reminders ENABLE ROW LEVEL SECURITY;

-- 3. 允许已登录用户管理自己的微信提醒配置
DROP POLICY IF EXISTS "Users can manage their own reminder" ON public.lingolog_reminders;
CREATE POLICY "Users can manage their own reminder" ON public.lingolog_reminders
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. 允许服务端免登录巡检（用于定时机器人检测当前小时有哪些未学用户需要发微信通知）
DROP POLICY IF EXISTS "Service can read active reminders" ON public.lingolog_reminders;
CREATE POLICY "Service can read active reminders" ON public.lingolog_reminders
  FOR SELECT
  USING (true);

-- 5. 允许服务端更新 last_notified_date
DROP POLICY IF EXISTS "Service can update reminder timestamp" ON public.lingolog_reminders;
CREATE POLICY "Service can update reminder timestamp" ON public.lingolog_reminders
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 6. 允许只读卡片最近更新时间以判断用户今天是否已学
DROP POLICY IF EXISTS "Service can read cards study timestamp" ON public.lingolog_cards;
CREATE POLICY "Service can read cards study timestamp" ON public.lingolog_cards
  FOR SELECT
  USING (true);

COMMENT ON TABLE public.lingolog_reminders IS 'LingoLog 微信每日学习未打卡状态栏提醒配置表';
