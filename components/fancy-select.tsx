'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export type FancySelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type FancySelectProps = {
  value: string
  onChange: (value: string) => void
  options: FancySelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  menuClassName?: string
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export default function FancySelect({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  className,
  triggerClassName,
  menuClassName,
}: FancySelectProps) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  const enabledOptions = useMemo(
    () => options.filter((option) => !option.disabled),
    [options]
  )

  const selectedOption = options.find((option) => option.value === value) ?? null
  const initialHighlightedIndex = useMemo(() => {
    const selectedIndex = enabledOptions.findIndex((option) => option.value === value)
    return selectedIndex >= 0 ? selectedIndex : 0
  }, [enabledOptions, value])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!rootRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    function handleWindowBlur() {
      setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [])

  function commitSelection(option: FancySelectOption) {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
    setHighlightedIndex(-1)
  }

  function moveHighlight(direction: 1 | -1) {
    if (enabledOptions.length === 0) return

    setHighlightedIndex((current) => {
      const start = current >= 0 ? current : (direction === 1 ? -1 : 0)
      const next = (start + direction + enabledOptions.length) % enabledOptions.length
      return next
    })
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        setHighlightedIndex(initialHighlightedIndex)
        setOpen(true)
        return
      }
      moveHighlight(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setHighlightedIndex(initialHighlightedIndex)
        setOpen(true)
        return
      }
      moveHighlight(-1)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) {
        setHighlightedIndex(initialHighlightedIndex)
        setOpen(true)
        return
      }

      const option = enabledOptions[highlightedIndex]
      if (option) {
        commitSelection(option)
      }
      return
    }

    if (event.key === 'Escape') {
      setOpen(false)
      setHighlightedIndex(-1)
    }
  }

  return (
    <div ref={rootRef} className={joinClasses('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => {
          if (disabled) return
          const nextOpen = !open
          setHighlightedIndex(nextOpen ? initialHighlightedIndex : -1)
          setOpen(nextOpen)
        }}
        onKeyDown={handleKeyDown}
        className={joinClasses(
          'flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 text-left text-sm transition-all duration-200 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-primary/20',
          open && !disabled && 'border-primary shadow-[0_0_0_3px_rgba(220,38,38,0.08)]',
          disabled && 'cursor-not-allowed bg-muted-light text-muted opacity-70',
          !disabled && 'hover:border-border-dark',
          triggerClassName,
        )}
      >
        <span className={joinClasses('min-w-0 truncate', !selectedOption && 'text-muted')}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={joinClasses(
            'h-4 w-4 shrink-0 text-muted transition-transform duration-200 ease-out',
            open && 'rotate-180'
          )}
        />
      </button>

      <div
        className={joinClasses(
          'pointer-events-none absolute left-0 right-0 top-[calc(100%+0.55rem)] z-30 origin-top overflow-hidden rounded-2xl border border-border bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)] transition-all duration-200 ease-out',
          open ? 'translate-y-0 scale-y-100 opacity-100' : '-translate-y-2 scale-y-95 opacity-0',
          menuClassName
        )}
      >
        <div
          id={listboxId}
          role="listbox"
          className={joinClasses(
            'max-h-72 overflow-y-auto p-2',
            open ? 'pointer-events-auto' : 'pointer-events-none'
          )}
        >
          {options.map((option) => {
            const enabledIndex = enabledOptions.findIndex((enabledOption) => enabledOption.value === option.value)
            const highlighted = enabledIndex >= 0 && enabledIndex === highlightedIndex
            const selected = option.value === value

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                onMouseEnter={() => {
                  if (!option.disabled && enabledIndex >= 0) {
                    setHighlightedIndex(enabledIndex)
                  }
                }}
                onClick={() => commitSelection(option)}
                className={joinClasses(
                  'flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-150 ease-out',
                  option.disabled && 'cursor-not-allowed text-muted/50',
                  !option.disabled && !selected && 'text-foreground hover:bg-muted-light',
                  highlighted && !selected && 'bg-slate-100',
                  selected && 'bg-primary text-white shadow-sm'
                )}
                style={{
                  transform: open ? 'translateY(0)' : 'translateY(-6px)',
                  opacity: open ? 1 : 0,
                  transitionDelay: open ? `${Math.max(enabledIndex, 0) * 18}ms` : '0ms',
                }}
              >
                <span className="truncate">{option.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
