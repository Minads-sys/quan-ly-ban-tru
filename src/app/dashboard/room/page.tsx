import { getRoomData } from './actions'
import { getBulkRoomData } from './bulk-actions'
import { RoomClient } from './RoomClient'

export default async function RoomPage() {
    // ⚡ Fetch cả room data và bulk data song song từ server
    const [initialData, bulkResult] = await Promise.all([
        getRoomData(),
        getBulkRoomData(),
    ])
    return <RoomClient initialData={initialData} initialBulkData={bulkResult} />
}
