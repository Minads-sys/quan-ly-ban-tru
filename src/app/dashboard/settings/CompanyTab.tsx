'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { getSettings, updateSettings } from './actions'

interface CompanyTabProps {
    onMessage: (type: 'success' | 'error', text: string) => void
}

export const CompanyTab = React.memo(function CompanyTab({ onMessage }: CompanyTabProps) {
    const [loading, setLoading] = useState(true)
    const [savingCompany, setSavingCompany] = useState(false)

    // Form states
    const [companyName, setCompanyName] = useState('CÔNG TY TNHH CHÂU PHƯƠNG THẢO')
    const [companyAddress, setCompanyAddress] = useState('20A Ngô Đức Kế, Phường Bình Thạnh, TP Hồ Chí Minh')
    const [companyTaxCode, setCompanyTaxCode] = useState('0317986511')
    const [companyRepresentative, setCompanyRepresentative] = useState('Bà NGUYỄN THỊ THU TRANG')
    const [companyPosition, setCompanyPosition] = useState('Chủ tịch hội đồng thành viên')
    const [companyCity, setCompanyCity] = useState('Tp.HCM')
    const [bankAccountHolder, setBankAccountHolder] = useState('CÔNG TY TNHH CHÂU PHƯƠNG THẢO')
    const [bankAccountNumber, setBankAccountNumber] = useState('667879888')
    const [bankName, setBankName] = useState('Ngân hàng Á Châu - ACB')
    const [principalName, setPrincipalName] = useState('TRẦN KHẮC HUY')
    const [allowedPrintRoles, setAllowedPrintRoles] = useState<string[]>([])

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const settingsData = await getSettings()
            const allSettings = settingsData.settings as { key: string; value: string }[]
            const get = (k: string) => allSettings?.find(s => s.key === k)?.value
            if (get('company_name')) setCompanyName(get('company_name')!)
            if (get('company_address')) setCompanyAddress(get('company_address')!)
            if (get('company_tax_code')) setCompanyTaxCode(get('company_tax_code')!)
            if (get('company_representative')) setCompanyRepresentative(get('company_representative')!)
            if (get('company_position')) setCompanyPosition(get('company_position')!)
            if (get('company_city')) setCompanyCity(get('company_city')!)
            if (get('company_bank_account_holder')) setBankAccountHolder(get('company_bank_account_holder')!)
            if (get('company_bank_account_number')) setBankAccountNumber(get('company_bank_account_number')!)
            if (get('company_bank_name')) setBankName(get('company_bank_name')!)
            if (get('principal_name')) setPrincipalName(get('principal_name')!)
            if (get('payment_request_allowed_roles')) {
                try { setAllowedPrintRoles(JSON.parse(get('payment_request_allowed_roles')!)) } catch (e) {
                    console.error('Lỗi parse payment_request_allowed_roles:', e)
                }
            }
        } catch (e) {
            console.error('Lỗi khi tải thông tin doanh nghiệp:', e)
            onMessage('error', 'Lỗi khi tải dữ liệu cài đặt doanh nghiệp')
        } finally {
            setLoading(false)
        }
    }, [onMessage])

    useEffect(() => {
        loadData()
    }, [loadData])

    async function handleSaveCompanyInfo() {
        setSavingCompany(true)
        try {
            const result = await updateSettings({
                company_name: companyName.trim(),
                company_address: companyAddress.trim(),
                company_tax_code: companyTaxCode.trim(),
                company_representative: companyRepresentative.trim(),
                company_position: companyPosition.trim(),
                company_city: companyCity.trim(),
                company_bank_account_holder: bankAccountHolder.trim(),
                company_bank_account_number: bankAccountNumber.trim(),
                company_bank_name: bankName.trim(),
                principal_name: principalName.trim() || 'TRẦN KHẮC HUY',
                payment_request_allowed_roles: JSON.stringify(allowedPrintRoles),
            })
            if (result.error) {
                onMessage('error', result.error)
            } else {
                onMessage('success', 'Đã lưu thông tin doanh nghiệp & phân quyền in ấn thành công!')
                await loadData()
            }
        } catch (e) {
            console.error('Lỗi khi lưu cài đặt doanh nghiệp:', e)
            onMessage('error', 'Lỗi không xác định khi lưu thông tin doanh nghiệp')
        } finally {
            setSavingCompany(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-7 h-7 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cột 1: Thông tin Doanh nghiệp */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                    <div>
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            <span>🏢</span> Thông tin Doanh nghiệp cung cấp suất ăn
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Thông tin này sẽ hiển thị trên Giấy đề nghị thanh toán khổ A4 và các văn bản báo cáo.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Tên công ty / Đơn vị</label>
                            <input
                                type="text"
                                value={companyName}
                                onChange={e => setCompanyName(e.target.value)}
                                placeholder="CÔNG TY TNHH CHÂU PHƯƠNG THẢO"
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-purple-500 outline-none font-semibold text-gray-800"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Địa chỉ trụ sở</label>
                            <input
                                type="text"
                                value={companyAddress}
                                onChange={e => setCompanyAddress(e.target.value)}
                                placeholder="20A Ngô Đức Kế, Phường Bình Thạnh, TP Hồ Chí Minh"
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-purple-500 outline-none text-gray-800"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Mã số thuế</label>
                                <input
                                    type="text"
                                    value={companyTaxCode}
                                    onChange={e => setCompanyTaxCode(e.target.value)}
                                    placeholder="0317986511"
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-purple-700 focus:border-purple-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Địa danh lập giấy</label>
                                <input
                                    type="text"
                                    value={companyCity}
                                    onChange={e => setCompanyCity(e.target.value)}
                                    placeholder="Tp.HCM"
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-purple-500 outline-none text-gray-800"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Đại diện ký tên</label>
                                <input
                                    type="text"
                                    value={companyRepresentative}
                                    onChange={e => setCompanyRepresentative(e.target.value)}
                                    placeholder="Bà NGUYỄN THỊ THU TRANG"
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:border-purple-500 outline-none text-gray-800"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Chức vụ đại diện</label>
                                <input
                                    type="text"
                                    value={companyPosition}
                                    onChange={e => setCompanyPosition(e.target.value)}
                                    placeholder="Chủ tịch hội đồng thành viên"
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-purple-500 outline-none text-gray-800"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Hiệu trưởng duyệt ký (Bên Nhà trường trên Giấy đề nghị TT)</label>
                            <input
                                type="text"
                                value={principalName}
                                onChange={e => setPrincipalName(e.target.value)}
                                placeholder="VD: TRẦN KHẮC HUY"
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:border-purple-500 outline-none text-gray-800 uppercase"
                            />
                        </div>
                    </div>
                </div>

                {/* Cột 2: Tài khoản & Phân quyền in ấn */}
                <div className="space-y-6">
                    {/* Tài khoản nhận tiền */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                        <div>
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <span>🏦</span> Tài khoản nhận tiền thanh toán
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                                Thông tin tài khoản để nhà trường thực hiện chuyển khoản thanh toán tiền suất ăn.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Tên chủ tài khoản (Người nhận)</label>
                                <input
                                    type="text"
                                    value={bankAccountHolder}
                                    onChange={e => setBankAccountHolder(e.target.value)}
                                    placeholder="CÔNG TY TNHH CHÂU PHƯƠNG THẢO"
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:border-purple-500 outline-none text-gray-800 uppercase"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Số tài khoản</label>
                                    <input
                                        type="text"
                                        value={bankAccountNumber}
                                        onChange={e => setBankAccountNumber(e.target.value)}
                                        placeholder="667879888"
                                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-teal-700 focus:border-purple-500 outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Ngân hàng</label>
                                    <input
                                        type="text"
                                        value={bankName}
                                        onChange={e => setBankName(e.target.value)}
                                        placeholder="Ngân hàng Á Châu - ACB"
                                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:border-purple-500 outline-none text-gray-800"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Phân quyền in ấn */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                        <div>
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <span>🔒</span> Phân quyền in Giấy đề nghị thanh toán (A4)
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                                Chỉ Admin và các vai trò/người dùng được chọn dưới đây mới có quyền in và xuất file PDF.
                            </p>
                        </div>

                        <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs text-purple-800 font-medium">
                            🛡️ <strong>Quản trị viên (Admin)</strong> mặc định luôn có quyền tạo, in và xuất PDF văn bản này.
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-2">
                                Cấp thêm quyền in cho các vai trò khác:
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { role: 'kitchen', label: 'Bếp / Kế toán' },
                                    { role: 'school_approver', label: 'GV cấp trường' },
                                    { role: 'reporter', label: 'Báo suất' },
                                    { role: 'group_manager', label: 'Quản lý nhóm' },
                                ].map(item => (
                                    <label
                                        key={item.role}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                                            allowedPrintRoles.includes(item.role)
                                                ? 'bg-purple-50 border-purple-300 text-purple-800'
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={allowedPrintRoles.includes(item.role)}
                                            onChange={e => {
                                                if (e.target.checked) {
                                                    setAllowedPrintRoles([...allowedPrintRoles, item.role])
                                                } else {
                                                    setAllowedPrintRoles(allowedPrintRoles.filter(r => r !== item.role))
                                                }
                                            }}
                                            className="rounded text-purple-600 focus:ring-purple-500"
                                        />
                                        <span>{item.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <button
                    onClick={handleSaveCompanyInfo}
                    disabled={savingCompany}
                    className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                    {savingCompany ? (
                        <>
                            <span className="inline-block animate-spin">⏳</span> Đang lưu cài đặt...
                        </>
                    ) : (
                        <>
                            <span>💾</span> Lưu thông tin Doanh nghiệp & Cài đặt in ấn
                        </>
                    )}
                </button>
            </div>
        </div>
    )
})
