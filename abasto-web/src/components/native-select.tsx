import * as React from 'react'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { cn } from '#/lib/utils/cn'

/** ui-sdk reads "" as an item without a value, so the "" option travels as this. */
const EMPTY = '__native-select-empty__'

type OptionNode = {
  kind: 'option'
  value: string
  label: string
  disabled: boolean
}
type GroupNode = {
  kind: 'group'
  label: string
  disabled: boolean
  options: Array<OptionNode>
}
type Node = OptionNode | GroupNode

export type NativeSelectChangeEvent = {
  target: { value: string; name: string }
  currentTarget: { value: string; name: string }
}

type NativeSelectProps = Pick<
  React.ComponentProps<'select'>,
  | 'id'
  | 'name'
  | 'form'
  | 'required'
  | 'disabled'
  | 'autoComplete'
  | 'className'
  | 'title'
  | 'aria-label'
  | 'aria-labelledby'
  | 'aria-describedby'
  | 'aria-invalid'
  | 'children'
> & {
  value?: string | number
  defaultValue?: string | number
  /** Receives `{ target: { value, name } }`, which is all a select handler reads. */
  onChange?: (event: NativeSelectChangeEvent) => void
  /** Shown while the "" option is not offered; the "" option's text wins otherwise. */
  placeholder?: string
  size?: 'default' | 'sm'
}

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (React.isValidElement(node)) {
    return textOf((node.props as { children?: React.ReactNode }).children)
  }
  return ''
}

/** Reads `<option>`, `<optgroup>` and fragments, like a native select does. */
export function readOptions(children: React.ReactNode): Array<Node> {
  const nodes: Array<Node> = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const props = child.props as {
      value?: string | number
      label?: string
      disabled?: boolean
      children?: React.ReactNode
    }
    if (child.type === React.Fragment) {
      nodes.push(...readOptions(props.children))
    } else if (child.type === 'option') {
      const label = textOf(props.children)
      nodes.push({
        kind: 'option',
        value: props.value == null ? label : String(props.value),
        label: props.label ?? label,
        disabled: Boolean(props.disabled),
      })
    } else if (child.type === 'optgroup') {
      nodes.push({
        kind: 'group',
        label: props.label ?? '',
        disabled: Boolean(props.disabled),
        options: readOptions(props.children).filter(
          (node): node is OptionNode => node.kind === 'option',
        ),
      })
    }
  })
  return nodes
}

const flatten = (nodes: Array<Node>): Array<OptionNode> =>
  nodes.flatMap((node) => (node.kind === 'group' ? node.options : [node]))

const toItem = (option: OptionNode) => ({
  value: option.value === '' ? EMPTY : option.value,
  label: option.label,
  disabled: option.disabled,
})

/**
 * Drop-in for a native `<select>` that renders the ui-sdk select: same
 * `<option>` children, `value`/`onChange`, `name`, `required` and `disabled`.
 * `className` styles the trigger.
 */
export function NativeSelect({
  value,
  defaultValue,
  onChange,
  placeholder,
  size,
  className,
  children,
  id,
  name,
  form,
  required,
  disabled,
  autoComplete,
  title,
  ...aria
}: NativeSelectProps) {
  const nodes = readOptions(children)
  const options = flatten(nodes)
  const empty = options.find((option) => option.value === '')
  // A native select starts on its first enabled option.
  const [inner, setInner] = React.useState(() =>
    defaultValue == null
      ? (options.find((option) => !option.disabled)?.value ?? '')
      : String(defaultValue),
  )
  const current = value == null ? inner : String(value)
  const offersEmpty = empty !== undefined && !empty.disabled
  const items = [
    ...nodes.map((node) =>
      node.kind === 'group'
        ? {
            type: 'group' as const,
            label: node.label,
            items: node.options.map(toItem),
          }
        : toItem(node),
    ),
  ]
  const renderItem = (option: OptionNode) => (
    <SelectItem
      key={option.value}
      value={option.value === '' ? EMPTY : option.value}
      label={option.label}
      disabled={option.disabled}
    >
      {option.label}
    </SelectItem>
  )

  return (
    <Select
      items={items}
      value={current === '' ? null : current}
      name={name}
      form={form}
      required={required}
      disabled={disabled}
      autoComplete={autoComplete}
      placeholder={placeholder ?? empty?.label}
      onValueChange={(next) => {
        const picked = next === EMPTY ? '' : next
        if (value == null) setInner(picked)
        onChange?.({
          target: { value: picked, name: name ?? '' },
          currentTarget: { value: picked, name: name ?? '' },
        })
      }}
    >
      <SelectTrigger
        id={id}
        title={title}
        size={size}
        className={cn(
          offersEmpty && 'data-placeholder:text-inherit',
          className,
        )}
        {...aria}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        // Inside a <label>, a click on an item would otherwise re-press the trigger.
        onClick={(event) => event.preventDefault()}
      >
        {nodes.map((node, index) =>
          node.kind === 'group' ? (
            <SelectGroup key={`${node.label}-${index}`}>
              <SelectLabel>{node.label}</SelectLabel>
              {node.options.map(renderItem)}
            </SelectGroup>
          ) : (
            renderItem(node)
          ),
        )}
      </SelectContent>
    </Select>
  )
}
