import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../utils/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-amber-800 text-amber-100 px-3.5 py-1.5 text-xs font-medium shadow-lg border border-amber-600 animate-in fade-in duration-200">
      <WifiOff className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
      <span>离线模式 — 本地归档与复习功能正常运行</span>
    </div>
  );
};
