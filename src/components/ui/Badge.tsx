import { LeadClassification, LeadSentiment, LeadStatus } from '@/types/lead'

type BadgeVariant = LeadClassification | LeadSentiment | LeadStatus

const styles: Record<string, string> = {
  // Classification
  hot:          'bg-[#3a0a10] text-[#ff6b6b] border-[#5a1520]',
  warm:         'bg-[#2d1a05] text-[#e8a265] border-[#4a2d0a]',
  cold:         'bg-[#0a1520] text-[#6baed6] border-[#152535]',
  unqualified:  'bg-[#1a1a1a] text-[#666666] border-[#2a2a2a]',
  // Sentiment
  positive:     'bg-[#0a1f0a] text-[#6bc98a] border-[#153520]',
  neutral:      'bg-[#1a1a1a] text-[#888888] border-[#2a2a2a]',
  negative:     'bg-[#3a0a10] text-[#ff6b6b] border-[#5a1520]',
  urgent:       'bg-[#2d0a2d] text-[#c084fc] border-[#4a1560]',
  // Review status
  pending_review: 'bg-[#2d1a05] text-[#e8a265] border-[#4a2d0a]',
  sending:        'bg-[#0a1520] text-[#6baed6] border-[#152535]',
  sent:           'bg-[#0a1f0a] text-[#6bc98a] border-[#153520]',
  rejected:       'bg-[#1a1a1a] text-[#666666] border-[#2a2a2a]',
  send_failed:    'bg-[#3a0a10] text-[#ff6b6b] border-[#5a1520]',
  // Intake queue status
  queued:         'bg-[#1a1a1a] text-[#888888] border-[#2a2a2a]',
  processing:     'bg-[#0a1520] text-[#6baed6] border-[#152535]',
  failed:         'bg-[#3a0a10] text-[#ff6b6b] border-[#5a1520]',
}

// Null renders nothing: AI-derived badges are empty until a lead is analyzed.
export default function Badge({ value }: { value: BadgeVariant | null }) {
  if (!value) return null

  return (
    <span className={`inline-block font-data text-[8px] tracking-[0.2em] uppercase px-2.5 py-1 border ${styles[value] ?? styles.unqualified}`}>
      {/* pending_review reads better as "pending review" */}
      {value.replace('_', ' ')}
    </span>
  )
}