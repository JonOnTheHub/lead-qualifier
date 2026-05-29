'use client'

import { motion } from 'framer-motion'

interface SubmitButtonProps {
    loading: boolean
    success: boolean
}

export function SubmitButton({ loading, success }: SubmitButtonProps) {
    return (
        <motion.button
            type="submit"
            disabled={loading || success}
            whileHover={{ scale: loading || success ? 1 : 1.01 }}
            whileTap={{ scale: loading || success ? 1 : 0.98 }}
            className={`
        relative w-full h-14 border font-[family-name:var(--font-data)] 
        text-xs tracking-[0.3em] uppercase overflow-hidden
        transition-colors duration-500
        ${success
                    ? 'border-[#C8102E]/40 text-[#C8102E] bg-[#C8102E]/5 cursor-default'
                    : loading
                        ? 'border-[#222] text-[#333] cursor-not-allowed'
                        : 'border-[#C8102E] text-[#C8102E] hover:bg-[#C8102E] hover:text-[#F0EBE1] cursor-pointer'
                }
      `}
        >
            {/* Shimmer on loading */}
            {loading && (
                <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent 
            via-[#C8102E]/10 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                />
            )}

            <span className="relative z-10">
                {success ? 'Inquiry Received' : loading ? 'Qualifying...' : 'Submit Inquiry'}
            </span>
        </motion.button>
    )
}