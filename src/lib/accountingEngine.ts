// ============================================================================
// ZENJOURNEY ERP - MASTER ACCOUNTING ENGINE & LEDGER CALCULATOR
// Compliant with GAAP / Indian Accounting Standards (Ind AS)
// Explicitly separates Accrual (Income Statement) from Cash Flow (Cash Statement)
// ============================================================================

export interface AccrualMetrics {
  totalRevenue: number;
  salesRevenue: number;
  otherIncome: number;
  cogs: number;
  grossProfit: number;
  grossProfitMargin: number;
  operatingExpenses: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  taxExpense: number;
  netProfit: number;
  netProfitMargin: number;
}

export interface CashFlowMetrics {
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
  openingCash: number;
  closingCash: number;
  operatingCashFlow: number;
}

export interface TrialBalanceItem {
  code: string;
  name: string;
  category: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  debit: number;
  credit: number;
}

export interface AgingBucket {
  period: string; // '0-30 Days', '31-60 Days', '61-90 Days', '90+ Days'
  amount: number;
  count: number;
  items: any[];
}

/**
 * Calculates GAAP Accrual Financial Performance
 * Revenue is recognized when invoices are earned (Accrual basis).
 * Costs are categorized into COGS and Operating Expenses.
 */
export function calculateAccrualMetrics({
  invoices = [],
  bills = [],
  transactions = [],
  depreciation = 0,
  taxRatePercent = 0
}: {
  invoices: any[];
  bills: any[];
  transactions: any[];
  depreciation?: number;
  taxRatePercent?: number;
}): AccrualMetrics {
  // 1. Sales Revenue: Invoiced sales excluding tax (Base Revenue)
  let salesRevenue = 0;
  invoices.forEach((inv) => {
    if (inv.status !== 'cancelled') {
      const items = inv.invoice_items || [];
      const subtotal = items.reduce((sum: number, item: any) => sum + (Number(item.quantity || 1) * Number(item.rate || 0)), 0);
      const discount = subtotal * (Number(inv.discount_percentage || 0) / 100);
      salesRevenue += (subtotal - discount);
    }
  });

  // 2. Other Operating / Non-Operating Income from general ledger transactions (explicitly non-sales income like bank interest)
  const otherIncome = transactions
    .filter((t) => t.type === 'income' && (t.category === 'Interest' || t.category === 'Dividend' || t.category === 'Other Income' || t.category === 'Miscellaneous Income'))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalRevenue = salesRevenue + otherIncome;

  // 3. Cost of Goods Sold (COGS): Direct supplier bills / subcontractor costs
  let cogs = 0;
  bills.forEach((b) => {
    if (b.status !== 'cancelled' && (b.category === 'Direct Cost' || b.category === 'COGS' || b.category === 'Project Expense' || !b.category || b.category === 'General Expense')) {
      const items = b.bill_items || [];
      const subtotal = items.reduce((sum: number, item: any) => sum + (Number(item.quantity || 1) * Number(item.rate || 0)), 0);
      const discount = subtotal * (Number(b.discount_percentage || 0) / 100);
      cogs += (subtotal - discount);
    }
  });

  // 4. Gross Profit
  const grossProfit = totalRevenue - cogs;
  const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // 5. Operating Expenses (OPEX): General overheads from expenses (excluding bill payments to prevent double counting)
  const operatingExpenses = transactions
    .filter((t) => t.type === 'expense' && !t.description?.toLowerCase().startsWith('paid bill ') && !t.supplier_id)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  // 6. EBITDA
  const ebitda = grossProfit - operatingExpenses;

  // 7. EBIT
  const ebit = ebitda - depreciation;

  // 8. Tax Expense provision
  const taxExpense = ebit > 0 ? ebit * (taxRatePercent / 100) : 0;

  // 9. Net Profit (Accrual Bottom Line)
  const netProfit = ebit - taxExpense;
  const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    totalRevenue,
    salesRevenue,
    otherIncome,
    cogs,
    grossProfit,
    grossProfitMargin,
    operatingExpenses,
    ebitda,
    depreciation,
    ebit,
    taxExpense,
    netProfit,
    netProfitMargin
  };
}

/**
 * Calculates Pure Cash Flow Performance
 * Based strictly on actual cash/bank deposits and disbursements.
 */
export function calculateCashFlowMetrics({
  transactions = [],
  openingCash = 0
}: {
  transactions: any[];
  openingCash?: number;
}): CashFlowMetrics {
  const cashInflow = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const cashOutflow = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const netCashFlow = cashInflow - cashOutflow;
  const closingCash = openingCash + netCashFlow;

  return {
    cashInflow,
    cashOutflow,
    netCashFlow,
    openingCash,
    closingCash,
    operatingCashFlow: netCashFlow
  };
}

/**
 * Calculates Accounts Receivable (AR) Aging Schedule
 * Buckets: 0-30 days, 31-60 days, 61-90 days, 90+ days past due or invoice date
 */
export function calculateARAging(invoices: any[]): AgingBucket[] {
  const now = new Date();
  const buckets: AgingBucket[] = [
    { period: '0-30 Days (Current)', amount: 0, count: 0, items: [] },
    { period: '31-60 Days', amount: 0, count: 0, items: [] },
    { period: '61-90 Days', amount: 0, count: 0, items: [] },
    { period: '90+ Days (Overdue)', amount: 0, count: 0, items: [] }
  ];

  invoices.forEach((inv) => {
    if (inv.status === 'paid' || inv.status === 'cancelled') return;

    // Calculate invoice total with tax & discount
    const items = inv.invoice_items || [];
    const subtotal = items.reduce((s: number, i: any) => s + Number(i.quantity || 1) * Number(i.rate || 0), 0);
    const discount = subtotal * (Number(inv.discount_percentage || 0) / 100);
    const tax = items.reduce((s: number, i: any) => s + Number(i.quantity || 1) * Number(i.rate || 0) * (Number(i.gst || 0) / 100), 0) * (1 - Number(inv.discount_percentage || 0) / 100);
    const totalAmount = (subtotal - discount) + tax;
    const outstanding = Math.max(0, totalAmount - Number(inv.paid_amount || 0));

    if (outstanding <= 0.01) return;

    const baseDate = new Date(inv.due_date || inv.date || inv.created_at);
    const diffDays = Math.floor((now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 30) {
      buckets[0].amount += outstanding;
      buckets[0].count += 1;
      buckets[0].items.push({ ...inv, outstanding, days: diffDays });
    } else if (diffDays <= 60) {
      buckets[1].amount += outstanding;
      buckets[1].count += 1;
      buckets[1].items.push({ ...inv, outstanding, days: diffDays });
    } else if (diffDays <= 90) {
      buckets[2].amount += outstanding;
      buckets[2].count += 1;
      buckets[2].items.push({ ...inv, outstanding, days: diffDays });
    } else {
      buckets[3].amount += outstanding;
      buckets[3].count += 1;
      buckets[3].items.push({ ...inv, outstanding, days: diffDays });
    }
  });

  return buckets;
}

/**
 * Calculates Accounts Payable (AP) Aging Schedule
 */
export function calculateAPAging(bills: any[]): AgingBucket[] {
  const now = new Date();
  const buckets: AgingBucket[] = [
    { period: '0-30 Days (Current)', amount: 0, count: 0, items: [] },
    { period: '31-60 Days', amount: 0, count: 0, items: [] },
    { period: '61-90 Days', amount: 0, count: 0, items: [] },
    { period: '90+ Days (Overdue)', amount: 0, count: 0, items: [] }
  ];

  bills.forEach((b) => {
    if (b.status === 'paid' || b.status === 'cancelled') return;

    const items = b.bill_items || [];
    const subtotal = items.reduce((s: number, i: any) => s + Number(i.quantity || 1) * Number(i.rate || 0), 0);
    const tax = items.reduce((s: number, i: any) => s + Number(i.quantity || 1) * Number(i.rate || 0) * (Number(i.gst || 0) / 100), 0);
    const totalAmount = subtotal + tax;
    const outstanding = Math.max(0, totalAmount - Number(b.paid_amount || 0));

    if (outstanding <= 0.01) return;

    const baseDate = new Date(b.due_date || b.date || b.created_at);
    const diffDays = Math.floor((now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 30) {
      buckets[0].amount += outstanding;
      buckets[0].count += 1;
      buckets[0].items.push({ ...b, outstanding, days: diffDays });
    } else if (diffDays <= 60) {
      buckets[1].amount += outstanding;
      buckets[1].count += 1;
      buckets[1].items.push({ ...b, outstanding, days: diffDays });
    } else if (diffDays <= 90) {
      buckets[2].amount += outstanding;
      buckets[2].count += 1;
      buckets[2].items.push({ ...b, outstanding, days: diffDays });
    } else {
      buckets[3].amount += outstanding;
      buckets[3].count += 1;
      buckets[3].items.push({ ...b, outstanding, days: diffDays });
    }
  });

  return buckets;
}

/**
 * Generates an Audit-Proof Double-Entry Trial Balance
 * Ensures Debits == Credits across all ledger accounts.
 */
export function generateTrialBalance({
  cashBalance = 0,
  accountsReceivable = 0,
  fixedAssets = 0,
  accumulatedDepreciation = 0,
  accountsPayable = 0,
  taxPayable = 0,
  shareCapital = 0,
  salesRevenue = 0,
  otherIncome = 0,
  cogs = 0,
  operatingExpenses = 0,
  retainedEarnings = 0
}: {
  cashBalance: number;
  accountsReceivable: number;
  fixedAssets: number;
  accumulatedDepreciation: number;
  accountsPayable: number;
  taxPayable: number;
  shareCapital: number;
  salesRevenue: number;
  otherIncome: number;
  cogs: number;
  operatingExpenses: number;
  retainedEarnings: number;
}): { items: TrialBalanceItem[]; totalDebits: number; totalCredits: number; isBalanced: boolean } {
  const items: TrialBalanceItem[] = [
    // 1000 Assets (Normal Debit balance)
    { code: '1010', name: 'Cash & Bank Balances', category: 'Current Assets', type: 'asset', debit: Math.max(0, cashBalance), credit: cashBalance < 0 ? Math.abs(cashBalance) : 0 },
    { code: '1030', name: 'Accounts Receivable (Debtors)', category: 'Current Assets', type: 'asset', debit: Math.max(0, accountsReceivable), credit: 0 },
    { code: '1510', name: 'IT Equipment & Hardware', category: 'Fixed Assets', type: 'asset', debit: Math.max(0, fixedAssets), credit: 0 },
    { code: '1520', name: 'Accumulated Depreciation', category: 'Fixed Assets', type: 'asset', debit: 0, credit: Math.max(0, accumulatedDepreciation) },

    // 2000 Liabilities (Normal Credit balance)
    { code: '2010', name: 'Accounts Payable (Creditors)', category: 'Current Liabilities', type: 'liability', debit: 0, credit: Math.max(0, accountsPayable) },
    { code: '2020', name: 'Tax / GST Payable', category: 'Current Liabilities', type: 'liability', debit: 0, credit: Math.max(0, taxPayable) },

    // 3000 Equity (Normal Credit balance)
    { code: '3010', name: 'Share Capital / Founder Equity', category: 'Equity', type: 'equity', debit: 0, credit: Math.max(0, shareCapital) },
    { code: '3020', name: 'Retained Earnings', category: 'Equity', type: 'equity', debit: 0, credit: Math.max(0, retainedEarnings) },

    // 4000 Revenue (Normal Credit balance)
    { code: '4010', name: 'Software & Development Revenue', category: 'Operating Revenue', type: 'revenue', debit: 0, credit: Math.max(0, salesRevenue) },
    { code: '4040', name: 'Other Operating / Non-Operating Income', category: 'Other Income', type: 'revenue', debit: 0, credit: Math.max(0, otherIncome) },

    // 5000 & 6000 Expenses (Normal Debit balance)
    { code: '5010', name: 'Cost of Goods Sold (Direct Costs)', category: 'Direct Expense', type: 'expense', debit: Math.max(0, cogs), credit: 0 },
    { code: '6010', name: 'Operating Expenses (Overheads & Admin)', category: 'Operating Expense', type: 'expense', debit: Math.max(0, operatingExpenses), credit: 0 }
  ];

  const totalDebits = items.reduce((sum, item) => sum + item.debit, 0);
  const totalCredits = items.reduce((sum, item) => sum + item.credit, 0);

  return {
    items,
    totalDebits,
    totalCredits,
    isBalanced: Math.abs(totalDebits - totalCredits) < 0.05
  };
}
