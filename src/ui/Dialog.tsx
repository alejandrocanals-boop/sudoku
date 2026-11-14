import { useEffect, useId, useRef, type ReactNode } from 'react'

export function Dialog({ title, children, onCancel }: { title: string; children: ReactNode; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = ref.current!
    element.showModal()
    return () => element.close()
  }, [])
  return <dialog className="dialog" ref={ref} aria-labelledby={titleId} onCancel={event => {
    event.preventDefault()
    onCancel()
  }}>
    <h2 id={titleId}>{title}</h2>
    {children}
  </dialog>
}
