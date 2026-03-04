'use client'

import { useEffect, useState } from 'react'

export interface ToastMessage {
    id: string
    message: string
    type: 'success' | 'info' | 'warning' | 'error'
}

interface ToastProps {
    toasts: ToastMessage[]
    onRemove: (id: string) => void
}

const icons: Record<string, string> = {
    success: '✅',
    info: '📋',
    warning: '⚠️',
    error: '❌',
}

const bgColors: Record<string, string> = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-800',
}

export function ToastContainer({ toasts, onRemove }: ToastProps) {
    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    )
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // Animate in
        requestAnimationFrame(() => setIsVisible(true))

        // Auto remove after 5s
        const timer = setTimeout(() => {
            setIsVisible(false)
            setTimeout(() => onRemove(toast.id), 300)
        }, 5000)

        return () => clearTimeout(timer)
    }, [toast.id, onRemove])

    return (
        <div
            className={`
        flex items-start gap-3 p-4 rounded-xl border shadow-lg
        transition-all duration-300 ease-out
        ${bgColors[toast.type]}
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
        >
            <span className="text-lg flex-shrink-0">{icons[toast.type]}</span>
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
                onClick={() => {
                    setIsVisible(false)
                    setTimeout(() => onRemove(toast.id), 300)
                }}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
                ✕
            </button>
        </div>
    )
}
