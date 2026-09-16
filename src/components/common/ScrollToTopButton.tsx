import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { sound } from '../../utils/audio';

interface ScrollToTopButtonProps {
  threshold?: number;
  className?: string;
}

export const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({
  threshold = 200,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      setIsVisible(scrollY > threshold);
    };

    // Initial check
    checkScroll();

    window.addEventListener('scroll', checkScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', checkScroll);
    };
  }, [threshold]);

  const scrollToTop = () => {
    sound.playKeyClick();
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
    document.documentElement.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
    document.body.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <div
      className={`fixed bottom-20 right-4 sm:right-6 lg:right-8 z-40 transition-all duration-300 transform ${
        isVisible
          ? 'opacity-100 translate-y-0 pointer-events-auto scale-100'
          : 'opacity-0 translate-y-6 pointer-events-none scale-90'
      } ${className}`}
    >
      <button
        type="button"
        onClick={scrollToTop}
        title="返回顶部"
        aria-label="返回顶部"
        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#38462f] hover:bg-[#2a3623] dark:bg-[#46553b] dark:hover:bg-[#556748] text-white border-2 border-[#dfa938] shadow-lg hover:shadow-xl flex items-center justify-center transition-all active:scale-90 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#dfa938]/60"
      >
        <ArrowUp className="w-5 h-5 text-amber-300 group-hover:text-amber-100 transition-transform duration-200 group-hover:-translate-y-0.5" />
      </button>
    </div>
  );
};
