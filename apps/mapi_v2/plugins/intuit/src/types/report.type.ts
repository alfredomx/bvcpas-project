/**
 * Generic Report Entity
 * QuickBooks Online returns universally the same object structure for all Reports.
 * Report specific properties are sent via Query Arguments instead.
 */

export interface ReportHeader {
  Time?: string
  ReportName?: string
  DateMacro?: string
  StartPeriod?: string
  EndPeriod?: string
  Currency?: string
  Option?: any[]
  [key: string]: any
}

export interface ReportColumn {
  ColTitle?: string
  ColType?: string
  MetaData?: any[]
}

export interface ColData {
  value?: string
  id?: string
}

export interface ReportRow {
  Header?: { ColData?: ColData[] }
  Rows?: { Row?: ReportRow[] }
  Summary?: { ColData?: ColData[] }
  ColData?: ColData[]
  type?: string
  group?: string
}

export interface Report {
  Header?: ReportHeader
  Columns?: { Column?: ReportColumn[] }
  Rows?: { Row?: ReportRow[] }
}
