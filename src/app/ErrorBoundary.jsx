// Last line of defense: if a screen ever crashes, show a calm way forward
// instead of a blank page. Visits and cards are saved, so nothing is lost.
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[Beside] Screen crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="notfound" role="alert">
        <h1>Something went wrong</h1>
        <p className="muted">This screen hit a problem. Your card and visits are saved on this device.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Reload
          </button>
          <a className="btn btn--secondary" href="/">
            Go home
          </a>
        </div>
      </main>
    )
  }
}
