import { getKitchenSummary } from './actions'
import { KitchenClient } from './KitchenClient'

export default async function KitchenPage() {
    const initialData = await getKitchenSummary(undefined, true)
    return <KitchenClient initialData={initialData} />
}
