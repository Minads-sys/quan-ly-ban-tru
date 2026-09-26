import { getFinancePageData } from './actions'
import { FinanceClient } from './FinanceClient'
import { getVietnamNow, getVietnamDateString } from '@/utils/dateUtils'

export default async function FinancePage() {
    const now = getVietnamNow()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const startDate = getVietnamDateString(firstDay)
    const endDate = getVietnamDateString(now)

    const initialData = await getFinancePageData(startDate, endDate)

    return (
        <FinanceClient
            initialData={initialData}
            defaultStartDate={startDate}
            defaultEndDate={endDate}
        />
    )
}
