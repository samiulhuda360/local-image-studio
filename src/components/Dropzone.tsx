import { useId, useRef, useState, type DragEvent } from 'react'

interface Props {
  label: string
  hint?: string
  multiple?: boolean
  onFiles: (files: File[]) => void
}

function imageFiles(list: FileList | null): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith('image/'))
}

export function Dropzone({ label, hint, multiple = false, onFiles }: Props) {
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setOver(false)
    const files = imageFiles(e.dataTransfer.files)
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }

  return (
    <div
      className={`dropzone${over ? ' over' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <strong>{label}</strong>
      <div style={{ fontSize: 12.5, marginTop: 4 }}>{hint ?? 'Drop an image here or click to choose'}</div>
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        data-testid="file-input"
        onChange={(e) => {
          const files = imageFiles(e.target.files)
          if (files.length) onFiles(files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
