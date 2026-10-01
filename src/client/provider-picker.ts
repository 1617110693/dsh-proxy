import * as React from 'react'
import type { ProviderRow } from './model.ts'
const h = React.createElement

/** Editable provider suggestions, using the same floating menu as proxy modes. */
export function ProviderPicker({ value, options, disabled, label, placeholder, onChange }: {
  value: string; options: ProviderRow[]; disabled: boolean; label: string; placeholder: string; onChange(value: string): void
}) {
  const id = React.useId()
  const input = React.useRef<HTMLInputElement>(null)
  const list = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(-1)
  const [pos, setPos] = React.useState<React.CSSProperties>({})
  const query = value.trim().toLowerCase()
  const filtered = options.filter(row => row.id.toLowerCase().includes(query) || row.name.toLowerCase().includes(query))
  const visible = open && !disabled && filtered.length > 0
  const place = React.useCallback(() => {
    const r = input.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom - 12
    const above = r.top - 12
    const up = below < Math.min(filtered.length * 34 + 8, 220) && above > below
    const width = Math.min(Math.max(r.width, 200), 440, window.innerWidth - 16)
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width,
      maxHeight: Math.max(0, Math.min(280, (up ? above : below) - 4)),
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) })
  }, [filtered.length])
  React.useEffect(() => {
    if (!visible) return
    place()
    const pointer = (e: PointerEvent) => {
      if (!list.current?.contains(e.target as Node) && !input.current?.contains(e.target as Node)) setOpen(false)
    }
    const scroll = (e: Event) => { if (!list.current?.contains(e.target as Node)) place() }
    document.addEventListener('pointerdown', pointer, true)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('pointerdown', pointer, true)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', place)
    }
  }, [visible, place])
  React.useEffect(() => {
    if (visible && active >= 0) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [visible, active])
  const choose = (index: number) => {
    if (disabled || !filtered[index]) return
    onChange(filtered[index]!.id)
    setOpen(false)
    setActive(-1)
    input.current?.focus()
  }
  return h('div', { style: { flex: 1, minWidth: 0 } },
    h('input', {
      ref: input, className: 'dshp-select', value, disabled, placeholder, spellCheck: false, autoComplete: 'off',
      role: 'combobox', 'aria-label': label, 'aria-autocomplete': 'list', 'aria-expanded': visible,
      'aria-controls': visible ? `${id}-list` : undefined,
      'aria-activedescendant': visible && active >= 0 ? `${id}-${active}` : undefined,
      style: { cursor: 'text' },
      onFocus: () => { place(); setOpen(true) }, onClick: () => { place(); setOpen(true) },
      onBlur: () => { setOpen(false); setActive(-1) },
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => { onChange(e.target.value.trim()); setActive(-1); setOpen(true) },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Escape') { e.preventDefault(); setOpen(false); setActive(-1) }
        else if (e.key === 'Tab') setOpen(false)
        else if (['ArrowDown', 'ArrowUp'].includes(e.key) && filtered.length) {
          e.preventDefault(); place(); setOpen(true)
          setActive(i => i < 0 ? (e.key === 'ArrowDown' ? 0 : filtered.length - 1) : (i + (e.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length)
        } else if (e.key === 'Enter' && visible && active >= 0) { e.preventDefault(); choose(active) }
      },
    }),
    visible ? h('div', { ref: list, id: `${id}-list`, role: 'listbox', 'aria-label': label, className: 'dshp-menu', style: pos },
      ...filtered.map((row, i) => h('div', {
        key: row.id, id: `${id}-${i}`, role: 'option', 'aria-selected': row.id === value,
        'data-index': i, 'data-active': i === active, className: 'dshp-option',
        onPointerMove: () => setActive(i), onPointerDown: (e: React.PointerEvent) => e.preventDefault(), onClick: () => choose(i),
      }, h('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: row.id }, row.name === row.id ? row.id : `${row.name} · ${row.id}`),
      row.id === value ? h('span', { 'aria-hidden': true }, '✓') : null))) : null)
}
