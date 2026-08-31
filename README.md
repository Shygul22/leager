# 🏢 ZENJOURNEY ERP & Accounts Manager

An enterprise-grade, modern Financial Accounting, Tax Compliance, and ERP Web Application built for **ZENJOURNEY PRIVATE LIMITED**.

---

## 📌 Company Metadata

| Attribute | Details |
| :--- | :--- |
| **Company Name** | **ZENJOURNEY PRIVATE LIMITED** |
| **Corporate Identification Number (CIN)** | `U62013TN2026PTC191867` |
| **Date of Incorporation** | `07 April 2026` |
| **Financial Year Cycle** | `01 April – 31 March` (e.g. FY 2026-27) |
| **Authorized Executive** | Shygul Akbar (Founder & Executive Director) |

---

## 🚀 Key Modules & System Architecture

### 1. 📊 Executive Financial Dashboard (`/dashboard`)
* **Real-time Metrics**: Total Revenue, Total Costs, Net Profit, and Outstanding Balance.
* **Date Range Filter**: Filter by Today, This Week, All Time, or specific Financial Months (e.g., *Aug 2026*).
* **10 Accounting Formulas & Ratios**: Real-time computation of Basic Accounting Equation ($Assets = Liabilities + Capital$), Gross Profit Margin %, Net Profit Margin %, Expenses Ratio, Inventory Turnover, Debtors Turnover, and ROCE.
* **Client Cash Flow Analysis**: Breakdown of cash inflow vs outflow per client.

### 2. 💳 Double-Entry Transactions Ledger (`/transactions`)
* **Live Ledger**: Log and classify income and expense transactions.
* **Filtering & Search**: Category, Date, Payment Method (Bank Transfer, UPI, Cash, Cheque), and Type.
* **Fail-Safe CRUD**: Automatic RLS retry & optimistic cache invalidation for single and bulk deletions.

### 3. ⚖️ Tax & Compliance Hub (`/tax-reports`)
* **Due-Date Compliance Calendar**: Indian Private Limited Statutory Due Date Tracker:
  * **Form ADT-1**: First Auditor Appointment (Within 30 Days of Inc. $\rightarrow$ 07 May 2026)
  * **Form INC-20A**: Commencement of Business Declaration (Within 180 Days of Inc. $\rightarrow$ 04 Oct 2026)
  * **Form DPT-3**: Return of Deposits (30 June)
  * **DIR-3 KYC**: Directors KYC (30 September)
  * **Form AOC-4**: Audited Financial Statements (30 October)
  * **Form MGT-7A**: Small Company Annual Return (29 November)
  * **Advance Tax Schedules**: Q1 (15 June), Q2 (15 Sept), Q3 (15 Dec), Q4 (15 March)
* **Corporate Income Tax & Advance Tax Calculator**:
  * Corporate Tax under **Section 115BAA (25.168%)** vs Old Regime.
  * Section 32 Asset Block Depreciation (Computers 40%, Plant 15%, Furniture 10%).
  * Cash Basis (Realized Transactions) vs Accrual Basis (Billed Invoices) toggle.
* **Tax Ledger & TDS Credits**: Record Advance Tax Challans (ITNS 280) and Form 26AS TDS Credits.
* **GST Tax Center**: Reconciliation of GSTR-1 Outward Supply tax liability vs GSTR-3B Input Tax Credits (ITC).

### 4. 🏛️ Shareholders & Dividend Distribution Hub (`/shareholders`)
* **Net Profit Allocation Engine**: Dynamically distributes Net Profit between Dividends and Retained Earnings (Capital Reserves).
* **Equity Cap Table**: Register of equity shareholders, shares held, face value (₹10), and ownership percentage (%).
* **Section 194 TDS Rules**: Automatic 10% TDS deduction on dividends exceeding ₹5,000 per shareholder.
* **Printable Dividend Warrants**: Generate and print official Dividend Advice Vouchers.

### 5. 🚚 Suppliers & Vendor Payouts (`/suppliers`)
* **Vendor Directory**: Manage suppliers, payment terms (Net 30, Net 60), tax GSTIN, and bank/UPI payout details.
* **Vendor Payouts**: Record payout vouchers with proof attachments and audit logs.
* **Dual Deactivation Strategy**: Prevents PostgreSQL `409 Conflict` errors by soft-deactivating suppliers with existing payment history.

### 6. 📄 Invoices, Bills & Quotations (`/invoices`, `/bills`, `/quotations`)
* **GST Invoice Generator**: HSN/SAC code support, CGST/SGST/IGST breakdown, itemized discounts, and PDF printing.
* **Purchase Bills**: Track vendor bills, due dates, and partial payment statuses.
* **Quotations**: Create estimates and convert them into official tax invoices in 1 click.

### 7. 👥 Employees, Documents & Operations (`/employees`, `/documents`, `/projects`)
* **Payroll & Employees**: Department salaries, designation tracking, and PAN/bank details.
* **Document Library**: Folder organization, document tagging, and file uploads.
* **Support & Bug Tracker**: Multi-role issue tracking and client support tickets.

---

## 🛠️ Technology Stack

* **Frontend**: React 18, Vite, TypeScript, TailwindCSS
* **State Management**: TanStack React Query v5, React Context API
* **Icons & Charts**: Lucide React, Recharts
* **Backend & Database**: Supabase (PostgreSQL), PostgREST APIs, Row Level Security (RLS)
* **Date Utilities**: `date-fns`
* **Notifications**: `sonner`

---

## ⚡ Quick Database Setup (1-Click SQL)

To initialize or reset the complete database schema in Supabase:

1. Open your **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Go to **SQL Editor** (`>_`).
3. Open the consolidated [`complete_setup.sql`](file:///e:/ZENJOURNEY%20PRIVATE%20LIMITED/xyz/easy-ledger-main/complete_setup.sql) file.
4. Copy and paste the entire script into Supabase SQL Editor and click **Run**.

---

## 💻 Local Development Setup

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher

### Installation Steps

1. **Clone & Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   The application will run at `http://localhost:8081` (or your assigned port).

4. **Verify TypeScript & Production Build**:
   ```bash
   npx tsc --noEmit
   npm run build
   ```

---

## 📜 License & Copyright

© 2026 **ZENJOURNEY PRIVATE LIMITED**. All Rights Reserved.  
*Confidential and Proprietary Accounts & ERP Software.*
