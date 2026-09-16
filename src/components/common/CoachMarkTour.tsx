import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sound } from '../../utils/audio';

/** 单步引导：高亮一个真实控件，气泡贴在它旁边 */
interface CoachStep {
  /** CSS 选择器，按顺序取第一个存在的（同一步在桌面/移动端可能指向不同元素） */
  targets: string[];
  /** 一句话，简短 */
  text: string;
  /**
   * 什么行为算完成这一步：
   * - input：在目标框里输入了内容
   * - click：点了目标控件
   * 不填则只能靠「下一步」。
   */
  advanceOn?: 'input' | 'click';
}

interface CoachMarkTourProps {
  isOpen: boolean;
  /** 跳过或走完都会调用 */
  onClose: () => void;
  /** 走完全程（区别于跳过） */
  onFinish: () => void;
}

const STEP_POLL_MS = 250;
/** 目标元素找不到时的等待上限：约 6 秒后自动跳过这一步 */
const STEP_MAX_TRIES = 24;

const STEPS: CoachStep[] = [
  {
    targets: ['#typewriter-input-area'],
    text: '先在这里写一句中文。',
    advanceOn: 'input',
  },
  {
    targets: ['#transmit-telegram-btn'],
    text: '点「拍发电报」，重点词会自动标红。',
    advanceOn: 'click',
  },
  {
    targets: ['#desktop-archive-btn', '#mobile-modal-archive-btn'],
    text: '归档后，它会按艾宾浩斯提醒你复习。',
    advanceOn: 'click',
  },
];

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function findTarget(step: CoachStep): Element | null {
  for (const selector of step.targets) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

function readRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/**
 * 组件旁引导（coach mark）。
 *
 * 与弹窗式引导的区别：不遮挡内容、不用读完一段话，
 * 而是把气泡贴到界面上真实存在的控件旁边，用户按提示点一下就自动进入下一步。
 */
export const CoachMarkTour: React.FC<CoachMarkTourProps> = ({ isOpen, onClose, onFinish }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  // 不要在 setState 的 updater 里做副作用（StrictMode 下会跑两次），所以先判断再设值
  const goNext = useCallback(() => {
    if (stepIndex >= STEPS.length - 1) {
      onFinish();
      return;
    }
    setStepIndex(stepIndex + 1);
  }, [stepIndex, onFinish]);

  // 定位：轮询等待目标出现（拍发后归档按钮要等 AI 返回才渲染），出现后跟随滚动
  useEffect(() => {
    if (!isOpen) return;
    let tries = 0;
    let scrolledOnce = false;

    const tick = () => {
      const el = findTarget(step);
      if (!el) {
        tries += 1;
        // 这一步在这台设备上不存在（比如手机端没有桌面回电卡），跳过它
        if (tries >= STEP_MAX_TRIES) {
          setRect(null);
          goNext();
        }
        return;
      }
      tries = 0;
      const next = readRect(el);
      if (!scrolledOnce && (next.top < 8 || next.top + next.height > window.innerHeight - 8)) {
        scrolledOnce = true;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      setRect(next);
    };

    tick();
    const timer = window.setInterval(tick, STEP_POLL_MS);
    window.addEventListener('scroll', tick, true);
    window.addEventListener('resize', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('scroll', tick, true);
      window.removeEventListener('resize', tick);
    };
  }, [isOpen, step, goNext]);

  // 点目标控件即完成本步
  useEffect(() => {
    if (!isOpen || step.advanceOn !== 'click') return;
    const onClick = (e: MouseEvent) => {
      const node = e.target as Node;
      if (bubbleRef.current?.contains(node)) return;
      const el = findTarget(step);
      if (el && (el === node || el.contains(node))) {
        sound.playKeyClick();
        goNext();
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [isOpen, step, goNext]);

  // 在目标框里真的打字了，才算完成本步
  useEffect(() => {
    if (!isOpen || step.advanceOn !== 'input') return;
    const el = findTarget(step);
    if (!el) return;
    const onInput = () => {
      const value = (el as HTMLTextAreaElement | HTMLInputElement).value || '';
      if (value.trim().length >= 2) goNext();
    };
    el.addEventListener('input', onInput);
    return () => el.removeEventListener('input', onInput);
  }, [isOpen, step, rect, goNext]);

  // 气泡位置：优先放在目标下方，空间不够就放到上方
  const bubbleStyle = useMemo<React.CSSProperties>(() => {
    if (!rect) return { left: 0, top: 0, opacity: 0 };
    const width = Math.min(300, window.innerWidth - 32);
    const gap = 14;
    const belowSpace = window.innerHeight - (rect.top + rect.height);
    const placeBelow = belowSpace >= rect.top || belowSpace > 170;
    const left = Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 16));
    const top = placeBelow ? rect.top + rect.height + gap : rect.top - gap;
    return {
      left,
      top,
      width,
      transform: placeBelow ? undefined : 'translateY(-100%)',
    };
  }, [rect]);

  if (!isOpen) return null;

  const pad = 5;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none" id="lingolog-coachmark">
      {/* 遮罩：四块拼起来，中间给目标留一个可点击的洞 */}
      {rect ? (
        <>
          <div
            className="absolute bg-stone-950/70"
            style={{ left: 0, top: 0, right: 0, height: Math.max(0, rect.top - pad), pointerEvents: 'auto' }}
          />
          <div
            className="absolute bg-stone-950/70"
            style={{ left: 0, top: rect.top + rect.height + pad, right: 0, bottom: 0, pointerEvents: 'auto' }}
          />
          <div
            className="absolute bg-stone-950/70"
            style={{
              left: 0,
              top: Math.max(0, rect.top - pad),
              width: Math.max(0, rect.left - pad),
              height: rect.height + pad * 2,
              pointerEvents: 'auto',
            }}
          />
          <div
            className="absolute bg-stone-950/70"
            style={{
              left: rect.left + rect.width + pad,
              top: Math.max(0, rect.top - pad),
              right: 0,
              height: rect.height + pad * 2,
              pointerEvents: 'auto',
            }}
          />
          <div
            className="absolute rounded-xs border-2 border-[#d49e3d]"
            style={{
              left: rect.left - pad,
              top: rect.top - pad,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
              pointerEvents: 'none',
              boxShadow: '0 0 20px rgba(212,158,61,0.45)',
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-stone-950/70" style={{ pointerEvents: 'auto' }} />
      )}

      {/* 气泡 */}
      <div
        ref={bubbleRef}
        className="absolute bg-[#f4edd3] border-2 border-stone-900 shadow-[4px_4px_0px_#0e1610] rounded-xs p-3"
        style={{ ...bubbleStyle, pointerEvents: 'auto' }}
      >
        <p className="font-serif text-[13px] leading-relaxed text-stone-900">{step.text}</p>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] font-bold text-stone-500">
            {stepIndex + 1}/{STEPS.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                sound.playKeyClick();
                onClose();
              }}
              className="text-[11px] font-serif text-stone-500 hover:text-stone-900 cursor-pointer"
            >
              跳过
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playKeyClick();
                goNext();
              }}
              className="px-3 py-1.5 bg-[#46553b] hover:bg-[#38462f] text-white text-[11px] font-bold rounded-xs border border-stone-900 cursor-pointer"
            >
              {isLastStep ? '开始使用' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
