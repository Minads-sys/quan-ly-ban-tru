'use client'

import React, { useState, useEffect, useCallback, memo } from 'react'
import { getSettings, updateSettings } from './actions'

interface TimeSettingsTabProps {
    onMessage: (type: 'success' | 'error', text: string) => void
}

export const TimeSettingsTab = memo(function TimeSettingsTab({ onMessage }: TimeSettingsTabProps) {
    const [loading, setLoading] = useState(true)
    const [savingTime, setSavingTime] = useState(false)
    const [savingSchool, setSavingSchool] = useState(false)

    // Data
    const [moc1Open, setMoc1Open] = useState('07:00')
    const [moc1Close, setMoc1Close] = useState('16:00')
    const [moc2Open, setMoc2Open] = useState('23:59')
    const [moc2Close, setMoc2Close] = useState('07:00')
    const [noTimeLimit, setNoTimeLimit] = useState(false)
    const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5])
    const [offDays, setOffDays] = useState<string[]>([])
    const [schoolName, setSchoolName] = useState('')
    const [schoolAddress, setSchoolAddress] = useState('')
    const [schoolRepresentative, setSchoolRepresentative] = useState('LÊ THỊ HÀ GIANG')
    const [principalName, setPrincipalName] = useState('TRẦN KHẮC HUY')
    const [mealPrice, setMealPrice] = useState(25000)
    const [teacherMealPrice, setTeacherMealPrice] = useState(30000)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const settingsData = await getSettings()
            const allSettings = settingsData.settings as { key: string; value: string }[]
            const get = (k: string) => allSettings?.find(s => s.key === k)?.value
            if (get('moc1_open')) setMoc1Open(get('moc1_open')!)
            if (get('moc1_close')) setMoc1Close(get('moc1_close')!)
            if (get('moc2_open')) setMoc2Open(get('moc2_open')!)
            if (get('moc2_close')) setMoc2Close(get('moc2_close')!)
            setNoTimeLimit(get('deadline_no_limit') === 'true')
            
            if (get('working_days')) {
                try { setWorkingDays(JSON.parse(get('working_days')!)) } catch (e) {
                    console.error('[TimeSettingsTab working_days parse] error:', e)
                }
            }
            if (get('off_days')) {
                try { setOffDays(JSON.parse(get('off_days')!)) } catch (e) {
                    console.error('[TimeSettingsTab off_days parse] error:', e)
                }
            }

            setSchoolName(get('school_name') || '')
            setSchoolAddress(get('school_address') || '')
            setSchoolRepresentative(get('school_representative') || 'LÊ THỊ HÀ GIANG')
            setPrincipalName(get('principal_name') || 'TRẦN KHẮC HUY')
            setMealPrice(parseInt(get('meal_price') || '25000') || 25000)
            setTeacherMealPrice(parseInt(get('teacher_meal_price') || '30000') || 30000)
        } catch (e) {
            console.error('[TimeSettingsTab loadData] error:', e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    async function handleSaveTime() {
        setSavingTime(true)
        const result = await updateSettings({
            moc1_open: moc1Open,
            moc1_close: moc1Close,
            moc2_open: moc2Open,
            moc2_close: moc2Close,
            deadline_no_limit: noTimeLimit ? 'true' : 'false',
            working_days: JSON.stringify(workingDays),
            off_days: JSON.stringify(offDays),
        })
        setSavingTime(false)
        if (result.error) onMessage('error', result.error)
        else {
            onMessage('success', 'Đã lưu cài đặt thời gian!')
            await loadData()
        }
    }

    async function handleSaveSchoolInfo() {
        setSavingSchool(true)
        const result = await updateSettings({
            school_name: schoolName.trim(),
            school_address: schoolAddress.trim(),
            school_representative: schoolRepresentative.trim(),
            principal_name: principalName.trim() || 'TRẦN KHẮC HUY',
            meal_price: mealPrice.toString(),
            teacher_meal_price: teacherMealPrice.toString(),
        })
        setSavingSchool(false)
        if (result.error) onMessage('error', result.error)
        else {
            onMessage('success', 'Đã lưu thông tin cấu hình!')
            await loadData()
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-700 mb-2">⏰ Thời gian chốt suất</h3>
                    <p className="text-sm text-gray-500 mb-5">
                        Cấu hình 4 mốc thời gian: Mốc 1 (báo suất cho ngày mai) và Mốc 2 (bổ sung sáng ngày ăn).
                    </p>
                    <label className="flex items-center gap-3 mb-5 cursor-pointer select-none">
                        <div className="relative">
                            <input type="checkbox" checked={noTimeLimit}
                                onChange={e => setNoTimeLimit(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 transition-colors" />
                            <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Không giới hạn thời gian</span>
                    </label>
                    {noTimeLimit && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
                            <p className="text-sm text-emerald-700">✅ Giáo viên có thể báo suất bất cứ lúc nào</p>
                        </div>
                    )}
                    {!noTimeLimit && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <h4 className="font-semibold text-blue-800 text-sm mb-3">🛒 Mốc 1 — Báo suất cho ngày mai</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-blue-700 mb-1">Mở form</label>
                                        <input type="time" value={moc1Open} onChange={e => setMoc1Open(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-xl border border-blue-200 text-base font-semibold focus:border-blue-500 outline-none bg-white text-black" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-blue-700 mb-1">Chốt (khóa)</label>
                                        <input type="time" value={moc1Close} onChange={e => setMoc1Close(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-xl border border-blue-200 text-base font-semibold focus:border-blue-500 outline-none bg-white text-black" />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                <h4 className="font-semibold text-amber-800 text-sm mb-3">☀️ Mốc 2 — Bổ sung sáng ngày ăn</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-amber-700 mb-1">Mở form</label>
                                        <input type="time" value={moc2Open} onChange={e => setMoc2Open(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-xl border border-amber-200 text-base font-semibold focus:border-amber-500 outline-none bg-white text-black" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-amber-700 mb-1">Chốt (khóa)</label>
                                        <input type="time" value={moc2Close} onChange={e => setMoc2Close(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-xl border border-amber-200 text-base font-semibold focus:border-amber-500 outline-none bg-white text-black" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* 📅 Lịch học & Báo suất */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-700 mb-2">📅 Lịch học & Báo suất</h3>
                    <p className="text-sm text-gray-500 mb-4">
                        Chọn các ngày học trong tuần và cấu hình các ngày nghỉ lễ/đặc biệt. Hệ thống sẽ bỏ qua các ngày không học và nghỉ lễ.
                    </p>
                    
                    <div className="mb-5">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Ngày học trong tuần</label>
                        <div className="flex flex-wrap gap-2">
                            {[{d: 1, l: 'T2'}, {d: 2, l: 'T3'}, {d: 3, l: 'T4'}, {d: 4, l: 'T5'}, {d: 5, l: 'T6'}, {d: 6, l: 'T7'}, {d: 0, l: 'CN'}].map(day => (
                                <label key={day.d} className={`px-4 py-2 border rounded-lg cursor-pointer transition-colors text-sm font-medium ${workingDays.includes(day.d) ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                    <input type="checkbox" className="hidden" 
                                        checked={workingDays.includes(day.d)}
                                        onChange={(e) => {
                                            if (e.target.checked) setWorkingDays([...workingDays, day.d].sort((a,b)=>a-b))
                                            else setWorkingDays(workingDays.filter(d => d !== day.d))
                                        }}
                                    />
                                    {day.l}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Ngày nghỉ lễ / đặc biệt</label>
                        <div className="flex gap-2 mb-3">
                            <input type="date" className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500" 
                                id="addOffDayInput"
                            />
                            <button type="button" 
                                onClick={() => {
                                    const el = document.getElementById('addOffDayInput') as HTMLInputElement
                                    if (el && el.value && !offDays.includes(el.value)) {
                                        setOffDays([...offDays, el.value].sort())
                                        el.value = ''
                                    }
                                }}
                                className="px-4 py-2 bg-blue-100 text-blue-700 font-medium rounded-lg text-sm hover:bg-blue-200 transition-colors"
                            >+ Thêm</button>
                        </div>
                        {offDays.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {offDays.map(od => {
                                    const [y, m, d] = od.split('-')
                                    return (
                                    <span key={od} className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-semibold">
                                        {`${d}/${m}/${y}`}
                                        <button onClick={() => setOffDays(offDays.filter(x => x !== od))} className="hover:text-red-900 text-base leading-none">&times;</button>
                                    </span>
                                )})}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 italic">Chưa có ngày nghỉ nào</p>
                        )}
                    </div>
                </div>
            </div>

            <button onClick={handleSaveTime}
                disabled={savingTime}
                className="px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 shadow-md transition-all w-fit disabled:opacity-50 flex items-center gap-2 cursor-pointer">
                {savingTime ? (
                    <>
                        <span className="inline-block animate-spin">⏳</span> Đang lưu thời gian...
                    </>
                ) : (
                    <>
                        <span>💾</span> Lưu cài đặt thời gian
                    </>
                )}
            </button>

            {/* Thông tin trường */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
                <h3 className="font-semibold text-gray-700 mb-2">🏫 Thông tin trường</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Thông tin này sẽ hiển thị trên giao diện và phần in báo cáo.
                </p>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tên trường</label>
                        <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)}
                            placeholder="VD: Trường Tiểu học ABC"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Địa chỉ</label>
                        <input type="text" value={schoolAddress} onChange={e => setSchoolAddress(e.target.value)}
                            placeholder="VD: 123 Đường ABC, Quận XYZ, TP.HCM"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Đại diện nhà trường (Ký biên bản đối chiếu)</label>
                        <input type="text" value={schoolRepresentative} onChange={e => setSchoolRepresentative(e.target.value)}
                            placeholder="VD: LÊ THỊ HÀ GIANG"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Hiệu trưởng ký duyệt (Giấy đề nghị thanh toán)</label>
                        <input type="text" value={principalName} onChange={e => setPrincipalName(e.target.value)}
                            placeholder="VD: TRẦN KHẮC HUY"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 focus:border-blue-500 outline-none uppercase" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Đơn giá suất ăn HS (VNĐ)</label>
                        <input type="number" value={mealPrice} onChange={e => setMealPrice(parseInt(e.target.value) || 0)}
                            placeholder="25000"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-blue-700 focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Đơn giá suất ăn GV (VNĐ)</label>
                        <input type="number" value={teacherMealPrice} onChange={e => setTeacherMealPrice(parseInt(e.target.value) || 0)}
                            placeholder="30000"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-rose-700 focus:border-blue-500 outline-none" />
                    </div>
                </div>
                <button onClick={handleSaveSchoolInfo}
                    disabled={savingSchool}
                    className="mt-4 px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer">
                    {savingSchool ? (
                        <>
                            <span className="inline-block animate-spin">⏳</span> Đang lưu cấu hình...
                        </>
                    ) : (
                        <>
                            <span>💾</span> Lưu cấu hình
                        </>
                    )}
                </button>
            </div>
        </div>
    )
})
