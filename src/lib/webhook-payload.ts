import { createHash } from 'node:crypto'
import type { Payload } from '@/lib/pipeline'

const MAX_KEYS = 100

function isPlainObject(value: unknown): value is Payload {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Form tools send either JSON or classic form-encoded fields. Returns null
// when the body is neither, so the route can answer with a clear 400.
export function parseBody(raw: string, contentType: string): Payload | null {
    try {
        if (contentType.toLowerCase().includes('application/x-www-form-urlencoded')) {
            const out: Payload = {}
            for (const [key, value] of new URLSearchParams(raw)) {
                // A repeated field (checkboxes) becomes one comma-separated value.
                out[key] = key in out ? `${out[key]}, ${value}` : value
            }
            return out
        }
        const parsed: unknown = JSON.parse(raw)
        return isPlainObject(parsed) ? parsed : null
    } catch {
        return null
    }
}

// Many platforms nest their answers ({ data: { email } }). Flattening to
// dotted keys ("data.email") means a tenant can point field_map at any of
// them with a plain string. Arrays become comma-separated text. Depth and
// key count are capped so a hostile payload can't balloon the lead row.
export function flatten(input: Payload, prefix = '', depth = 0, out: Payload = {}): Payload {
    for (const [k, v] of Object.entries(input)) {
        if (Object.keys(out).length >= MAX_KEYS) break
        const key = prefix ? `${prefix}.${k}` : k

        if (Array.isArray(v)) {
            out[key] = v
                .map(x => (typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x)))
                .join(', ')
        } else if (isPlainObject(v) && depth < 3) {
            flatten(v, key, depth + 1, out)
        } else if (isPlainObject(v)) {
            out[key] = JSON.stringify(v)
        } else {
            out[key] = v
        }
    }
    return out
}

// Form platforms resend a submission when they time out, so the same
// submission can arrive twice. The database has a unique index on
// (tenant, dedupe_key), which makes catching that atomic.
//   - If the sender provides an Idempotency-Key header, that wins.
//   - Otherwise it is a hash of the exact body plus today's date (UTC), so a
//     resend within the day collapses, and an identical message sent weeks
//     later still counts as a new lead.
export function makeDedupeKey(raw: string, idempotencyKey: string | null): string {
    if (idempotencyKey && idempotencyKey.trim()) {
        return `k:${idempotencyKey.trim().slice(0, 120)}`
    }
    const day = new Date().toISOString().slice(0, 10)
    const hash = createHash('sha256').update(raw).digest('hex').slice(0, 32)
    return `h:${hash}:${day}`
}