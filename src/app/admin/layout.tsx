import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin-auth'

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    if (!(await isAdmin())) {
        redirect('/')
    }

    return <>{children}</>
}