import { describe, expect, mock, test } from 'bun:test'
import { Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import * as real from '#/components/ui/select'

type RootProps = {
  value: string | null
  onValueChange: (value: string, details: unknown) => void
}

// Wrap the real Select so a test can reach the handler ui-sdk would call.
const roots: Array<RootProps> = []
const actual = { ...real }
mock.module('#/components/ui/select', () => ({
  ...actual,
  Select: (props: Parameters<typeof actual.Select>[0]) => {
    roots.push(props as unknown as RootProps)
    return actual.Select(props)
  },
}))
const { NativeSelect, readOptions } = await import('#/components/native-select')

const render = (element: React.ReactElement) => renderToStaticMarkup(element)
const trigger = (html: string) =>
  html.match(/<span data-slot="select-value"[^>]*>([^<]*)<\/span>/)?.[1]

describe('readOptions', () => {
  test('reads options through fragments, conditionals and arrays', () => {
    const list = (extra: boolean) => (
      <>
        {extra && <option value="x">oculta</option>}
        <option value="">Todos</option>
        <Fragment>
          {['a', 'b'].map((id) => (
            <option key={id} value={id}>
              {id}
              {id === 'b' ? ' (inactivo)' : ''}
            </option>
          ))}
        </Fragment>
        <option disabled value="z">
          Fuera
        </option>
      </>
    )
    const nodes = readOptions(list(false))
    expect(nodes).toEqual([
      { kind: 'option', value: '', label: 'Todos', disabled: false },
      { kind: 'option', value: 'a', label: 'a', disabled: false },
      { kind: 'option', value: 'b', label: 'b (inactivo)', disabled: false },
      { kind: 'option', value: 'z', label: 'Fuera', disabled: true },
    ])
    expect(readOptions(list(true))[0]).toMatchObject({ value: 'x' })
  })

  test('an option without value uses its text, and groups keep their options', () => {
    const nodes = readOptions(
      <>
        <option>Activa</option>
        <optgroup label="Frutas">
          <option value="m">Manzana</option>
        </optgroup>
      </>,
    )
    expect(nodes[0]).toMatchObject({ value: 'Activa', label: 'Activa' })
    expect(nodes[1]).toMatchObject({
      kind: 'group',
      label: 'Frutas',
      options: [{ value: 'm', label: 'Manzana' }],
    })
  })
})

describe('NativeSelect', () => {
  test('the trigger shows the label of the selected option', () => {
    const html = render(
      <NativeSelect aria-label="Almacén" value="b">
        <option value="a">Uno</option>
        <option value="b">Dos</option>
      </NativeSelect>,
    )
    expect(trigger(html)).toBe('Dos')
    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-label="Almacén"')
  })

  test('the "" option is shown, in text color, while "" is the value', () => {
    const html = render(
      <NativeSelect aria-label="Proveedor" value="">
        <option value="">Todos los proveedores</option>
        <option value="s1">LALA</option>
      </NativeSelect>,
    )
    expect(trigger(html)).toBe('Todos los proveedores')
    expect(html).toContain('data-placeholder:text-inherit')
  })

  test('a disabled "" option stays a muted placeholder', () => {
    const html = render(
      <NativeSelect aria-label="Almacén" value="">
        <option value="" disabled>
          Selecciona un almacén
        </option>
        <option value="w1">Centro</option>
      </NativeSelect>,
    )
    expect(trigger(html)).toBe('Selecciona un almacén')
    expect(html).not.toContain('data-placeholder:text-inherit')
  })

  test('uncontrolled, it starts on the first enabled option', () => {
    const html = render(
      <NativeSelect aria-label="Estado">
        <option value="" disabled>
          Elige
        </option>
        <option value="a">Activo</option>
      </NativeSelect>,
    )
    expect(trigger(html)).toBe('Activo')
  })

  test('name and required reach the form field, which stays empty with ""', () => {
    const picked = render(
      <NativeSelect name="almacen" required value="w1" aria-label="Almacén">
        <option value="">Elige</option>
        <option value="w1">Centro</option>
      </NativeSelect>,
    )
    expect(picked).toMatch(/<textarea[^>]* name="almacen" required=""/)
    expect(picked).toMatch(/>w1<\/textarea>/)

    const empty = render(
      <NativeSelect name="almacen" value="" aria-label="Almacén">
        <option value="">Elige</option>
        <option value="w1">Centro</option>
      </NativeSelect>,
    )
    expect(empty).toMatch(/<textarea[^>]* name="almacen"[^>]*><\/textarea>/)
    expect(empty).not.toContain('required=""')
  })

  test('disabled disables the trigger', () => {
    const html = render(
      <NativeSelect disabled value="a" aria-label="Estado">
        <option value="a">Activo</option>
      </NativeSelect>,
    )
    expect(html).toMatch(/<button[^>]* data-disabled=""/)
  })

  test('onChange gets target.value and target.name, "" for the empty option', () => {
    const seen: Array<{ value: string; name: string }> = []
    roots.length = 0
    render(
      <NativeSelect
        name="proveedor"
        value="s1"
        aria-label="Proveedor"
        onChange={(event) => seen.push(event.target)}
      >
        <option value="">Todos</option>
        <option value="s1">LALA</option>
        <option value="s2">Bimbo</option>
      </NativeSelect>,
    )
    const root = roots.at(-1)!
    expect(root.value).toBe('s1')
    root.onValueChange('s2', {})
    // ui-sdk is given the "" option under a stand-in value, mapped back here.
    root.onValueChange('__native-select-empty__', {})
    expect(seen).toEqual([
      { value: 's2', name: 'proveedor' },
      { value: '', name: 'proveedor' },
    ])
  })
})
