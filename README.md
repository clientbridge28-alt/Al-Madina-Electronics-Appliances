# Al-Madina Electronics & Appliances ERP

Enterprise Showroom Business Management System for Electronics & Home Appliances Retail, Wholesale & Installment Recovery.

![Al-Madina ERP](https://img.shields.io/badge/Platform-Al--Madina%20ERP-blue)
![Build](https://img.shields.io/badge/Build-Passing-brightgreen)
![React](https://img.shields.io/badge/React-19.0-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8)
![License](https://img.shields.io/badge/License-Proprietary-red)

---

## 1. Project Overview

**Al-Madina Electronics & Appliances ERP** is a full-featured, showroom-tailored Enterprise Resource Planning system specifically engineered for Pakistani electronics showrooms. It handles end-to-end showroom workflows including:
- Cash, Credit, and Hire-Purchase/Installment sales.
- IMEI and Serial Number inventory tracking with supplier traceability.
- Double-entry chart of accounts, vouchers, customer & supplier ledgers, and trial balances.
- Post-dated cheque (PDC) clearing registers.
- Staff daily task queues, biometric-style attendance, and front-desk visitor registration.
- Audit-grade PDF exports and native Excel (`.xlsx`) two-way import/export.
- Optional WordPress / WooCommerce REST API synchronization.

---

## 2. Technology Stack

- **Frontend Core:** React 19 (SPA Architecture), TypeScript, Vite 8.
- **Styling & Design System:** Tailwind CSS v4, Lucide React Iconography, Motion.
- **Data Analytics & Visualizations:** Recharts 3.x responsive charting engine.
- **Document Generation:** `jspdf` & `jspdf-autotable` for audit-ready PDF statements.
- **Spreadsheet Processing:** `xlsx` (SheetJS) for native Excel import, export, and template generation.
- **Database & Persistence:**
  - Reactive Local Storage & In-Memory Cache engine with live observer pattern subscriptions.
  - Optional Google Cloud Firestore & Firebase Auth integration.
- **CI / CD:** GitHub Actions automated linting, type-checking, and production bundle verification.

---

## 3. Core Showroom Modules

1. **Executive Dashboard (`DashboardView`)**: Real-time sales turnover, inventory valuation, active receivables, Recharts 6-month sales & purchase trend visualization with performance insights.
2. **Sales & POS Billing (`POSBillingView`)**: Barcode scanning, serial number assignment, Cash / Credit / Installment invoicing, thermal & A4 invoice printing.
3. **Products & Serialized Inventory (`InventoryView`)**: Multi-category appliances catalog (ACs, Refrigerators, LED TVs, Washing Machines), warranty tracking, and serial status lifecycles.
4. **Purchase Invoices & Consignments (`PurchasesView`)**: Supplier consignment intake, landed freight costing, serial unit generation, and accounts payable ledger updates.
5. **Installments & Recovery (`InstallmentsView`)**: Hire-purchase financing calculator, guarantor recording, installment schedules, recovery officer assignments, and receipt generation.
6. **Customers Directory (`CustomersView`)**: Customer profiles, CNIC numbers, credit limits, outstanding balances, and Excel import/export.
7. **Suppliers & Vendors (`SuppliersView`)**: Distributor contacts, NTN registration, payment terms, and accounts payable ledgers.
8. **Staff Attendance (`AttendanceView`)**: Floor check-in/out, working hours, late arrivals, half-day tracking, and monthly attendance sheets.
9. **Daily Staff Tasks (`TasksView`)**: Departmental to-do management, priority tagging (Urgent to Low), status transitions, and progress monitoring.
10. **Visitors Register (`VisitorsView`)**: Showroom footfall logger, visitor purpose categorization, and floor checkout tracking.
11. **Vouchers & Journals (`AccountingView`)**: Double-entry Journal (JV), Payment (PV), Receive (RV), and Contra (CV) vouchers with debit=credit validation.
12. **Ledgers & Trial Balance (`LedgersView`)**: Real-time customer, supplier, and general ledger account statements with running balances.
13. **Cheque Management (`ChequesView`)**: Post-dated customer and vendor cheques, clearing registers, and automatic bank reconciliation.
14. **Reports & Financial Intelligence (`ReportsView`)**: Profit & Loss statements, COGS, Stock Valuation, Due Date Recovery Lists, and Brand-wise analytics.
15. **Targets & Goals (`TargetsView`)**: Monthly showroom sales and recovery quotas dynamically computed from real transactions.
16. **Audit Trail & Backup (`AuditBackupView`)**: Full audit history logging user actions, JSON backup download, and disaster restore.
17. **Showroom Settings (`SettingsView`)**: Showroom header details, NTN/STRN, print format selection, and WordPress / WooCommerce API credentials.

---

## 4. Installation & Local Development

### Prerequisites
- Node.js (v20+ recommended)
- npm or bun

### Setup Commands
```bash
# Clone the repository
git clone https://github.com/clientbridge28-alt/Al-Madina-Electronics-Appliances.git
cd Al-Madina-Electronics-Appliances

# Install all dependencies
npm install

# Start the development server
npm run dev
```
The application will launch on `http://localhost:3000`.

---

## 5. Environment Variables & Security

Configure environment variables by copying `.env.example`:
```bash
cp .env.example .env
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `APP_URL` | Hosted production URL | Cloud Run service URL |
| `GEMINI_API_KEY` | Optional Gemini AI service key | Injected at runtime |

> **Security Rule:** Never commit `.env` or files containing live credentials. The project `.gitignore` automatically blocks private keys, `.env*` files, and credentials.

---

## 6. Role-Based Access Control (RBAC)

The ERP enforces strict role-based profiles:
- **Owner / Super Admin:** Full system authority, audit trails, database backup & restore.
- **Showroom Manager:** Operational floor control, staff tasks, and targets.
- **Head Cashier:** POS billing, payment receipts, and cash register balance.
- **Senior Accountant:** Double-entry vouchers, chart of accounts, and ledger reconciliation.
- **Recovery Officer:** Installment portfolio tracking, due date collections, and customer recovery receipts.
- **Stock Incharge:** Warehouse receipts, product cataloging, and serial tracking.
- **Front Receptionist:** Staff attendance and visitor register logging.

---

## 7. Build & Deployment Commands

```bash
# Run TypeScript compilation and type verification
npm run lint

# Compile production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 8. Data Modes

- **Clean Production Mode (Default):** Strictly uses real user-entered transactions, zero mock figures, and displays audit-ready empty states when a clean database is initiated.
- **Interactive Demo Mode:** Accessible via the top header for client demonstrations, pre-loaded with realistic Pakistani electronics showroom datasets.
