import { useEffect } from 'react'

type UseActionsMenuOptions = {
  isOpen: boolean
  onClose: () => void
  menuSelector?: string
}

export function useActionsMenu({
  isOpen,
  onClose,
  menuSelector = '.menu-shell',
}: UseActionsMenuOptions) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Element && event.target.closest(menuSelector)) {
        return
      }

      onClose()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, menuSelector, onClose])
}
