"use client"

import { useMemo, type ReactNode } from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type MultiSelectOption = {
  value: string
  label: string
}

interface MultiSelectProps {
  id?: string
  options: MultiSelectOption[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  emptyHint?: string
  renderValue?: (values: string[]) => ReactNode
}

export function MultiSelect({
  id,
  options,
  selected,
  onChange,
  placeholder = "Select...",
  className,
  disabled = false,
  emptyHint,
  renderValue
}: MultiSelectProps) {
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const toggleValue = (value: string, checked: boolean) => {
    if (checked) {
      if (selectedSet.has(value)) return
      onChange([...selected, value])
    } else {
      onChange(selected.filter((item) => item !== value))
    }
  }

  const hasSelection = selected.length > 0

  return (
    <div className={cn("space-y-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            id={id}
            variant="outline"
            disabled={disabled}
            className="w-full justify-between gap-2 border-emerald-200"
          >
            <div className="flex items-center gap-2">
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {hasSelection ? `${selected.length} selected` : placeholder}
              </span>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64">
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selectedSet.has(option.value)}
              onCheckedChange={(checked) => toggleValue(option.value, Boolean(checked))}
            >
              <span className="flex items-center gap-2">
                <Check
                  className={cn(
                    "h-4 w-4",
                    selectedSet.has(option.value) ? "text-primary" : "text-muted-foreground"
                  )}
                />
                {option.label}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
          {options.length === 0 && emptyHint && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">{emptyHint}</div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex flex-wrap gap-2">
        {hasSelection ? (
          renderValue ? (
            renderValue(selected)
          ) : (
            selected.map((value) => {
              const option = options.find((item) => item.value === value)
              return (
                <Badge
                  key={value}
                  variant="secondary"
                  className="gap-1 bg-emerald-50 text-emerald-700"
                >
                  {option?.label ?? value}
                  <button
                    type="button"
                    className="ml-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => toggleValue(value, false)}
                    aria-label={`Remove ${option?.label ?? value}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )
            })
          )
        ) : (
          <span className="text-xs text-muted-foreground">No selections yet.</span>
        )}
      </div>
    </div>
  )
}

export type { MultiSelectOption }
