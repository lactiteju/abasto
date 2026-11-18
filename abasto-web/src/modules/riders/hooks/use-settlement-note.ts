import { toast } from 'sonner'

import { noteFailureMessage } from '#/modules/counter/lib/note-failure'
import { buildSettlementNote } from '#/modules/riders/lib/settlement-note'
import type { AssignmentDetail } from '#/modules/riders/services/assignment-reads'

/**
 * Downloads the «Nota de remisión» PDF of a settled assignment. Errors surface
 * as a toast. A plain function, so it still works after its dialog closed.
 */
export async function printSettlementNote(
  assignment: AssignmentDetail,
  warehouseName: string,
  businessName: string,
) {
  try {
    const note = buildSettlementNote(assignment, {
      business: businessName,
      warehouseName,
    })
    const { downloadRemissionNote } =
      await import('#/modules/counter/lib/remission-note-pdf')
    await downloadRemissionNote(note)
  } catch (failure) {
    console.error('Nota PDF', failure)
    toast.error(noteFailureMessage(failure))
  }
}
