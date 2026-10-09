import { useEffect, useState } from 'react'
import { ConvertTool } from './components/ConvertTool.tsx'
import { DescribeTool } from './components/DescribeTool.tsx'
import { MergeTool } from './components/MergeTool.tsx'
import { fetchStatus, type AiStatus } from './lib/aiClient.ts'

type Tab = 'merge' | 'convert' | 'describe'

const TABS: { id: Tab; label: string }[] = [
  { id: 'merge', label: 'Merge ID card' },
  { id: 'convert', label: 'Resize and convert' },
  { id: 'describe', label: 'Alt text and crop' },
]

export function App() {
  const [tab, setTab] = useState<Tab>('merge')
  const [status, setStatus] = useState<AiStatus>({ aiEnabled: false, model: '' })

  useEffect(() => {
    void fetchStatus().then(setStatus)
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 32 32">
              <rect x="7" y="9" width="18" height="14" rx="2" fill="#f7f8f6" />
              <circle cx="16" cy="16" r="4" fill="#2f6f68" />
            </svg>
          </div>
          <div>
            <h1>Local Image Studio</h1>
            <p>Merge, resize, convert and describe photos without uploading them.</p>
          </div>
        </div>
        <span className={`pill${status.aiEnabled ? '' : ' off'}`} data-testid="ai-status">
          <span className="dot" />
          {status.aiEnabled ? `AI on: ${status.model}` : 'AI off: local fallback'}
        </span>
      </header>

      <nav className="tabs" role="tablist" aria-label="Tools">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'merge' && <MergeTool />}
      {tab === 'convert' && <ConvertTool />}
      {tab === 'describe' && <DescribeTool aiEnabled={status.aiEnabled} model={status.model} />}

      <footer className="footer">
        Everything runs in this browser tab. The only thing that can leave your machine is a 768 px preview, and only
        when you press the AI button with a key configured.
      </footer>
    </div>
  )
}
