'use client'

import { useState, useEffect } from 'react'

interface TypewriterProps {
    lines: string[]
    speed?: number
    onComplete?: () => void
    className?: string
}

export function Typewriter({ lines, speed = 28, onComplete, className }: TypewriterProps) {
    const fullText = lines.join('\n')
    const [displayed, setDisplayed] = useState('')
    const [done, setDone] = useState(false)

    useEffect(() => {
        if (displayed.length >= fullText.length) {
            setDone(true)
            onComplete?.()
            return
        }

        const timeout = setTimeout(() => {
            setDisplayed(fullText.slice(0, displayed.length + 1))
        }, speed)

        return () => clearTimeout(timeout)
    }, [displayed, fullText, speed, onComplete])

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