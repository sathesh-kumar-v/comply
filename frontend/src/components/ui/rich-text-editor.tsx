"use client"

import { useEffect, useRef, type ElementType } from "react"
import { Bold, Italic, ListOrdered, List } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface RichTextEditorProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const COMMANDS: Array<{ icon: ElementType; command: string; label: string }> = [
  { icon: Bold, command: "bold", label: "Bold" },
  { icon: Italic, command: "italic", label: "Italic" },
  { icon: List, command: "insertUnorderedList", label: "Bulleted list" },
  { icon: ListOrdered, command: "insertOrderedList", label: "Numbered list" }
]

export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder = "Start typing...",
  disabled = false,
  className
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!editorRef.current) return
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ""
    }
  }, [value])

  const handleCommand = (command: string) => {
    if (disabled) return
    document.execCommand(command)
    editorRef.current?.focus()
  }

  const handleInput = () => {
    if (!editorRef.current) return
    onChange(editorRef.current.innerHTML)
  }

  return (
    <div className={cn("rounded-md border border-emerald-200", className)}>
      <div className="flex items-center gap-1 border-b border-emerald-100 bg-emerald-50/60 px-2 py-1.5">
        {COMMANDS.map(({ icon: Icon, command, label }) => (
          <Button
            key={command}
            type="button"
            size="icon"
            variant="ghost"
            disabled={disabled}
            className="h-8 w-8 text-emerald-700 hover:text-emerald-900"
            onClick={() => handleCommand(command)}
            aria-label={label}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
      <div
        id={id}
        ref={editorRef}
        role="textbox"
        contentEditable={!disabled}
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={handleInput}
        suppressContentEditableWarning
        className="min-h-[160px] w-full bg-white p-3 text-sm leading-relaxed text-gray-700 focus:outline-none"
      />
    </div>
  )
}

export default RichTextEditor
