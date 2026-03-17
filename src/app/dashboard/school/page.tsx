'use client'

export default function SchoolPage() {
    return (
        <div className="flex flex-col items-center justify-center py-20">
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-10 max-w-lg text-center shadow-md">
                <p className="text-5xl mb-4">🚧</p>
                <h2 className="text-2xl font-bold text-amber-800 mb-3">
                    Tạm tắt duyệt cấp Trường
                </h2>
                <p className="text-amber-700 text-lg leading-relaxed">
                    Chức năng duyệt cấp trường hiện đang được tạm tắt.
                    Báo cáo sẽ được duyệt trực tiếp ở <span className="font-bold">cấp phòng (Nhóm/Phòng)</span>.
                </p>
                <p className="text-amber-600 text-sm mt-4">
                    Khi phòng duyệt xong, số liệu sẽ tự động chuyển sang Bếp / Kế toán.
                </p>
            </div>
        </div>
    )
}
