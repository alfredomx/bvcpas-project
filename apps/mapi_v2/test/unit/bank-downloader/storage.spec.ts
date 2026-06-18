import {
  buildCheckFileName,
  buildStatementFileName,
  detectImageExtension,
  formatAmount,
  formatPostDate,
  safeFolderName,
} from '@plugins/bank-downloader/src/bank-download.storage'

const b64 = (bytes: number[]): string => Buffer.from(bytes).toString('base64')

describe('detectImageExtension', () => {
  it('reconoce PNG por magic bytes', () => {
    expect(detectImageExtension(b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png')
  })
  it('reconoce JPG por magic bytes', () => {
    expect(detectImageExtension(b64([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))).toBe('jpg')
  })
  it('cae a bin si no reconoce el formato', () => {
    expect(detectImageExtension(b64([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]))).toBe('bin')
  })
})

describe('formatPostDate', () => {
  it('convierte YYYYMMDD → MM-DD-YYYY', () => {
    expect(formatPostDate('20260116')).toBe('01-16-2026')
  })
  it('usa fallback legible si no es YYYYMMDD', () => {
    expect(formatPostDate('raro/2026')).toBe('raro2026')
    expect(formatPostDate('')).toBe('sin-fecha')
    expect(formatPostDate(undefined)).toBe('sin-fecha')
  })
})

describe('formatAmount', () => {
  it('formatea en-US', () => {
    expect(formatAmount(872.71)).toBe('872.71')
    expect(formatAmount(1200)).toBe('1,200')
  })
})

describe('safeFolderName', () => {
  it('conserva letras/números y limpia el resto', () => {
    expect(safeFolderName('Bilia Eatery, LLC.')).toBe('Bilia Eatery LLC.')
  })
  it('cae a sin-nombre cuando queda vacío', () => {
    expect(safeFolderName('***')).toBe('sin-nombre')
  })
})

describe('buildCheckFileName', () => {
  it('usa checkNumber + fecha', () => {
    expect(buildCheckFileName({ sequenceNumber: 's1', type: 'CHECK', checkNumber: '123', postDate: '20260116' }, 0)).toBe(
      '01-16-2026 - 123',
    )
  })
  it('agrega el monto cuando includeAmount', () => {
    expect(
      buildCheckFileName(
        { sequenceNumber: 's1', type: 'CHECK', checkNumber: '123', postDate: '20260116', amount: 872.71 },
        0,
        { includeAmount: true },
      ),
    ).toBe('01-16-2026 - 123 (872.71)')
  })
  it('usa el contador cuando no hay checkNumber', () => {
    expect(buildCheckFileName({ sequenceNumber: 's1', type: 'CHECK', postDate: '20260116' }, 7)).toBe(
      '01-16-2026 - 7',
    )
  })
})

describe('buildStatementFileName', () => {
  it('convierte YYYYMMDD → YYYY-MM', () => {
    expect(buildStatementFileName('20260131')).toBe('2026-01')
  })
})
