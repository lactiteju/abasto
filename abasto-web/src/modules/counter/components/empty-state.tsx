import type { ReactNode } from 'react'

import { useLateEnter } from '#/components/layout/use-late-enter'

const shell =
  'flex flex-col items-center gap-[15px] rounded-[14px] border border-dashed border-[#e6dfeb] bg-white px-[25px] py-[60px] text-center text-[#91757e]'

/** Dashed empty state. With an icon the message is a 14px paragraph; without, plain text. */
export function EmptyState({
  icon,
  children,
}: {
  icon?: ReactNode
  children: ReactNode
}) {
  const lateEnter = useLateEnter()
  if (!icon)
    return (
      <p {...lateEnter} className={shell}>
        {children}
      </p>
    )

  return (
    <div {...lateEnter} className={shell}>
      {icon}
      <p className="text-sm">{children}</p>
    </div>
  )
}
