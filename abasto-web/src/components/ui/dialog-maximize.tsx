import { useState } from 'react'
import { Maximize2Icon, Minimize2Icon } from 'lucide-react'

import { cn } from '#/lib/utils/cn'

/**
 * Full screen: wins over every dialog size when merged last. Inner lists can
 * drop their height cap with `group-data-maximized/dialog:`.
 */
export const maximizedClass =
  'h-dvh max-h-dvh w-screen max-w-none rounded-none sm:max-w-none md:w-screen md:max-w-none'

/** Whether a dialog fills the screen, and the toggle for its corner button. */
export function useMaximized() {
  const [maximized, setMaximized] = useState(false)
  return { maximized, toggle: () => setMaximized((current) => !current) }
}

/** Corner button that lets every dialog grow to the whole screen and back. */
export function MaximizeButton({
  maximized,
  onToggle,
  className,
}: {
  maximized: boolean
  onToggle: () => void
  className?: string
}) {
  const label = maximized ? 'Restaurar tamaño' : 'Pantalla completa'
  return (
    <button
      type="button"
      aria-pressed={maximized}
      title={label}
      onClick={onToggle}
      className={cn(
        'rounded-xs opacity-70 transition-opacity duration-(--duration-hover) ease-out hover:opacity-100 focus:outline-2 focus:outline-offset-2',
        className,
      )}
    >
      {maximized ? (
        <Minimize2Icon className="size-4" />
      ) : (
        <Maximize2Icon className="size-4" />
      )}
      <span className="sr-only">{label}</span>
    </button>
  )
}
