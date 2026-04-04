# Retail Management System - Implementation Plan

**Project Name:** Retail Management
**Version:** 1.0
**Last Updated:** 2025-04-03

---

## Overview

A comprehensive retail management system for a hardware/building materials store. Single-user, single-location application with supplier management, inventory tracking, and purchase/bill management.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15 (App Router) |
| **UI Framework** | Tailwind CSS + shadcn/ui |
| **Icons** | Lucide React |
| **Database** | Supabase (PostgreSQL) |
| **State Management** | TanStack Query (React Query) |
| **Date Handling** | nepali-date-converter (Bikram Sambat) |
| **Forms** | React Hook Form + Zod |
| **Tables** | TanStack Table |

---

## Navigation Structure

```
┌─────────────────────────────────────┐
│           RETAIL MANAGEMENT          │
├─────────────────────────────────────┤
│  📊 Dashboard                        │
│  📦 Inventory                        │
│     ├── Products                    │
│     ├── Categories                  │
│     └── Units                       │
│  👥 Suppliers                        │
│  📄 Bills                            │
│     ├── Supplier Bills              │
│     └── Bill History                │
│  📈 Reports                          │
│     ├── Stock Report                │
│     ├── Supplier Ledger             │
│     └── Outstanding Balances        │
│  ⚙️ Settings                         │
│     ├── Tax Configuration           │
│     └── User Preferences            │
└─────────────────────────────────────┘
```

---

## Dashboard Metrics

| Metric | Description |
|--------|-------------|
| Total Products | Count of active products |
| Total Suppliers | Count of active suppliers |
| Low Stock Alerts | Products below threshold |
| Total Outstanding | Sum of all debit amounts (what you owe) |
| Recent Bills | Last 10 bills |
| Quick Actions | Add Bill, Add Product, Add Supplier |

---

## Database Schema

### Table: `categories`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| name | TEXT | NOT NULL |
| prefix | TEXT | UNIQUE, NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### Table: `units`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| name | TEXT | NOT NULL |
| abbreviation | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### Table: `suppliers`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| supplier_code | TEXT | UNIQUE, NOT NULL |
| name | TEXT | NOT NULL |
| phone | TEXT | UNIQUE, NOT NULL |
| phone_country | TEXT | NOT NULL, DEFAULT 'NP' |
| phone_national | TEXT | NOT NULL |
| email | TEXT | |
| address | TEXT | |
| gst_pan_number | TEXT | |
| bank_details | TEXT | |
| remarks | TEXT | |
| status | TEXT | DEFAULT 'active' |
| date_bs | TEXT | NOT NULL |
| date_ad | DATE | NOT NULL |
| time | TIME | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

### Table: `products`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| product_code | TEXT | UNIQUE, NOT NULL |
| name | TEXT | NOT NULL |
| category_id | UUID | REFERENCES categories(id) |
| unit | TEXT | NOT NULL |
| quantity | DECIMAL(12,2) | DEFAULT 0 |
| brand | TEXT | |
| buy_rate | DECIMAL(12,2) | NOT NULL |
| sell_rate | DECIMAL(12,2) | NOT NULL |
| vat_pan | TEXT | |
| status | TEXT | DEFAULT 'active' |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

### Table: `supplier_bills`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| bill_code | TEXT | UNIQUE, NOT NULL |
| supplier_id | UUID | REFERENCES suppliers(id) |
| invoice_no | TEXT | |
| date_bs | TEXT | NOT NULL |
| date_ad | DATE | NOT NULL |
| time | TIME | NOT NULL |
| total_amount | DECIMAL(12,2) | NOT NULL |
| total_with_vat | DECIMAL(12,2) | NOT NULL |
| debit_amount | DECIMAL(12,2) | NOT NULL |
| credit_amount | DECIMAL(12,2) | NOT NULL |
| status | TEXT | DEFAULT 'pending' |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

### Table: `bill_items`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| bill_id | UUID | REFERENCES supplier_bills(id) |
| product_id | UUID | REFERENCES products(id) |
| quantity | DECIMAL(12,2) | NOT NULL |
| unit | TEXT | NOT NULL |
| buy_rate | DECIMAL(12,2) | NOT NULL |
| amount | DECIMAL(12,2) | NOT NULL |
| vat_pan | TEXT | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### Table: `price_history`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| product_id | UUID | REFERENCES products(id) |
| buy_rate | DECIMAL(12,2) | NOT NULL |
| sell_rate | DECIMAL(12,2) | NOT NULL |
| date_bs | TEXT | NOT NULL |
| date_ad | DATE | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### Table: `stock_history`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| product_id | UUID | REFERENCES products(id) |
| quantity_change | DECIMAL(12,2) | NOT NULL |
| quantity_after | DECIMAL(12,2) | NOT NULL |
| type | TEXT | NOT NULL | -- 'in', 'out', 'adjustment'
| reference_type | TEXT | | -- 'bill', 'sale', 'manual'
| reference_id | UUID | |
| date_bs | TEXT | NOT NULL |
| date_ad | DATE | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

---

## Module Specifications

### 1. Categories Module

**Fields:**
- Name (required)
- Prefix (3-letter code, auto-generated or custom)

**Predefined Categories:**
| Category | Prefix |
|----------|--------|
| Electrical | ELE |
| Plumbing | PLB |
| Paints & Finishes | PNT |
| Cement & Concrete | CMT |
| Steel & TMT | STL |
| Roofing / CGI Sheets | RFG |
| Plywood & Boards | PLY |
| Tiles & Flooring | TIL |
| Glass | GLS |
| Hardware & Fittings | HDW |
| Appliances | APL |
| Tools | TOL |
| Sanitary | SAN |
| Welding & Fabrication | WLD |
| Safety & Security | SAF |

**Features:**
- Add/Edit/Delete categories
- Delete only if no products in category
- Category profile with product list and stats

---

### 2. Units Module

**Fields:**
- Name (required, e.g., "Pieces")
- Abbreviation (required, e.g., "pcs")

**Predefined Units:**
| Abbreviation | Name |
|--------------|------|
| pcs | Pieces |
| m | Meters |
| ft | Feet |
| sqft | Square Feet |
| L | Liters |
| kg | Kilograms |
| bag | Bag |
| set | Set |
| box | Box |
| roll | Roll |

**Features:**
- Add/Edit/Delete units
- Delete only if no products using it

---

### 3. Products / Inventory Module

**Fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Product Code | Auto | Yes | Format: {Prefix}-{Sequence} |
| Name | Text | Yes | |
| Category | Dropdown | Yes | |
| Unit | Dropdown | Yes | |
| Quantity | Number | No | Default 0, displays "—" if empty |
| Brand | Text | No | |
| Buy Rate | Number | Yes | NPR, 2 decimals |
| Sell Rate | Number | Yes | NPR, 2 decimals |
| VAT/PAN | Toggle | No | Optional |
| Status | Toggle | Yes | Active/Inactive (soft delete) |

**Product Code Format:**
- `{CategoryPrefix}-{Sequence}`
- Example: ELE-001, CMT-001, APL-001
- Per-category sequence, continues globally

**Features:**
- Add/Edit/Delete products
- Soft delete (inactive)
- Search by name, code, category
- Filter by category, status
- Product profile with:
  - Overview
  - Price History (timeline)
  - Stock History (in/out movements)
  - Linked Suppliers

---

### 4. Suppliers Module

**Fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Supplier ID | Auto | Yes | Format: SUP{Year}-{Sequence} |
| Name | Text | Yes | |
| Phone | Text | Yes | With country code, unique |
| Country | Dropdown | Yes | Default: Nepal, auto-updates phone code |
| Email | Text | No | |
| Address | Text | No | Multi-line |
| GST/PAN | Text | No | |
| Bank Details | Text | No | Multi-line |
| Remarks | Text | No | Multi-line |
| Status | Toggle | Yes | Active/Inactive (soft delete) |
| Date (BS) | Nepali Date | Yes | Synced with AD |
| Date (AD) | Gregorian Date | Yes | Synced with BS |
| Time | Time | Yes | Auto-captured to seconds |

**Supplier ID Format:**
- `SUP{NepaliYear}-{GlobalSequence}`
- Example: SUP2082-001, SUP2082-002
- Sequence continues globally across years

**Features:**
- Add/Edit/Delete suppliers
- Soft delete (inactive shows grayed out)
- Search by name, phone, supplier ID
- Filter by status
- Supplier profile with:
  - Overview
  - All Bills
  - Transaction History
  - Outstanding Balance
  - Products Supplied

---

### 5. Supplier Bills Module

**Bill Entry Fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Supplier | Dropdown + Add | Yes | Search existing or add new inline |
| Date (BS) | Nepali Date | Yes | Synced, defaults to today |
| Date (AD) | Gregorian Date | Yes | Synced |
| Invoice No. | Text | No | Supplier's invoice number |
| Total Amount | Number | Yes | Manual or auto from items |
| Total + VAT | Number | Yes | Auto: Total × 1.13 |
| Debit Amount | Number | Yes | Outstanding/pending |
| Credit Amount | Number | Yes | Paid amount |

**Bill Items (Stock Entry):**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Product | Search + Add | Yes | Search existing or add new inline |
| Quantity | Number | Yes | |
| Unit | Dropdown | Yes | Auto-filled from product, editable |
| Buy Rate | Number | Yes | Auto-filled from product, editable |
| Amount | Number | Auto | Qty × Rate |
| VAT/PAN | Toggle | No | Per-item, optional |

**Features:**
- Unlimited items per bill
- Add new supplier inline (redirects, returns after save)
- Add new product inline
- Auto-calculate Total from items (overridable)
- Auto-adjust Debit/Credit based on Total
- Bill history with filters
- Bill details view with all items

---

### 6. Reports Module

**Stock Report:**
- All products with current quantity
- Low stock alerts (below threshold)
- Filter by category
- Export to CSV/PDF (future)

**Supplier Ledger:**
- Per-supplier transaction history
- Running outstanding balance
- All bills with payment status

**Outstanding Balances:**
- Total outstanding across all suppliers
- Breakdown by supplier
- Aging report (how long pending)

---

### 7. Settings Module

**Tax Configuration:**
- VAT rate (default: 13%)
- Currency (default: NPR)

**User Preferences:**
- Default country for suppliers
- Date format preference
- Low stock threshold

---

## Implementation Order

| Phase | Module | Description |
|-------|--------|-------------|
| 1 | Project Setup | Next.js + Tailwind + shadcn/ui + Supabase |
| 2 | Database | Supabase tables, relationships, indexes |
| 3 | Core UI | Layout, sidebar, navigation |
| 4 | Dashboard | Metrics, quick actions |
| 5 | Categories | CRUD, predefined data |
| 6 | Units | CRUD, predefined data |
| 7 | Products/Inventory | CRUD, search, filter, profiles |
| 8 | Suppliers | CRUD, search, filter, profiles |
| 9 | Supplier Bills | Bill creation, stock entry, item management |
| 10 | Reports | Stock report, supplier ledger, outstanding |
| 11 | Settings | Tax, preferences |
| 12 | Polish | Error handling, loading states, validation |

---

## Future Features (v2+)

- POS / Sales Module
- Customer Management
- Credit Accounts
- Payment Tracking
- Receipt Printing
- Barcode Integration
- Multi-location Support
- AI Integration (planned)

---

## Technical Decisions

### Nepali Date Handling
- Use `nepali-date-converter` library
- Store both BS (as string: "2082/01/15") and AD (as DATE) for every record
- UI: Side-by-side synced calendars
- Auto-sync when either is edited

### Phone Number Handling
- Use country dropdown with flags
- Auto-populate country code based on selection
- Store full number with country code
- Default country: Nepal (+977)

### Auto-Generated IDs
- Supplier ID: `SUP{Year}-{Sequence}` — global sequence across years
- Product Code: `{CategoryPrefix}-{Sequence}` — per-category sequence
- Bill Code: `BIL-{Sequence}` — global sequence

### Quantity Auto-Tracking
- Bill saved → stock_history records added, product quantity updated
- All movements logged with type and reference

---

## File Structure (Proposed)

```
retail-management/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Dashboard
│   │   ├── inventory/
│   │   │   ├── products/
│   │   │   ├── categories/
│   │   │   └── units/
│   │   ├── suppliers/
│   │   │   ├── page.tsx             # List
│   │   │   ├── [id]/
│   │   │   └── new/
│   │   ├── bills/
│   │   │   ├── page.tsx             # List
│   │   │   ├── [id]/
│   │   │   └── new/
│   │   ├── reports/
│   │   └── settings/
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── ui/                           # shadcn components
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── ...
│   ├── forms/
│   ├── tables/
│   └── ...
├── lib/
│   ├── supabase.ts
│   ├── utils.ts
│   ├── nepali-date.ts
│   └── ...
├── types/
│   └── index.ts
├── hooks/
│   └── ...
└── public/
```

---

## Notes

- All dates stored in both BS and AD
- All amounts in NPR with 2 decimal precision
- Soft delete for suppliers and products (status field)
- Debit = Outstanding (what you owe), Credit = Paid
- Total + VAT = Total × 1.13 (VAT at 13%)
- Prices stored exclusive of tax
- Search implemented across all relevant fields

---

*End of Implementation Plan*