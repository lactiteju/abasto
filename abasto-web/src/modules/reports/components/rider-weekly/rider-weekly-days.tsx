import { cn } from '#/lib/utils/cn'
import { focusRing } from '#/modules/reports/components/report-buttons'
import { dayChipLabel } from '#/modules/reports/lib/rider-weekly-week'

type RiderWeeklyDaysProps = {
  days: Array<string>
  /** The day shown; null is the whole week. */
  value: string | null
  /** Days with something sold or lost; the others look quieter. */
  active: ReadonlySet<string>
  onChange: (day: string | null) => void
}

const chip = `${focusRing} min-h-11 rounded-md px-3.5 py-1.5 text-[13px] whitespace-nowrap min-[820px]:min-h-9`

/** "Semana · Lun … Dom": picks the sheet shown below. */
export function RiderWeeklyDays({
  days,
  value,
  active,
  onChange,
}: RiderWeeklyDaysProps) {
  const options: Array<{ day: string | null; label: string }> = [
    { day: null, label: 'Semana' },
    ...days.map((day) => ({ day, label: dayChipLabel(day) })),
  ]
  return (
    <div
      role="group"
      aria-label="Día del reporte"
      className="inline-flex max-w-full justify-self-start overflow-x-auto rounded-[9px] border border-[#e6dfeb] bg-white p-[3px]"
    >
      {options.map((option) => (
        <button
          key={option.day ?? 'semana'}
          type="button"
          aria-pressed={value === option.day}
          onClick={() => onChange(option.day)}
          className={cn(
            chip,
            value === option.day
              ? 'bg-[#3f1266] font-[650] text-white'
              : cn(
                  'hover:bg-muted',
                  option.day === null || active.has(option.day)
                    ? 'text-ink-row'
                    : 'text-muted-foreground/70',
                ),
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
