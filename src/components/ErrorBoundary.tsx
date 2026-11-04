import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('PaperTrail ErrorBoundary caught an error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 border border-rose-300 shadow-lift">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <p className="eyebrow text-rose-700">Application Error</p>
          <h1 className="mt-3 text-3xl font-display text-graphite">Something went wrong in the archive.</h1>
          <p className="mt-3 text-sm text-graphite-600 leading-relaxed">
            PaperTrail encountered an unexpected rendering or state error. Your local archive and papers are preserved.
          </p>
          {this.state.error && (
            <div className="mt-5 w-full rounded-xl bg-stone-900 p-4 text-left font-mono text-xs text-rose-300 overflow-x-auto shadow-inner">
              {this.state.error.message}
            </div>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="btn-primary !px-6 !py-3 inline-flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" /> Reload application
            </button>
            <Link to="/dashboard" className="btn-ghost !px-6 !py-3 inline-flex items-center gap-2">
              <Home className="h-4 w-4" /> Return to dashboard
            </Link>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
