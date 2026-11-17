import type { ChangeEvent, ComponentProps } from 'react'

/** Quantities: keep digits only. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Money/decimals: keep digits and the first decimal point, with at most
 * `maxDecimals` digits after it. Everything else is dropped.
 */
export function decimalInput(value: string, maxDecimals = 2): string {
  const cleaned = value.replace(/[^\d.]/g, '')
  const dot = cleaned.indexOf('.')
  if (dot === -1) return cleaned
  const whole = cleaned.slice(0, dot)
  const fraction = cleaned.slice(dot + 1).replace(/\./g, '')
  return `${whole}.${fraction.slice(0, maxDecimals)}`
}

type InputMode = ComponentProps<'input'>['inputMode']

/** Sanitizer for an input mode, or null when the field is free text. */
export function numericSanitizer(
  inputMode: InputMode,
  maxDecimals = 2,
): ((value: string) => string) | null {
  if (inputMode === 'numeric') return digitsOnly
  if (inputMode === 'decimal')
    return (value) => decimalInput(value, maxDecimals)
  return null
}

/**
 * Drops disallowed characters from a controlled input's change event before
 * the caller reads `event.target.value`, keeping the caret where the user was.
 */
export function sanitizeChange(
  event: ChangeEvent<HTMLInputElement>,
  inputMode: InputMode,
  maxDecimals = 2,
): void {
  const sanitize = numericSanitizer(inputMode, maxDecimals)
  if (!sanitize) return
  const target = event.target
  const typed = target.value
  const clean = sanitize(typed)
  if (clean === typed) return
  const caret = target.selectionStart ?? typed.length
  const keptBeforeCaret = sanitize(typed.slice(0, caret)).length
  target.value = clean
  try {
    target.setSelectionRange(keptBeforeCaret, keptBeforeCaret)
  } catch {
    // Some input types do not support selection; the caret is not essential.
  }
}

/** Wraps an `onChange` so numeric fields are sanitized before it runs. */
export function withNumericChange(
  onChange: ComponentProps<'input'>['onChange'],
  inputMode: InputMode,
  maxDecimals?: number,
): ComponentProps<'input'>['onChange'] {
  if (!onChange || (inputMode !== 'numeric' && inputMode !== 'decimal')) {
    return onChange
  }
  return (event) => {
    sanitizeChange(event, inputMode, maxDecimals)
    onChange(event)
  }
}

/** `type="number"` also lets "e", "+" and "-" through; none is valid in these amounts. */
export function blockNumberSymbols(
  type: string | undefined,
  onKeyDown: ComponentProps<'input'>['onKeyDown'],
): ComponentProps<'input'>['onKeyDown'] {
  if (type !== 'number') return onKeyDown
  return (keyEvent) => {
    if (['e', 'E', '+', '-'].includes(keyEvent.key)) keyEvent.preventDefault()
    onKeyDown?.(keyEvent)
  }
}
