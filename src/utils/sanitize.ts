/**
 * Utility functions for text sanitization and normalization.
 */

export function sanitizeCompanyName(name: string): string {
    if (!name) return 'CÔNG TY TNHH CHÂU PHƯƠNG THẢO'
    return name
        .replace(/CÔNG\s*TY\s*TNHH\s*CĂN\s*TIN\s*CHÂU\s*PHƯƠNG\s*THẢO/gi, 'CÔNG TY TNHH CHÂU PHƯƠNG THẢO')
        .replace(/Cty\s*TNHH\s*Căn\s*tin\s*Châu\s*Phương\s*Thảo/gi, 'CÔNG TY TNHH CHÂU PHƯƠNG THẢO')
        .replace(/CÔNG\s*TY\s*CHÂU\s*PHƯƠNG\s*THẢO/gi, 'CÔNG TY TNHH CHÂU PHƯƠNG THẢO')
        .replace(/căn\s*tin\s*châu\s*phương\s*thảo/gi, 'CHÂU PHƯƠNG THẢO')
        .replace(/CĂN\s*TIN\s*CHÂU\s*PHƯƠNG\s*THẢO/gi, 'CHÂU PHƯƠNG THẢO')
        .trim()
}
