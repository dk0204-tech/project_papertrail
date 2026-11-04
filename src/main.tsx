import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { PaperTrailProvider } from './store/PaperTrailStore'
import './index.css'

// BrowserRouter lives here (outside App) so any component — including route
// elements — can use router hooks alongside the PaperTrail store.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PaperTrailProvider>
        <App />
      </PaperTrailProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
