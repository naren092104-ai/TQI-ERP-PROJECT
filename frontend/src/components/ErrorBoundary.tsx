import React, { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-white rounded-md border border-slate-200 p-6 shadow-sm text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <span className="material-symbols-outlined text-[30px]">warning</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">Something went wrong</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              An unexpected render issue occurred. You can safely reset the current view to continue working.
            </p>
            {this.state.error && (
              <div className="text-left bg-slate-100 p-3 rounded-md text-[11px] font-mono text-slate-700 max-h-32 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="w-full py-2.5 px-4 bg-[#002869] hover:bg-[#0b3d91] text-white text-xs font-bold rounded-md transition-all shadow-xs cursor-pointer"
            >
              Reset &amp; Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

