import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildCheckFileName,
  buildStatementFileName,
  detectImageExtension,
  formatAmount,
  formatPostDate,
  safeFolderName,
  saveChecksToDisk,
  saveDepositsToDisk,
  saveStatementsToDisk,
  saveTransactionFileToDisk,
} from '../../../src/modules/22-bank-worker/bank-download.storage'

const b64 = (bytes: number[]): string => Buffer.from(bytes).toString('base64')

/** PNG real 1x1 (válido para pdf-lib.embedPng). */
const PNG_1x1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('bank-download.storage — helpers puros', () => {
  it('detectImageExtension reconoce png/jpg/pdf y default bin', () => {
    expect(detectImageExtension(PNG_1x1)).toBe('png')
    expect(detectImageExtension(b64([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg')
    expect(detectImageExtension(Buffer.from('%PDF-1.4').toString('base64'))).toBe('pdf')
    expect(detectImageExtension(b64([0x00, 0x01, 0x02, 0x03]))).toBe('bin')
  })

  it('safeFolderName limpia caracteres no válidos', () => {
    expect(safeFolderName('Bilia Eatery, LLC')).toBe('Bilia Eatery LLC')
    expect(safeFolderName('a/b\\c:d*?')).toBe('abcd')
    expect(safeFolderName('   ')).toBe('sin-nombre')
  })

  it('formatPostDate: YYYYMMDD → MM-DD-YYYY (como el plugin original)', () => {
    expect(formatPostDate('20260603')).toBe('06-03-2026')
    expect(formatPostDate(undefined)).toBe('sin-fecha')
  })

  it('buildCheckFileName: "MM-DD-YYYY - checkNumber"; usa fallback si falta el número', () => {
    expect(
      buildCheckFileName(
        { sequenceNumber: 's', type: 'CHECK', checkNumber: '1234', postDate: '20260603' },
        0,
      ),
    ).toBe('06-03-2026 - 1234')
    expect(
      buildCheckFileName({ sequenceNumber: 's', type: 'CHECK', postDate: '20260604' }, 7),
    ).toBe('06-04-2026 - 7')
  })

  it('buildCheckFileName con includeAmount agrega " (monto)" (depósitos)', () => {
    expect(
      buildCheckFileName(
        {
          sequenceNumber: 's',
          type: 'CHECK',
          checkNumber: '1263',
          postDate: '20260612',
          amount: 800,
        },
        0,
        { includeAmount: true },
      ),
    ).toBe('06-12-2026 - 1263 (800)')
  })

  it('formatAmount: en-US con separador de miles', () => {
    expect(formatAmount(872.71)).toBe('872.71')
    expect(formatAmount(1200)).toBe('1,200')
  })

  it('buildStatementFileName: YYYYMMDD → YYYY-MM', () => {
    expect(buildStatementFileName('20260131')).toBe('2026-01')
  })
})

describe('bank-download.storage — deposits / statements / transactions', () => {
  let base: string

  beforeEach(async () => {
    base = await mkdtemp(join(tmpdir(), 'bw-extra-'))
  })
  afterEach(async () => {
    await rm(base, { recursive: true, force: true })
  })

  it('saveDepositsToDisk: slip + cheques como PDF con monto en el nombre', async () => {
    const { dir, filesWritten } = await saveDepositsToDisk({
      baseDir: base,
      clientName: 'Bilia Eatery LLC',
      accounts: [
        {
          account_mask: '9027',
          deposits: [
            {
              depositSlipImage: {
                sequenceNumber: 'D1',
                type: 'DEPOSIT_SLIP',
                postDate: '20260605',
                amount: 1500,
                frontImageBase64: PNG_1x1,
              },
              checksImages: [
                {
                  sequenceNumber: 'c1',
                  type: 'CHECK',
                  checkNumber: '777',
                  postDate: '20260605',
                  amount: 900,
                  frontImageBase64: PNG_1x1,
                },
              ],
            },
          ],
        },
      ],
    })

    expect(dir).toBe(join(base, 'Bilia Eatery LLC'))
    expect(filesWritten).toBe(2)
    const files = (await readdir(join(dir, '9027'))).sort()
    // slip sin checkNumber → fallback 0, con monto; cheque con su número + monto.
    expect(files).toEqual(['06-05-2026 - 0 (1,500).pdf', '06-05-2026 - 777 (900).pdf'])
  })

  it('saveStatementsToDisk: escribe YYYY-MM.pdf desde el base64 (sin convertir)', async () => {
    const pdfB64 = Buffer.from('%PDF-1.4 fake statement').toString('base64')
    const { dir, filesWritten } = await saveStatementsToDisk({
      baseDir: base,
      clientName: 'Bilia',
      accounts: [
        {
          account_mask: '9027',
          statements: [{ documentId: 'X', date: '20260131', pdfBase64: pdfB64 }],
        },
      ],
    })

    expect(filesWritten).toBe(1)
    expect(await readdir(join(dir, '9027'))).toEqual(['2026-01.pdf'])
    const content = await readFile(join(dir, '9027', '2026-01.pdf'), 'utf8')
    expect(content).toBe('%PDF-1.4 fake statement')
  })

  it('saveTransactionFileToDisk: <mask> (from to to).csv con el contenido', async () => {
    const { dir, file } = await saveTransactionFileToDisk({
      baseDir: base,
      clientName: 'Bilia',
      accountMask: '9027',
      from: '06-01-2026',
      to: '06-14-2026',
      format: 'CSV',
      content: 'Date,Amount\n06/01,10.00\n',
    })

    expect(file).toBe(join(dir, '9027', '9027 (06-01-2026 to 06-14-2026).csv'))
    expect(await readFile(file, 'utf8')).toBe('Date,Amount\n06/01,10.00\n')
  })
})

describe('bank-download.storage — saveChecksToDisk (PDF con formato del operador)', () => {
  let base: string

  beforeEach(async () => {
    base = await mkdtemp(join(tmpdir(), 'bw-checks-'))
  })
  afterEach(async () => {
    await rm(base, { recursive: true, force: true })
  })

  it('escribe 1 PDF por cheque con el nombre MM-DD-YYYY - check; salta cuentas vacías', async () => {
    const { dir, filesWritten } = await saveChecksToDisk({
      baseDir: base,
      clientName: 'Bilia Eatery, LLC',
      accounts: [
        {
          account_mask: '9027',
          checks: [
            {
              sequenceNumber: 's1',
              type: 'CHECK',
              checkNumber: '1234',
              postDate: '20260603',
              frontImageBase64: PNG_1x1,
            },
            {
              sequenceNumber: 's2',
              type: 'CHECK',
              postDate: '20260604',
              frontImageBase64: PNG_1x1,
            }, // sin checkNumber → fallback 0
          ],
        },
        { account_mask: '5799', checks: [] }, // sin cheques → se salta
      ],
    })

    expect(dir).toBe(join(base, 'Bilia Eatery LLC'))
    expect(filesWritten).toBe(2)

    const files = (await readdir(join(dir, '9027'))).sort()
    expect(files).toEqual(['06-03-2026 - 1234.pdf', '06-04-2026 - 0.pdf'])

    // Cada archivo es un PDF real (magic bytes %PDF).
    const head = (await readFile(join(dir, '9027', '06-03-2026 - 1234.pdf'))).subarray(0, 4)
    expect(head.toString('latin1')).toBe('%PDF')

    // La cuenta sin cheques no creó carpeta.
    expect(await readdir(dir)).toEqual(['9027'])
  })
})
