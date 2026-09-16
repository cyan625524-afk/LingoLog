import React from 'react';

interface HighlightedTextProps {
  /** 完整句子。红字片段必须逐字出现在这里面，否则那一段不会被标红。 */
  text: string;
  /** 重点词片段（来自 AI 或 highlightPicker 的保底挑选） */
  highlights?: string[];
  /**
   * 传入 = 可点击撤销该标记（学习页用）。
   * 不传 = 纯展示，不可交互（归档预览、详情弹窗用）。
   */
  onRemove?: (highlight: string) => void;
  /** 是否给整段加中文引号 */
  quote?: boolean;
  className?: string;
}

/**
 * 把一句话按重点词片段渲染成「红带」样式。
 *
 * 匹配规则：每个片段取它在句中的**第一个**出现位置（忽略大小写），保留原文实际词形。
 *
 * 关键细节：渲染前**必须按出现位置给片段排序**。
 * 早期实现直接按传入顺序逐个消费剩余文本，结果正确性依赖上游给的顺序 ——
 * 若第一个片段在句中靠后，它会吃掉后半段，前面那个片段就再也匹配不到、红字凭空消失。
 * AI 返回的 redHighlights 顺序不保证，pickCoreHighlights 的选词顺序也不保证。
 *
 * 片段必须**逐字来自原句**：改一个字母（包括大小写以外的一切差异）就会匹配失败。
 * 一个都匹配不上时整体退化成纯文本，不留空壳。
 */
export const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  highlights,
  onRemove,
  quote = true,
  className = '',
}) => {
  const interactive = typeof onRemove === 'function';

  const render = () => {
    const list = (highlights || []).filter((h) => h && h.trim());
    if (list.length === 0) return <span>{text}</span>;

    const lower = text.toLowerCase();

    // 先按「在句中的首次出现位置」排序，再顺序消费。
    // 这样既保证都匹配得上，又让 onRemove 拿到的仍是原始片段（撤销才有效）。
    const ordered = list
      .map((hl) => ({ hl, at: lower.indexOf(hl.toLowerCase()) }))
      .filter((x) => x.at !== -1)
      .sort((a, b) => a.at - b.at)
      .map((x) => x.hl);

    if (ordered.length === 0) return <span>{text}</span>;

    const result: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    ordered.forEach((hl) => {
      const idx = remaining.toLowerCase().indexOf(hl.toLowerCase());
      if (idx === -1) return;

      const before = remaining.substring(0, idx);
      const match = remaining.substring(idx, idx + hl.length);
      remaining = remaining.substring(idx + hl.length);

      if (before) result.push(<span key={keyIdx++}>{before}</span>);
      result.push(
        <span
          key={keyIdx++}
          onClick={interactive ? () => onRemove!(hl) : undefined}
          title={interactive ? '点击撤销红带标记' : undefined}
          className={`text-[var(--tel-signal-red)] bg-[var(--tel-signal-red-bg)] px-1 py-0.5 rounded underline decoration-dashed decoration-[var(--tel-signal-red)] font-bold ${
            interactive ? 'cursor-pointer hover:brightness-95 transition-colors' : ''
          }`}
        >
          {match}
        </span>
      );
    });

    if (remaining) result.push(<span key={keyIdx++}>{remaining}</span>);

    return <>{result}</>;
  };

  return (
    <span className={className}>
      {quote ? '"' : null}
      {render()}
      {quote ? '"' : null}
    </span>
  );
};
