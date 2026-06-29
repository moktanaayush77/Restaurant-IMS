import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, className, id, ...props },
  ref,
) {
  const tid = id || props.name
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={tid} className="mb-1.5 block text-[0.8rem] font-medium text-ink-700">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={tid}
        className={cn(
          'w-full rounded-lg border border-ink-200 bg-surface-raised px-3.5 py-2.5 text-ink-900 placeholder:text-ink-400',
          'transition-[border-color,box-shadow] focus:border-clay-500 focus:outline-none focus:ring-4 focus:ring-clay-500/15',
          className,
        )}
        {...props}
      />
    </div>
  )
})
