import { exactAmountText } from '#/modules/riders/lib/exact-amount'

/**
 * Text of the «Dinero entregado» field. Until the user types (`typed` is
 * null) it follows the expected amount; once typed, their text is kept.
 */
export function deliveredText(
  typed: string | null,
  expectedCents: number,
): string {
  return typed ?? exactAmountText(expectedCents)
}
