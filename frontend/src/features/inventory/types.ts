export type StockLevel = 'normal' | 'warn' | 'low'

export interface Sku {
  id: number
  sku_code: string
  name: string
  brand: string | null
  spec: string | null
  unit: string
  management_mode: 'asset' | 'inventory' | 'consumable' | 'accessory'
  safety_stock: number
  max_stock: number | null
  monthly_use: number | null
  price: string | null
  available: number
  level: StockLevel
}

export interface SkuListResponse {
  total: number
  items: Sku[]
}

export interface Location {
  id: number
  name: string
  type: string | null
  address: string | null
}
