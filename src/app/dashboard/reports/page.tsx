import { getReportsData } from './actions'
import { ReportsClient } from './ReportsClient'

export default async function ReportsPage() {
    // Note: Use period: 'this_month' so that it matches the default state initialization
    const initialData = await getReportsData({ period: 'this_month' })
    return <ReportsClient initialData={initialData} />
}
