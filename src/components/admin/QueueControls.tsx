'use client'

import { useState, useTransition } from 'react'
import Button from '@/components/ui/Button'
import { processQueue } from '@/app/admin/actions'

interface QueueControlsProps {
    waiting: number
    analyzing: number
    failed: number
}

// A small bar that appears only when something is in the queue. The queue
// normally drains itself as leads arrive, so this is the manual lever for
// after a burst, a deploy, or a worker that died.
export default function QueueControls({ waiting, analyzing, failed }: QueueControlsProps) {
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    if (waiting + analyzing + failed === 0) return null

    return (
        <div className="mx-8 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.012))] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div>
                <p className="font-data text-[9px] tracking-[0.2em] text-ghost uppercase mb-1.5">
                    Analysis queue
                </p>
                <p className="font-sans text-sm text-ink">
                    {waiting} waiting · {analyzing} analyzing · {failed} failed
                </p>
                {error && (
                    <p className="font-data text-[10px] tracking-wider text-[#ff6b6b] mt-2">{error}</p>
                )}
            </div>
            {(waiting > 0 || analyzing > 0) && (
                <Button
                    variant="ghost"
                    loading={pending}
                    loadingLabel="Processing…"
                    onClick={() => {
                        setError(null)
                        startTransition(async () => {
                            const res = await processQueue()
                            if (!res.ok) setError(res.error)
                        })
                    }}
                >
                    Process queue
                </Button>
            )}
        </div>
    )
}