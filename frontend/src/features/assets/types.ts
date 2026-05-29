export type AssetStatus = 'in_use' | 'idle' | 'maintenance' | 'scrapped'
export type AssetClass = 'personal' | 'infrastructure'

export interface Asset {
  id: number
  asset_code: string
  asset_class: AssetClass
  asset_type_id: number | null
  asset_type_name: string | null
  asset_type_icon: string | null
  asset_type_color: string | null
  brand_model: string | null
  spec: string | null
  serial_number: string | null
  legacy_code: string | null
  status: AssetStatus
  owner_user_id: number | null
  owner_name: string | null
  department_id: number | null
  department_name: string | null
  location: string | null
  purchase_date: string | null
  purchase_price: string | null
  warranty_expire_date: string | null
  supplier: string | null
  remark: string | null
  scrap_candidate: boolean
  needs_review: boolean
}

export interface ChangeLog {
  action: string
  from_status: string | null
  to_status: string | null
  operator_id: number | null
  reason: string | null
  created_at: string
}

export interface Accessory {
  asset_accessory_id: number | null
  sku_id: number | null
  quantity: number
  binding_type: string
  need_return: boolean
}

export interface AssetDetail {
  asset: Asset
  lifecycle: ChangeLog[]
  accessories: Accessory[]
}

export interface AssetListResponse {
  total: number
  items: Asset[]
}
