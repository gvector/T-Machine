import { useRef } from 'react'
import type { MachineError } from '../engine/types'

const LINE_HEIGHT = 20 // px, keep in sync with .editor-text in index.css

interface Props {
  text: string
  onChange: (text: string) => void
  errors: MachineError[]
}

export function Editor({ text, onChange, errors }: Props) {
  const area = useRef<HTMLTextAreaElement>(null)
  const gutter = useRef<HTMLDivElement>(null)
  const lineCount = text.split('\n').length
  const badLines = new Set(errors.map(e => e.line).filter(Boolean))

  const goToLine = (line: number) => {
    const el = area.current
    if (!el) return
    const start = text.split('\n').slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0)
    el.focus()
    el.setSelectionRange(start, start)
    el.scrollTop = Math.max(0, (line - 4) * LINE_HEIGHT)
  }

  return (
    <div className="editor" data-tour="editor">
      <div className="editor-body">
        <div className="editor-gutter" ref={gutter} aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className={badLines.has(i + 1) ? 'is-bad' : undefined}>{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={area}
          className="editor-text"
          value={text}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-label="Machine file (YAML)"
          onChange={e => onChange(e.target.value)}
          onScroll={e => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop }}
          onKeyDown={e => {
            // Tab inserts two spaces; Escape leaves the editor (so the keyboard shortcuts work again)
            if (e.key === 'Escape') e.currentTarget.blur()
            if (e.key !== 'Tab' || e.shiftKey) return
            e.preventDefault()
            const el = e.currentTarget
            el.setRangeText('  ', el.selectionStart, el.selectionEnd, 'end')
            onChange(el.value)
          }}
        />
      </div>
      {errors.length > 0 && (
        <div className="editor-errors" data-tour="errors" role="status">
          <p>The diagram shows the last version that worked. Fix these to update it:</p>
          <ul>
            {errors.map((e, i) => (
              <li key={i}>
                {e.line
                  ? <button type="button" onClick={() => goToLine(e.line!)}>Line {e.line}</button>
                  : <span className="no-line">File</span>}
                <span>{e.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
