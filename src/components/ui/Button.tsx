import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant
    // Swaps the label for a spinner + loadingLabel and disables the button,
    // so feedback happens inside the button instead of somewhere else on screen.
    loading?: boolean
    loadingLabel?: string
}

// 44px minimum height keeps it comfortable to tap. Corners are small and the
// shadow is a 1px edge, so it reads as nearly flat with just a hint of depth.
const base =
    'inline-flex items-center justify-center min-h-11 px-6 rounded-lg font-sans text-sm font-medium ' +
    'transition duration-150 active:scale-[0.985] disabled:cursor-default disabled:opacity-60 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const variants: Record<Variant, string> = {
    // Uses the dim accent plus a barely-there gradient overlay, so it follows the theme.
    primary:
        'bg-accent-dim text-text border border-black/30 ' +
        'bg-[image:linear-gradient(180deg,rgba(255,255,255,0.1),rgba(0,0,0,0.08))] ' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(0,0,0,0.4)] hover:brightness-110',
    ghost:
        'bg-white/[0.04] text-text-muted border border-white/10 hover:text-text hover:bg-white/[0.07] ' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
}

export default function Button({
    variant = 'primary',
    loading = false,
    loadingLabel,
    disabled,
    className = '',
    children,
    ...props
}: ButtonProps) {
    return (
        <button
            {...props}
            disabled={disabled || loading}
            className={`${base} ${variants[variant]} ${className}`}
        >
            {loading ? (
                <>
                    <span
                        aria-hidden
                        className="mr-2.5 h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
                    />
                    {loadingLabel ?? children}
                </>
            ) : (
                children
            )}
        </button>
    )
}