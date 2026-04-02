import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0a0a0a] p-6 arabic-font transition-colors duration-500" dir="rtl">
          <div className="max-w-md w-full bg-white dark:bg-[#111] rounded-3xl shadow-xl p-10 border border-red-100 dark:border-red-900/30 text-center transition-colors duration-500">
            <div className="bg-red-50 dark:bg-red-900/10 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8 transition-colors duration-500">
              <AlertCircle className="text-red-600 dark:text-red-400 w-10 h-10 transition-colors duration-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 transition-colors duration-500">عذراً، حدث خطأ ما</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed transition-colors duration-500 text-lg">
              حدث خطأ غير متوقع في التطبيق. يرجى محاولة تحديث الصفحة.
            </p>
            <div className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl overflow-auto max-h-32 text-left dir-ltr transition-colors duration-500 font-mono border border-slate-100 dark:border-slate-800/50">
              {this.state.error?.message}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="mt-8 w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 py-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-[1.02] shadow-sm text-lg"
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}

export default ErrorBoundary;
