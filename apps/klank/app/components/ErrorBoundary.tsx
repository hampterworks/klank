import * as React from 'react'

type ErrorBoundaryProps = {
  children: React.ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, message }
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught an error:', error, info)
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '12px',
            fontFamily: 'Roboto Mono, monospace',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>
            Something went wrong. Reload the app to continue.
          </p>
          {this.state.message && (
            <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>
              {this.state.message}
            </p>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
