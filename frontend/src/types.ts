export type Role = 'ADMIN' | 'WAITER' | 'CHEF' | 'ACCOUNTANT'

export interface User {
  id: number
  username: string
  first_name: string
  last_name: string
  display_name: string
  email: string
  phone: string
  role: Role
  is_active: boolean
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface LoginResponse {
  user: User
  tokens: AuthTokens
}

export type TableType = 'NORMAL' | 'CABIN'
export type TableStatus = 'FREE' | 'OCCUPIED' | 'BILLING'

export interface Table {
  id: number
  name: string
  table_type: TableType
  section: string
  capacity: number
  status: TableStatus
  sort_order: number
  is_active: boolean
}

export interface MenuCategory {
  id: number
  name: string
  sort_order: number
  is_active: boolean
  item_count: number
}

export interface MenuItem {
  id: number
  category: number
  category_name: string
  name: string
  description: string
  price: string
  image: string | null
  is_available: boolean
  is_packable: boolean
  sort_order: number
}

export interface Staff {
  id: number
  username: string
  first_name: string
  last_name: string
  display_name: string
  phone: string
  role: Exclude<Role, 'ADMIN'>
  is_active: boolean
  has_pin: boolean
  has_password: boolean
  date_joined: string
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type OrderStatus =
  | 'PLACED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'BILLED'
  | 'PAID'
  | 'CANCELLED'

export type ItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED'

export interface OrderItem {
  id: number
  menu_item: number
  name_snapshot: string
  unit_price: string
  quantity: number
  note: string
  packed: boolean
  status: ItemStatus
  line_total: string
  void_requested_qty: number
  void_reason: string
  cancel_disposition: '' | 'VOIDED' | 'STASHED' | 'WASTED'
}

export interface Order {
  id: number
  table: number
  table_name: string
  table_type: TableType
  waiter: number | null
  waiter_name: string
  status: OrderStatus
  guest_count: number
  note: string
  is_staff_meal: boolean
  staff_member: number | null
  staff_member_name: string
  items: OrderItem[]
  item_count: number
  subtotal: string
  created_at: string
  ready_at: string | null
  served_at: string | null
}

export interface RecipeComponent {
  id: number
  menu_item: number
  menu_item_name: string
  inventory_item: number
  inventory_item_name: string
  unit: string
  quantity_per_unit: string
}

export interface SalesReport {
  label: string
  range: { start: string; end: string }
  totals: {
    gross: number
    net: number
    discount: number
    service_charge: number
    vat: number
    orders: number
    items_sold: number
    avg_bill: number
  }
  by_day: { date: string; total: number; orders: number }[]
  by_payment: { method: string; total: number; count: number }[]
  by_waiter: { waiter: string; orders: number; revenue: number }[]
  by_item: { name: string; quantity: number; revenue: number }[]
  by_category: { name: string; revenue: number }[]
}

export type StockTxnType = 'IN' | 'OUT' | 'ADJUST'

export interface InventoryItem {
  id: number
  name: string
  unit: string
  quantity: string
  reorder_level: string
  unit_cost: string
  is_active: boolean
  is_low: boolean
}

export interface StockTransaction {
  id: number
  item: number
  item_name: string
  unit: string
  txn_type: StockTxnType
  txn_type_display: string
  quantity: string
  reason: string
  related_order: number | null
  actor_name: string
  created_at: string
}

export type PaymentStatus = 'UNPAID' | 'PAID'
export type PaymentMethod = 'CASH' | 'CARD' | 'ESEWA' | 'KHALTI' | 'BANK' | 'STAFF' | 'OTHER' | ''

export interface Bill {
  id: number
  order: number
  order_detail: Order
  table_name: string
  waiter_name: string
  bill_number: string
  subtotal: string
  discount: string
  service_charge: string
  vat: string
  total: string
  service_charge_percent: string
  vat_percent: string
  payment_status: PaymentStatus
  payment_method: PaymentMethod
  confirmed_by: number | null
  confirmed_by_name: string
  paid_at: string | null
  created_at: string
}

/** A line being assembled in the cart before it's sent to the kitchen. */
export interface DraftLine {
  menu_item: number
  name: string
  unit_price: string
  quantity: number
  note: string
  packed: boolean
  is_packable: boolean
}

export interface RestaurantSettings {
  name: string
  address: string
  phone: string
  pan_vat_no: string
  logo: string | null
  currency_code: string
  currency_symbol: string
  vat_percent: string
  service_charge_percent: string
  updated_at: string
}
