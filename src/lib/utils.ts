export function formatClassification(c: string) {
    return c.charAt(0).toUpperCase() + c.slice(1)
}

export function urgencyLabel(score: number): string {
    if (score >= 8) return 'Critical'
    if (score >= 5) return 'Moderate'
    return 'Low'
}

export function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
}