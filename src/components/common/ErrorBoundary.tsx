import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 my-8 mx-auto max-w-lg bg-[#faf7ee] dark:bg-[#1a251c] border-2 border-stone-900 shadow-[4px_4px_0px_#101711] rounded-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 border-2 border-amber-600 flex items-center justify-center text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-serif-display font-black text-lg text-stone-900 dark:text-stone-100">
              {this.props.fallbackTitle || '通信线路出现临时故障'}
            </h3>
            <p className="text-xs font-mono text-stone-600 dark:text-stone-400">
              {this.state.error?.message || '页面渲染异常，数据档案完好。'}
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#d49e3d] hover:bg-[#c99333] active:translate-y-0.5 text-stone-950 font-serif-display font-bold text-xs border-2 border-stone-900 shadow-[2px_2px_0px_#101711] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>重新连接值机台</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
