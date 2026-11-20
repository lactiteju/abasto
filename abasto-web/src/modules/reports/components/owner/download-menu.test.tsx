import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { DownloadMenu } from '#/modules/reports/components/owner/download-menu'
import { pdfChoices } from '#/modules/reports/lib/pdf-choices'

describe('DownloadMenu', () => {
  test('is closed until the button is pressed', () => {
    const html = renderToStaticMarkup(
      <DownloadMenu
        choices={pdfChoices('2026-11-19')}
        onPdf={async () => undefined}
        excel={{ month: 'noviembre 2026', onDownload: async () => undefined }}
      />,
    )
    expect(html).toContain('Descargar PDF')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('Excel ·')
  })
})
