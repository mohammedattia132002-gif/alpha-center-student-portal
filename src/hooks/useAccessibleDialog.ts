import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useAccessibleDialog<T extends HTMLElement>(
  isOpen: boolean,
  onClose: () => void,
) {
  const dialogRef = useRef<T>(null)

  useEffect(() => {
    if (!isOpen || !dialogRef.current) {
      return
    }

    const dialogNode = dialogRef.current
    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow

    const focusableNodes: HTMLElement[] = Array.from(
      dialogNode.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    )
    const initialFocusTarget = focusableNodes[0] ?? dialogNode

    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => {
      initialFocusTarget.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const currentFocusableNodes: HTMLElement[] = Array.from(
        dialogNode.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      )

      if (currentFocusableNodes.length === 0) {
        event.preventDefault()
        dialogNode.focus()
        return
      }

      const firstNode = currentFocusableNodes[0]!
      const lastNode = currentFocusableNodes[currentFocusableNodes.length - 1]!
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null

      if (event.shiftKey && activeElement === firstNode) {
        event.preventDefault()
        lastNode.focus()
      } else if (!event.shiftKey && activeElement === lastNode) {
        event.preventDefault()
        firstNode.focus()
      }
    }

    dialogNode.addEventListener('keydown', handleKeyDown)

    return () => {
      dialogNode.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousActiveElement?.focus()
    }
  }, [isOpen, onClose])

  return dialogRef
}
