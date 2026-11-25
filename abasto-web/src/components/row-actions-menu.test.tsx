import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { RowActionsMenu } from '#/components/row-actions-menu'

describe('RowActionsMenu', () => {
  test('renders a closed «⋯» button with the given accessible name', () => {
    const html = renderToStaticMarkup(
      <RowActionsMenu
        label="Acciones de PED-1"
        items={[{ key: 'view', label: 'Ver pedido', onSelect: () => {} }]}
      />,
    )
    expect(html).toContain('aria-label="Acciones de PED-1"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('Ver pedido')
  })

  test('renders nothing without items', () => {
    expect(
      renderToStaticMarkup(<RowActionsMenu label="Acciones" items={[]} />),
    ).toBe('')
  })
})
