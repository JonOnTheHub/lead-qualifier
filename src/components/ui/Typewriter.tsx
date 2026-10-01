'use client'

import { useState, useEffect, useRef } from 'react'

interface TypewriterProps {
    lines: string[]
    speed?: number
    onComplete?: () => void
    className?: string
}

export function Typewriter({ lines, speed = 28, onComplete, className }: TypewriterProps) {
    const fullText = lines.join('\n')
    const [displayed, setDisplayed] = useState('')

    // Derived, not stored. "Done" is always just "displayed caught up to
    // fullText", so keeping it in its own state meant syncing it with an
    // effect, which is exactly what the lint rule flags.
    const done = displayed.length >= fullText.length

    // Keep the latest onComplete in a ref so the typing effect doesn't
    // re-run (and re-fire the callback) when the parent passes a new
    // function identity on re-render.
    const onCompleteRef = useRef(onComplete)
    useEffect(() => {
        onCompleteRef.current = onComplete
    }, [onComplete])

    useEffect(() => {
        if (done) {
            // Calling an external callback is a legit effect job.
            // Only the direct setState was the problem.
            onCompleteRef.current?.()
            return
        }

        const timeout = setTimeout(() => {
            setDisplayed(fullText.slice(0, displayed.length + 1))
        }, speed)

        return () => clearTimeout(timeout)
    }, [done, displayed, fullText, speed])

    // Split back into lines for rendering with <br />
    const parts = displayed.split('\n')

    return (
        <span className={className}>
            {parts.map((part, i) => (
                <span key={i}>
                    {part}
                    {i < parts.length - 1 && <br />}
                </span>
            ))}
            {/* Cursor — solid while typing, blinks when done */}
            <span
                className={`inline-block w-0.75 h-[0.85em] ml-1 mb-[-0.05em]
  bg-accent align-middle
  ${done ? 'animate-[blink_1s_step-end_infinite]' : 'opacity-100'}`}
            />
        </span>
    )
}