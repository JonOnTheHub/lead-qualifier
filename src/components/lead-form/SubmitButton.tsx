'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface SubmitButtonProps {
    loading: boolean
    success: boolean
    onClick?: () => void
}

export function SubmitButton({ loading, success, onClick }: SubmitButtonProps) {
    return (
        <motion.button
            type="submit"
            onClick={onClick}
            disabled={loading || success}
            whileTap={{ scale: 0.98, y: 1 }}
            className="relative overflow-hidden px-10 py-3.5 bg-accent text-[#0B1120] font-data text-[10px] tracking-[0.25em] uppercase disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {/* Hover fill — enters from left */}
            <motion.div
                className="absolute inset-0 bg-black/10"
                initial={{ x: '-100%' }}
                whileHover={{ x: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
            />

            <AnimatePresence mode="wait">
                {loading ? (
                    <motion.span
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="relative flex items-center gap-3"
                    >
                        <span className="w-3 h-3 rounded-full border border-[#0B1120]/30 border-t-[#0B1120] animate-spin inline-block" />
                        Processing
                    </motion.span>
                ) : (
                    <motion.span
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="relative"
                    >
                        Submit Intake
                    </motion.span>
                )}
            </AnimatePresence>
        </motion.button>
    )
}