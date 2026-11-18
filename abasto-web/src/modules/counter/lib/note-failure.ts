import { ClientError, genericErrorMessage } from '#/lib/boundary'

export const staleBuildMessage =
  'No se pudo cargar el generador de PDF. Recarga la página e inténtalo de nuevo.'

/** A lazy chunk that no longer exists or cannot be fetched (e.g. after a deploy). */
const chunkLoadFailure =
  /dynamically imported module|importing a module script failed|loading chunk|loading css chunk/i

/** Toast text for a failed «Nota PDF»: server message, stale-build hint or generic. */
export function noteFailureMessage(failure: unknown): string {
  if (failure instanceof ClientError) return failure.message
  if (failure instanceof Error && chunkLoadFailure.test(failure.message)) {
    return staleBuildMessage
  }
  return genericErrorMessage
}
