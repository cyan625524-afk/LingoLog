-- LingoLog 多端同步 —— D1 表结构
-- 在 Cloudflare 控制台 → 存储和数据库 → D1 → 你的数据库 → 控制台，粘贴执行即可。

CREATE TABLE IF NOT EXISTS sync_blobs (
  -- sha256(同步码) 的十六进制。明文码永不落库。
  code_hash  TEXT    PRIMARY KEY,
  -- 版本号，写一次 +1。客户端提交时必须带对 baseRev，否则回 409。
  rev        INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT    NOT NULL,
  -- 字节数，用于观测与配额判断
  size       INTEGER NOT NULL DEFAULT 0,
  -- 整包 JSON 快照
  payload    TEXT    NOT NULL
);

-- 单人使用，一个同步码一行。正常情况下这张表只有个位数行。
