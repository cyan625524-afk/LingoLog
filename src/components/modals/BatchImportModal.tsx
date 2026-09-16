import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  ClipboardPaste,
  CheckCircle,
  Sparkles,
  Layers,
  BookOpen,
  Tag,
  Lightbulb,
  Trash2,
  HelpCircle,
  FileCheck,
  Upload,
} from 'lucide-react';
import { FlashCard } from '../../types';
import { sound } from '../../utils/audio';
import {
  parsePastedMarkdown,
  createCardsFromDrafts,
  ParsedCardDraft,
} from '../../utils/markdownCardParser';
import { importAllDataJson, sanitizeFlashCard } from '../../utils/storage';
import { MarkdownContent } from '../MarkdownContent';
import { TelegramStamp } from '../common/TelegramStamp';
import { SignalLamp } from '../common/SignalLamp';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (cards: FlashCard[], isFullRestore?: boolean) => void;
  modelName: string;
  apiKey?: string;
  provider?: string;
  baseUrl?: string;
}

const SAMPLE_MARKDOWN_EXAMPLE = `## 地道母语表达

If I post a picture every day, maybe I'll become an influencer by next year!

## 我的原始表达

如果我每天发一张照片，说不定明年我就能成为网红了！

---

* **场景归类**：社交媒体
* **标签**：网红、目标、憧憬

---

## 深度知识解析

* **influencer**：社交媒体时代专指“网红、博主、网络红人”最精准地道的词汇（原意为“有影响力的人”），比 *internet celebrity* 更常用于指代通过发帖吸粉的自媒体人。
* **by next year**：**by** 表示“到……为止”，用于表达在未来某个时间节点前实现某种状态或目标。
* **同义表达**：表达“坚持发帖当网红”时，口语中也常说 **If I keep posting daily, I might actually turn into a real influencer by next year!** 或 **Posting every single day might just turn me into an influencer by this time next year!**`;

export const BatchImportModal: React.FC<BatchImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [markdownInput, setMarkdownInput] = useState('');
  const [previewIndex, setPreviewIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time parsing of pasted Markdown content
  const parsedDrafts: ParsedCardDraft[] = useMemo(() => {
    return parsePastedMarkdown(markdownInput);
  }, [markdownInput]);

  // Escape key close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        sound.playKeyClick();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const trimmed = markdownInput.trim();
  const isJsonPayload =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        sound.playKeyClick();
        setMarkdownInput(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!trimmed) return;
    sound.playSuccess();

    // 1. If JSON payload is pasted (full backup format)
    if (isJsonPayload) {
      try {
        const parsed = JSON.parse(trimmed);
        const rawItems = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.items)
          ? parsed.items
          : Array.isArray(parsed.cards)
          ? parsed.cards
          : null;

        if (rawItems) {
          const directCards: FlashCard[] = rawItems.map((it: any, idx: number) =>
            sanitizeFlashCard(it, idx)
          );
          importAllDataJson(trimmed);
          onImportComplete(directCards, true);
          onClose();
          return;
        }
      } catch (e) {
        console.warn('JSON parsing failed, falling back to draft cards');
      }
    }

    // 2. Standard Markdown Card(s) Import
    if (parsedDrafts.length > 0) {
      const generatedCards = createCardsFromDrafts(parsedDrafts);
      onImportComplete(generatedCards);
      onClose();
      return;
    }

    // 3. Fallback: single plain sentence if user pasted plain text
    const fallbackDraft: ParsedCardDraft = {
      natural: trimmed,
      original: trimmed,
      category: '日常家务',
      tags: ['口语', '日常'],
      explanation: `• 导入表达：「${trimmed}」\n• 建议在卡片详情中补充母语搭配与例句。`,
      phrases: [],
    };
    const fallbackCards = createCardsFromDrafts([fallbackDraft]);
    onImportComplete(fallbackCards);
    onClose();
  };

  const activeDraft = parsedDrafts[previewIndex] || parsedDrafts[0];

  return (
    <div
      id="batch-import-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sound.playKeyClick();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#f4edd3] rounded-xs shadow-[6px_6px_0px_#0e1610] border-2 border-stone-900 overflow-hidden flex flex-col max-h-[90vh] text-stone-900 cursor-default"
      >
        {/* Header */}
        <div className="bg-[#d49e3d] px-4 sm:px-5 py-2.5 border-b-2 border-stone-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <SignalLamp status="green" size="sm" />
            <div>
              <span className="text-xs sm:text-sm font-black font-serif-display text-stone-900 block">
                — 电报卡片导入 (Markdown 格式) —
              </span>
              <span className="text-[10px] text-stone-800 font-serif-body block">
                支持地道母语表达、原始表达、场景归类、标签及深度解析精准字段映射
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playKeyClick();
              onClose();
            }}
            className="p-1 rounded-xs hover:bg-[#c99333] text-stone-900 transition-colors cursor-pointer"
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
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
          {/* Action Bar / Fill Sample */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="font-bold text-stone-800 font-serif-display flex items-center gap-1.5">
              <span>在下方输入或粘贴 Markdown 格式电报：</span>
              {parsedDrafts.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#eee5c6] text-stone-900 font-mono text-[11px] font-bold border border-stone-900">
                  <FileCheck className="w-3 h-3 text-emerald-800" />
                  已成功解析 {parsedDrafts.length} 封电报
                </span>
              )}
            </label>

            <div className="flex items-center gap-1.5">
              {/* File upload button */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.txt,.json,.markdown"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => {
                  sound.playKeyClick();
                  fileInputRef.current?.click();
                }}
                className="text-[11px] px-2.5 py-1 rounded-xs bg-[#faf7ee] hover:bg-white border border-stone-900 font-serif-display font-bold text-stone-900 transition-colors flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_#101711]"
                title="从本地 .md 或 .txt 文件导入"
              >
                <Upload className="w-3 h-3 text-stone-700" />
                <span>上传文件</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playKeyClick();
                  setMarkdownInput(SAMPLE_MARKDOWN_EXAMPLE);
                }}
                className="text-[11px] px-2.5 py-1 rounded-xs bg-[#faf7ee] hover:bg-white border border-stone-900 font-serif-display font-bold text-stone-900 transition-colors flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_#101711]"
              >
                <Sparkles className="w-3 h-3 text-[#d49e3d]" />
                <span>填入示例</span>
              </button>

              {markdownInput.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    sound.playKeyClick();
                    setMarkdownInput('');
                  }}
                  className="text-[11px] px-2 py-1 rounded-xs text-stone-600 hover:text-stone-900 transition-colors flex items-center gap-0.5 cursor-pointer font-serif-display"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>清空</span>
                </button>
              )}
            </div>
          </div>

          {/* Textarea */}
          <div className="relative">
            <textarea
              value={markdownInput}
              onChange={(e) => setMarkdownInput(e.target.value)}
              placeholder={`请在此粘贴 Markdown 格式的电报内容，例如：\n\n## 地道母语表达\nIf I post a picture every day, maybe I'll become an influencer by next year!\n\n## 我的原始表达\n如果我每天发一张照片，说不定明年我就能成为网红了！\n\n---\n* **场景归类**：社交媒体\n* **标签**：网红、目标、憧憬\n---\n\n## 深度知识解析\n* **influencer**：社交媒体时代专指“网红、博主、网络红人”最精准地道的词汇...\n* **by next year**：by 表示“到……为止”...\n* **同义表达**：口语中也常说 If I keep posting daily...`}
              rows={6}
              className="w-full text-xs font-mono p-3 rounded-xs border-2 border-stone-900 bg-[#faf7ee] focus:outline-hidden focus:ring-1 focus:ring-[#d49e3d] leading-relaxed text-stone-900 placeholder:text-stone-400 shadow-inner"
            />
          </div>

          {/* Live Mapping Preview Section */}
          {activeDraft && (
            <div className="space-y-2 border-t border-dashed border-stone-400 pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold font-serif-display text-stone-900">
                  <BookOpen className="w-3.5 h-3.5 text-[#d49e3d]" />
                  <span>电报字段语义映射实时预览：</span>
                </div>

                {parsedDrafts.length > 1 && (
                  <div className="flex items-center gap-1 font-mono text-[11px]">
                    <span className="text-stone-600">预览序号：</span>
                    {parsedDrafts.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          sound.playKeyClick();
                          setPreviewIndex(idx);
                        }}
                        className={`w-5 h-5 rounded-xs text-[10px] font-bold cursor-pointer border border-stone-900 ${
                          previewIndex === idx
                            ? 'bg-[#243427] text-[#d49e3d]'
                            : 'bg-[#faf7ee] text-stone-800'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview Card Shell */}
              <div className="p-3.5 rounded-xs bg-[#eee5c6] border-2 border-stone-900 space-y-2.5 shadow-[2px_2px_0px_#101711]">
                {/* Meta header: Category & Tags */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-stone-400">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-xs bg-[#182319] text-[#d49e3d] font-mono font-bold">
                        场景归类
                      </span>
                      <TelegramStamp text={activeDraft.category || '电报'} variant="official" />
                    </div>

                    {activeDraft.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-xs bg-stone-700/20 text-stone-600 font-mono font-bold">
                          标签
                        </span>
                        {activeDraft.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-1.5 py-0.5 rounded-xs bg-[#faf7ee] text-stone-800 text-[10px] font-mono border border-stone-700"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-emerald-800 font-bold">
                    字段匹配成功 ✓
                  </span>
                </div>

                {/* Expressions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {/* Original Expression */}
                  <div className="p-2.5 rounded-xs bg-[#faf7ee] border border-stone-900 space-y-1">
                    <span className="text-[10px] font-bold text-stone-600 font-serif-display flex items-center justify-between">
                      <span>我的原始表达</span>
                      <span className="font-mono text-[9px] text-stone-400">original</span>
                    </span>
                    <p className="text-xs font-serif-display font-medium text-stone-900">
                      {activeDraft.original}
                    </p>
                  </div>

                  {/* Natural Expression */}
                  <div className="p-2.5 rounded-xs bg-[#182319] text-amber-100 border border-stone-900 space-y-1 shadow-xs">
                    <span className="text-[10px] font-bold text-[#d49e3d] font-serif-display flex items-center justify-between">
                      <span>地道母语表达</span>
                      <span className="font-mono text-[9px] text-amber-300/70">natural</span>
                    </span>
                    <p className="text-xs font-serif-display font-bold italic tracking-wide text-amber-200">
                      "{activeDraft.natural}"
                    </p>
                  </div>
                </div>

                {/* Deep Knowledge Explanation */}
                <div className="p-2.5 rounded-xs bg-[#faf7ee] border border-stone-900 space-y-1">
                  <span className="text-[10px] font-bold text-stone-600 font-serif-display flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Lightbulb className="w-3 h-3 text-[#d49e3d]" /> 深度知识解析
                    </span>
                    <span className="font-mono text-[9px] text-stone-400">explanation</span>
                  </span>
                  <div className="text-[11px] leading-relaxed text-stone-800 font-serif-body">
                    <MarkdownContent content={activeDraft.explanation} />
                  </div>
                </div>

                {/* Extracted Phrases & Highlights */}
                {activeDraft.phrases && activeDraft.phrases.length > 0 && (
                  <div className="space-y-1 pt-0.5">
                    <span className="text-[10px] text-stone-600 font-mono block">
                      解析提取核心词汇与短语:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {activeDraft.phrases.map((p, pIdx) => (
                        <span
                          key={pIdx}
                          className="px-2 py-0.5 rounded-xs bg-[#faf7ee] text-stone-900 border border-stone-900 text-[10px] font-medium"
                        >
                          <strong className="font-mono">{p.phrase}</strong> ({p.pos}): {p.meaning}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Guide Tips when empty */}
          {!activeDraft && (
            <div className="bg-[#eee5c6] p-3.5 rounded-xs border border-dashed border-stone-400 space-y-1.5 text-stone-800">
              <div className="font-bold flex items-center gap-1 text-stone-900 text-xs font-serif-display">
                <HelpCircle className="w-3.5 h-3.5 text-[#d49e3d]" />
                <span>支持的 Markdown 电报格式映射说明：</span>
              </div>
              <ul className="space-y-1 text-[11px] list-disc list-inside text-stone-700 font-serif-body">
                <li><strong className="text-stone-900">## 地道母语表达</strong> → 映射为母语级地道英文（正面卡片主体）</li>
                <li><strong className="text-stone-900">## 我的原始表达</strong> → 映射为中文原意（背面线索与对照）</li>
                <li><strong className="text-stone-900">* **场景归类**</strong> → 映射为场景分类（如社交媒体、社交聚会、学习提升）</li>
                <li><strong className="text-stone-900">* **标签**</strong> → 映射为卡片标签（如网红、目标、憧憬）</li>
                <li><strong className="text-stone-900">## 深度知识解析</strong> → 映射为详细语法/用法解析，并自动提取核心词汇与短语</li>
              </ul>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#eee5c6] border-t-2 border-stone-900 flex items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-stone-600 font-mono">
            {parsedDrafts.length > 0 ? (
              <span>准备就绪：可收录 {parsedDrafts.length} 封电报</span>
            ) : (
              <span>支持单封或多封 Markdown 电报连续粘贴导入</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playKeyClick();
                onClose();
              }}
              className="px-4 py-1.5 text-xs rounded-xs border-2 border-stone-900 bg-[#faf7ee] hover:bg-white text-stone-900 transition-colors cursor-pointer font-serif-display font-bold shadow-[1px_1px_0px_#101711]"
            >
              取消
            </button>
            <button
              id="confirm-markdown-import-btn"
              disabled={!trimmed}
              onClick={handleConfirmImport}
              className={`px-5 py-1.5 text-xs font-bold rounded-xs border-2 border-stone-900 flex items-center gap-1.5 shadow-[2px_2px_0px_#101711] transition-all active:translate-y-0.5 cursor-pointer font-serif-display ${
                !trimmed
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed border-stone-400 shadow-none'
                  : 'bg-[#d49e3d] hover:bg-[#c99333] text-stone-950 font-black'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 text-stone-950" />
              <span>
                {parsedDrafts.length > 0
                  ? `确认收录档案库 (+${parsedDrafts.length}封)`
                  : '确认收录档案库'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

