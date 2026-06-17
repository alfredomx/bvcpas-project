/**
 * Enums para Macros de Fecha comunes en Intuit
 */
export type DateMacro =
  | 'Today'
  | 'Yesterday'
  | 'This Week'
  | 'Last Week'
  | 'This Week-to-date'
  | 'Last Week-to-date'
  | 'This Month'
  | 'Last Month'
  | 'This Month-to-date'
  | 'Last Month-to-date'
  | 'This Quarter'
  | 'Last Quarter'
  | 'This Quarter-to-date'
  | 'Last Quarter-to-date'
  | 'This Year'
  | 'Last Year'
  | 'This Year-to-date'
  | 'Last Year-to-date'

/**
 * Argumentos base que comparten la gran mayoría de los reportes en QuickBooks Online.
 * Estos se pasan como Query Parameters en la URL.
 */
export interface CommonReportArgs {
  /**
   * Versión menor de la API para habilitar características específicas.
   */
  minorversion?: string

  /**
   * Método contable a utilizar en el reporte.
   * Valores comunes: "Cash" o "Accrual". Por defecto suele ser el configurado en la empresa.
   */
  accounting_method?: 'Cash' | 'Accrual'

  /**
   * Macro de fecha predefinido.
   * Si se provee, start_date y end_date son ignorados usualmente.
   */
  date_macro?: DateMacro

  /**
   * Fecha de inicio para los datos del reporte.
   * Formato esperado: YYYY-MM-DD
   */
  start_date?: string

  /**
   * Fecha de fin para los datos del reporte.
   * Formato esperado: YYYY-MM-DD
   */
  end_date?: string
}
