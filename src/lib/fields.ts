import type { FieldMap } from '@/types/tenant'

export interface FieldRow {
    key: string
    label: string
    value: string
}

function stringify(value: unknown): string {
    if (value == null) return ''
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    try {
        return JSON.stringify(value)
    } catch {
        return ''
    }
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1)
}

// Fallbacks for anything the tenant didn't label.
function prettifyKey(key: string): string {
    return capitalize(key.replace(/[_-]+/g, ' ').trim())
}

// Slug-looking values ("this-week") become "This week". Free text is left alone.
function prettifyValue(raw: string): string {
    return /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(raw)
        ? capitalize(raw.replace(/-/g, ' '))
        : raw
}

// Rows for the drawer's Submission section. Identity fields (name, email,
// message) are skipped because the drawer already shows them elsewhere.
// Order: the tenant's explicit `order`, then labeled keys, then anything else.
export function fieldRows(
    fieldMap: FieldMap | undefined,
    fields: Record<string, unknown>,
): FieldRow[] {
    const map = fieldMap ?? {}
    const labels = map.labels ?? {}

    const hidden = new Set([
        map.identity?.name ?? 'name',
        map.identity?.email ?? 'email',
        map.identity?.message ?? 'message',
    ])

    const keys = [
        ...(map.order ?? []),
        ...Object.keys(labels),
        ...Object.keys(fields),
    ]

    const seen = new Set<string>()
    const rows: FieldRow[] = []

    for (const key of keys) {
        if (seen.has(key) || hidden.has(key) || !(key in fields)) continue
        seen.add(key)

        const raw = stringify(fields[key])
        if (!raw) continue

        rows.push({
            key,
            label: labels[key] ?? prettifyKey(key),
            value: map.value_labels?.[key]?.[raw] ?? prettifyValue(raw),
        })
    }

    return rows
}