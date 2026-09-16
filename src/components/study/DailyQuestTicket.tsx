import React from 'react';
import { Zap, Check, Gift } from 'lucide-react';
import confetti from 'canvas-confetti';
import { DailyQuest } from '../../types';
import { sound } from '../../utils/audio';

interface DailyQuestTicketProps {
  quests: DailyQuest[];
  onClaimQuest: (questId: string) => void;
  className?: string;
}

export const DailyQuestTicket: React.FC<DailyQuestTicketProps> = ({
  quests,
  onClaimQuest,
  className = '',
}) => {
  const handleClaim = (quest: DailyQuest) => {
    sound.playSuccess();
    confetti({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.65 },
    });
    onClaimQuest(quest.id);
  };

  const completedCount = quests.filter((q) => q.completed || q.claimed).length;

  return (
    <div className={`relative w-full transition-transform select-none ${className}`}>
      {/* Decorative Vintage Paperclip on top right */}
      <div className="absolute -top-2 right-5 z-20 pointer-events-none">
        <div className="w-3 h-5.5 border-[1.5px] border-[var(--tel-brass-gold)] rounded-t-full rotate-[15deg] shadow-xs" />
      </div>

      {/* Perforated Daily Quest Paper Ticket Card */}
      <div className="relative bg-[var(--tel-paper-card)] rounded-xl p-2.5 sm:p-3 border border-[var(--tel-paper-border)] shadow-xs">
        {/* Ticket Perforated Header */}
        <div className="flex items-center justify-between border-b border-dashed border-[var(--tel-paper-border)] pb-1.5 mb-1.5">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-[var(--tel-brass-gold)]" />
            <span className="font-serif-display font-bold text-xs text-stone-800 dark:text-stone-100">
              今日值机差饷清单
            </span>
            <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-[var(--tel-paper-aged)] border border-[var(--tel-paper-border)] text-[var(--tel-green-800)] dark:text-[var(--tel-green-200)]">
              {completedCount}/{quests.length} 完成
            </span>
          </div>

          <span className="font-mono text-[8px] text-stone-400 tracking-wider">
            DAILY DISPATCH
          </span>
        </div>

        {/* Quest List Items - Compact rows */}
        <div className="space-y-1">
          {quests.map((quest) => {
            const isDone = quest.current >= quest.target;
            const isClaimed = quest.claimed;

            return (
              <div
                key={quest.id}
                className={`border rounded-lg px-2 py-1 flex items-center justify-between gap-1.5 shadow-2xs transition-all ${
                  isClaimed
                    ? 'bg-[var(--tel-paper-card-subtle)] border-[var(--tel-paper-border)] text-stone-400 line-through opacity-75'
                    : isDone
                    ? 'bg-[var(--tel-paper-buff)] border-[var(--tel-brass-gold)] text-stone-900 dark:text-stone-100'
                    : 'bg-[var(--tel-paper-card-subtle)] border-[var(--tel-paper-border)] text-stone-800 dark:text-stone-200'
                }`}
              >
                {/* Left Task Info */}
                <div className="space-y-0 flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[11px] font-bold truncate ${
                        isClaimed ? 'line-through text-stone-400' : ''
                      }`}
                    >
                      {quest.title}
                    </span>
                    <span className="text-[8.5px] font-mono font-bold px-1 py-0.1 rounded-xs bg-[var(--tel-paper-aged)] shrink-0 text-stone-600 dark:text-stone-300">
                      {quest.current}/{quest.target}
                    </span>
                  </div>
                  <p className="text-[9.5px] text-stone-500 dark:text-stone-400 truncate leading-tight">
                    {quest.description}
                  </p>
                </div>

                {/* Right Action / Reward Button */}
                <div className="shrink-0 flex items-center gap-1">
                  {isClaimed ? (
                    <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 flex items-center gap-0.5">
                      <Check className="w-2 h-2" />
                      <span>已领</span>
                    </span>
                  ) : isDone ? (
                    <button
                      type="button"
                      onClick={() => handleClaim(quest)}
                      className="keycap-btn px-2 py-0.5 rounded-full bg-[var(--tel-brass-gold)] hover:brightness-105 text-stone-950 text-[9px] font-black shadow-xs flex items-center gap-0.5 active:scale-95 transition-transform cursor-pointer animate-pulse"
                    >
                      <Gift className="w-2.5 h-2.5" />
                      <span>+{quest.rewardFeathers}🪶 领</span>
                    </button>
                  ) : (
                    <span className="text-[9px] font-mono text-stone-500 font-medium px-1.5 py-0.5 rounded-full bg-[var(--tel-paper-aged)] border border-[var(--tel-paper-border)]">
                      +{quest.rewardFeathers}🪶
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
