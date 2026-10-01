import { cookies } from 'next/headers'
import { timingSafeEqual } from 'node:crypto'

// Single source of truth for "is this request from the admin".
// Used by the admin layout AND every server action, because actions
// are callable directly and skip the layout entirely.
export async function isAdmin(): Promise<boolean> {
    const secret = process.env.ADMIN_SECRET

    // No secret configured means nobody gets in. Fail closed.
    if (!secret) return false

    const store = await cookies()
    const token = store.get('admin_token')?.value
    if (!token) return false

    // Constant-time compare so response timing can't leak the secret.
    // timingSafeEqual throws on length mismatch, so check length first.
    const a = Buffer.from(token)
    const b = Buffer.from(secret)
    return a.length === b.length && timingSafeEqual(a, b)
}