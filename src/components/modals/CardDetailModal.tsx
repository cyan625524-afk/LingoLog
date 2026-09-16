import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Star,
  Copy,
  Volume2,
  Mic,
  Check,
  Calendar,
  Sparkles,
  Trash2,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Award,
  History,
  TrendingUp,
} from 'lucide-react';
import { FlashCard, SpeechRecord } from '../../types';
import { sound } from '../../utils/audio';
import { speakEnglishText } from '../../utils/tts';
import { formatNextReviewHuman } from '../../utils/ebbinghaus';
import { HighlightedText } from '../common/HighlightedText';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { TelegramStamp } from '../common/TelegramStamp';
import { SignalLamp } from '../common/SignalLamp';
import { getCardChronologicalMap, formatCardNumber } from '../../utils/cardOrder';

interface CardDetailModalProps {
  card: FlashCard | null;
  allCards?: FlashCard[];
  isOpen: boolean;
  onClose: () => void;
  onToggleFavorite: (cardId: string) => void;
  onOpenSpeechPractice?: (card: FlashCard) => void;
  onDeleteCard?: (cardId: string) => void;
  onUpdateCard?: (updatedCard: FlashCard) => void;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({
  card,
  allCards = [],
  isOpen,
  onClose,
  onToggleFavorite,
  onOpenSpeechPractice,
  onDeleteCard,
  onUpdateCard,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<'casual' | 'neutral' | 'formal'>('neutral');
  const [userNote, setUserNote] = useState(card?.userNotes || '');

  // Chronological order map (earliest added = No.001)
  const cardChronologicalMap = useMemo(() => {
    return getCardChronologicalMap(allCards);
  }, [allCards]);

  // 跟读评测统一走 SpeechPracticeModal。
  // 这里过去有一整套自己的语音识别 + 打分实现 —— 那是全项目第三份重复实现，
  // 也正是「手机上点了麦克风不显示在录制、也不报错」的那一份：
  // 它的 recognition.onerror 只有一句 console.warn，界面一个字都不显示。
  // 一个功能三套实现必然漂移，所以这里只留一个入口。

  useEffect(() => {
    setSelectedVariant('neutral');
    setUserNote(card?.userNotes || '');
    setVoiceEntryNotice(null);
  }, [card]);

  /** 跟读入口没接通时的兜底提示。理论上不会触发（App 总是传 onOpenSpeechPractice），
   *  但绝不留静默失败 —— 「点了没反应」正是这一轮要消灭的那类 bug。 */
  const [voiceEntryNotice, setVoiceEntryNotice] = useState<string | null>(null);

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

  if (!isOpen || !card) return null;

  const currentText =
    selectedVariant === 'casual' && card.variants?.casual
      ? card.variants.casual
      : selectedVariant === 'formal' && card.variants?.formal
      ? card.variants.formal
      : card.natural;

  const handleCopy = () => {
    sound.playKeyClick();
    navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    sound.playKeyClick();
    speakEnglishText(currentText);
  };

  const handleSaveNote = () => {
    if (onUpdateCard) {
      sound.playKeyClick();
      onUpdateCard({ ...card, userNotes: userNote });
    }
  };

  // 跟读评测统一入口：交给 SpeechPracticeModal。它同时支持语音识别与纯录音回放，
  // 并且每一种失败（没有识别能力 / 麦克风没响应 / 权限被拒）都有界面提示。
  // 过去这里自己实现了一套，onerror 只写 console.warn —— 用户点了没反应也没提示，
  // 正是手机上「点了不显示在录制」的那一份。三套实现必然漂移，只留这一个入口。
  const handleOpenVoicePractice = () => {
    sound.playKeyClick();
    if (onOpenSpeechPractice) {
      onOpenSpeechPractice(card);
      onClose();
      return;
    }
    setVoiceEntryNotice('跟读评测入口未接通，请刷新页面后重试。');
  };

  const nextReviewText = formatNextReviewHuman(card.nextReviewAt);

  return (
    <div
      onClick={() => {
        sound.playKeyClick();
        onClose();
      }}
      className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200 select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg md:max-w-4xl bg-[#f4edd3] rounded-xs shadow-[6px_6px_0px_#0e1610] border-2 border-stone-900 overflow-hidden flex flex-col max-h-[85vh] cursor-default"
      >
        {/* Top Mustard Header Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-[#d49e3d] border-b-2 border-stone-900 flex items-center justify-between text-stone-900">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#243427] inline-block" />
            <span className="font-serif-display font-black text-sm tracking-wide">
              — POST OFFICE TELEGRAPHS · 卷宗电文详情 —
            </span>
            <span className="font-mono text-xs font-bold text-stone-900/80">
              #{card.id.slice(-6)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playKeyClick();
                onToggleFavorite(card.id);
              }}
              className="p-1 rounded-xs hover:bg-[#c99333] text-stone-900 transition-colors cursor-pointer"
              title={card.isFavorite ? '取消收藏' : '加星收藏'}
            >
              <Star
                className={`w-4 h-4 ${card.isFavorite ? 'fill-[#99332e] text-[#99332e]' : 'text-stone-900'}`}
              />
            </button>

            {onDeleteCard && (
              <button
                onClick={() => {
                  if (confirm('确定销毁此电报卷宗吗？')) {
                    sound.playKeyClick();
                    onDeleteCard(card.id);
                    onClose();
                  }
                }}
                className="p-1 rounded-xs hover:bg-[#c99333] text-stone-900 transition-colors cursor-pointer"
                title="销毁电报"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

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
        </div>

        {/* Punch Holes Perforation Row */}
        <div className="punch-holes-row border-b border-dashed border-stone-400/70 bg-[#eee5c6]">
          {Array.from({ length: 28 }).map((_, i) => (
            <div key={i} className="punch-hole-dot" />
          ))}
        </div>

        {/* Dual-Column Body on Tablet/Desktop (md:), Clean Single Column on Mobile */}
        <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto text-stone-900">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {/* LEFT COLUMN: Core Expression + Pronunciation + Speaking Practice */}
            <div className="space-y-4 sm:space-y-5">
              {/* TIER 1: Core Natural Expression */}
              <div className="space-y-3 pb-4 border-b border-dashed border-stone-400">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="border border-stone-900 bg-[#faf7ee] px-2 py-0.5 rounded-xs font-mono text-[11px] font-bold text-stone-800">
                      {card.category || '日常社交'}
                    </span>
                  </div>
                  {card.variants && (
                    <div className="flex items-center gap-1 bg-[#faf7ee] p-0.5 rounded-xs text-[11px] border border-stone-900">
                      <button
                        onClick={() => setSelectedVariant('casual')}
                        className={`px-2 py-0.5 rounded-xs cursor-pointer font-serif-display ${
                          selectedVariant === 'casual'
                            ? 'bg-[#d49e3d] text-stone-950 font-black'
                            : 'text-stone-600'
                        }`}
                      >
                        口语
                      </button>
                      <button
                        onClick={() => setSelectedVariant('neutral')}
                        className={`px-2 py-0.5 rounded-xs cursor-pointer font-serif-display ${
                          selectedVariant === 'neutral'
                            ? 'bg-[#d49e3d] text-stone-950 font-black'
                            : 'text-stone-600'
                        }`}
                      >
                        中性
                      </button>
                      <button
                        onClick={() => setSelectedVariant('formal')}
                        className={`px-2 py-0.5 rounded-xs cursor-pointer font-serif-display ${
                          selectedVariant === 'formal'
                            ? 'bg-[#d49e3d] text-stone-950 font-black'
                            : 'text-stone-600'
                        }`}
                      >
                        机要
                      </button>
                    </div>
                  )}
                </div>

                <div className="font-serif-display text-xl sm:text-2xl font-black text-stone-950 leading-tight">
                  <HighlightedText text={currentText} highlights={card.redHighlights} />
                </div>

                <div className="text-xs sm:text-sm font-serif text-stone-700 bg-[#faf7ee] p-2.5 rounded-xs border border-stone-400">
                  <span className="text-stone-500 font-mono text-xs">发报原稿：</span>
                  {card.original}
                </div>

                {/* Audio & Copy Controls & Open Full Speech Practice Modal */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={handleSpeak}
                    className="flex-1 sm:flex-initial px-3.5 py-2 sm:py-1.5 rounded-xs bg-[#d49e3d] hover:bg-[#c99333] border-2 border-stone-900 text-stone-950 text-xs font-serif-display font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0px_#101711]"
                  >
                    <Volume2 className="w-4 h-4 text-stone-900" />
                    <span>朗读电文</span>
                  </button>

                  <button
                    onClick={handleCopy}
                    className="flex-1 sm:flex-initial px-3 py-2 sm:py-1.5 rounded-xs bg-[#faf7ee] hover:bg-white border-2 border-stone-900 text-stone-800 text-xs font-serif-display font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0px_#101711]"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>复制</span>
                      </>
                    )}
                  </button>

                  {onOpenSpeechPractice && (
                    <button
                      onClick={() => {
                        sound.playKeyClick();
                        onOpenSpeechPractice(card);
                      }}
                      className="w-full sm:w-auto sm:ml-auto px-3.5 py-2 sm:py-1.5 rounded-xs bg-[#243427] hover:bg-[#1b271e] text-[#f7f2e4] text-xs font-serif-display font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border-2 border-stone-900 shadow-[2px_2px_0px_#101711]"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#d49e3d]" />
                      <span>多维发音实训</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Phrases Breakdown if any */}
              {card.phrases && card.phrases.length > 0 && (
                <div className="space-y-2 pb-4 border-b border-dashed border-stone-400">
                  <div className="text-xs font-serif-display font-bold text-stone-800 flex items-center justify-between">
                    <span>📖 核心词组与同义表达</span>
                    <span className="text-[10px] text-stone-500 font-mono">
                      {card.phrases.length} 个重点
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {card.phrases.map((p, idx) => (
                      <div
                        key={idx}
                        className="text-xs p-2.5 rounded-xs bg-[#faf7ee] border border-stone-400 flex items-start justify-between gap-2"
                      >
                        <div>
                          <span className="font-bold text-stone-900 font-serif-display">
                            {p.phrase}
                          </span>
                          {p.meaning && (
                            <span className="text-stone-600 ml-2 font-serif">
                              {p.meaning}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => speakEnglishText(p.phrase)}
                          className="text-stone-500 hover:text-stone-900 shrink-0 cursor-pointer"
                          title="朗读"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-[#d49e3d]" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 跟读评测入口。真正的录音与评测在 SpeechPracticeModal 里，
                  那里对「本机没有语音识别能力」「麦克风没响应」「权限被拒」
                  都会给出界面提示；没有识别能力时只给录音回放对比，绝不编分数。 */}
              <div className="space-y-2.5">
                <div className="text-xs font-serif-display font-bold text-stone-800 flex items-center justify-between">
                  <span>🎙️ 口语跟读评测</span>
                </div>

                <div className="p-3.5 sm:p-4 bg-[#faf7ee] rounded-xs border-2 border-stone-900 flex flex-col items-center justify-center text-center space-y-2.5 shadow-xs">
                  <p className="text-xs text-stone-600 font-serif">
                    点麦克风开始录音跟读。本机不支持语音识别时会明确告诉你，只保留录音回放对比。
                  </p>

                  {voiceEntryNotice && (
                    <p className="text-[11px] text-[#99332e] font-bold">{voiceEntryNotice}</p>
                  )}

                  <button
                    onClick={handleOpenVoicePractice}
                    className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-stone-900 shadow-[2px_2px_0px_#101711] transition-all cursor-pointer bg-[#d49e3d] hover:bg-[#c99333] text-stone-900 active:scale-95"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Context (Markdown) + Memory Schedule + Speech History + Tags */}
            <div className="space-y-4 sm:space-y-5">
              {/* TIER 2: Meaning & Context with Markdown bold support */}
              {card.explanation && (
                <div className="space-y-2 pb-4 border-b border-dashed border-stone-400">
                  <div className="text-xs font-serif-display font-bold text-stone-800 flex items-center gap-1.5">
                    <span>💡 深度语境与用法解析</span>
                  </div>
                  <div className="text-xs sm:text-sm text-stone-800 bg-[#faf7ee] p-3.5 rounded-xs border border-stone-400 leading-relaxed font-serif">
                    <MarkdownRenderer content={card.explanation} />
                  </div>
                </div>
              )}

              {/* TIER 3: Memory Schedule & Ebbinghaus Status */}
              <div className="space-y-2 pb-4 border-b border-dashed border-stone-400">
                <div className="text-xs font-serif-display font-bold text-stone-800 flex items-center justify-between">
                  <span>📅 艾宾浩斯复核档案</span>
                  <span className="text-xs font-mono font-normal text-stone-500">
                    已完成复核 {card.reviewCount || 0} 次
                  </span>
                </div>

                <div className="p-3 bg-[#faf7ee] rounded-xs border border-stone-400 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="text-stone-500 font-mono">下次推荐复核</span>
                    <div className="font-bold text-stone-900 font-serif-display text-sm">
                      {nextReviewText}
                    </div>
                  </div>

                  <span className="border border-[#2a834f] text-[#2a834f] font-mono text-xs font-black px-2 py-0.5 rounded-xs">
                    {card.masteryLevel === 'mastered' ? '深度掌握' : '记忆强化期'}
                  </span>
                </div>
              </div>

              {/* Speech Evaluation History Records */}
              {card.speechRecords && card.speechRecords.length > 0 && (
                <div className="space-y-2 pb-4 border-b border-dashed border-stone-400">
                  <div className="text-xs font-serif-display font-bold text-stone-800 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <History className="w-3.5 h-3.5 text-[#d49e3d]" />
                      <span>历史跟读测评记录 ({card.speechRecords.length})</span>
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {card.speechRecords.slice(-4).reverse().map((rec, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-[#faf7ee] rounded-xs border border-stone-400 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-serif-display text-stone-900">
                              得分 {rec.score} 分
                            </span>
                            <span className="text-[10px] font-mono text-stone-500">
                              准确率: {rec.accuracy}%
                            </span>
                          </div>
                          {rec.feedback && (
                            <p className="text-[11px] text-stone-600 line-clamp-1 mt-0.5 font-serif">
                              {rec.feedback}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-stone-400">
                          {rec.date ? rec.date.slice(5, 10) : '最近'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags and Category Badges */}
              {card.tags && card.tags.length > 0 && (
                <div className="space-y-2 pb-4 border-b border-dashed border-stone-400">
                  <div className="text-xs font-serif-display font-bold text-stone-800">
                    🏷️ 关联电报分类标签
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {card.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="text-xs font-mono text-stone-700 bg-[#faf7ee] px-2.5 py-1 rounded-xs border border-stone-400"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Personal Learning Notes */}
              <div className="space-y-2">
                <div className="text-xs font-serif-display font-bold text-stone-800 flex items-center justify-between">
                  <span>✍️ 机要员备忘 & 记忆线索</span>
                  {onUpdateCard && (
                    <button
                      onClick={handleSaveNote}
                      className="text-[11px] font-mono text-[#99332e] hover:underline cursor-pointer font-bold"
                    >
                      保存备忘
                    </button>
                  )}
                </div>
                <textarea
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  onBlur={handleSaveNote}
                  rows={3}
                  placeholder="在此记录你的语境联想、易混淆短语或个人备忘……"
                  className="w-full bg-[#faf7ee] rounded-xs p-2.5 text-xs text-stone-900 border-2 border-stone-900 outline-none focus:ring-1 focus:ring-[#d49e3d] resize-none font-serif"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
