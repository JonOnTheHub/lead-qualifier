import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const headersList = await headers()

    // Read the cookie manually from the cookie header
    const cookieHeader = headersList.get('cookie') ?? ''
    const adminToken = cookieHeader
        .split(';')
        .map(c => c.trim())
        .find(c => c.startsWith('admin_token='))
        ?.split('=')[1]

    if (adminToken !== process.env.ADMIN_SECRET) {
        redirect('/')
    }

    return <>{children}</>
}