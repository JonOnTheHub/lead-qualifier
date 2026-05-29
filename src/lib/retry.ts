// Wraps any async function with exponential backoff retry.
// If the AI call or Supabase write fails transiently,
// we retry up to maxAttempts before giving up.
// Delay doubles each attempt: 500ms → 1000ms → 2000ms

interface RetryOptions {
    maxAttempts?: number
    baseDelayMs?: number
    onRetry?: (attempt: number, error: unknown) => void
}

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const { maxAttempts = 3, baseDelayMs = 500, onRetry } = options

    let lastError: unknown

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn()
        } catch (err) {
            lastError = err

            if (attempt === maxAttempts) break

            const delay = baseDelayMs * Math.pow(2, attempt - 1)
            onRetry?.(attempt, err)

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay))
        }
    }

    throw lastError
}