import React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  errorMessage?: string;
};

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || "Unexpected error" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Dashboard error boundary caught", error, info);
  }

  handleReload = () => {
    try {
      this.setState({ hasError: false, errorMessage: undefined });
      window.location.reload();
    } catch {
      // ignore
    }
  };

  handleClearCache = () => {
    try {
      if (typeof window !== 'undefined') {
        // Remove known local caches used by the app
        const keys = Object.keys(window.localStorage || {}).filter((k) => k.startsWith('joat:'));
        keys.forEach((k) => {
          try { window.localStorage.removeItem(k); } catch {}
        });
      }
    } catch {}
    this.handleReload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            {this.state.errorMessage ? (
              <p className="text-sm text-muted-foreground">{this.state.errorMessage}</p>
            ) : null}
            <p className="text-sm text-muted-foreground">We logged the error. Try a quick fix below—if it persists, contact support.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              Reload dashboard
            </button>
            <button
              type="button"
              onClick={this.handleClearCache}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:border-primary/50 hover:bg-primary/10"
            >
              Clear cache & reload
            </button>
            <a
              href="/"
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:border-primary/50 hover:bg-primary/10"
            >
              Go to home
            </a>
            <a
              href="https://discord.gg/sjsJwdZPew"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:border-primary/50 hover:bg-primary/10"
            >
              Open support
            </a>
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}

export default ErrorBoundary;

