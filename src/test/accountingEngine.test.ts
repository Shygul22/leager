import { describe, it, expect } from "vitest";
import {
  calculateAccrualMetrics,
  calculateCashFlowMetrics,
  generateTrialBalance,
  calculateARAging,
  calculateAPAging
} from "../lib/accountingEngine";

describe("Accounting Engine & GAAP Calculations", () => {
  it("resolves the accounting discrepancy by strictly separating Accrual P&L from Cash Flow", () => {
    // 1. Invoices (Earned Sales Revenue) = ₹2,000
    const sampleInvoices = [
      {
        id: "inv-1",
        status: "sent",
        discount_percentage: 0,
        invoice_items: [{ quantity: 1, rate: 2000, gst: 18 }]
      }
    ];

    // 2. Bills (Direct COGS) = ₹0
    const sampleBills: any[] = [];

    // 3. Transactions (Cash Receipts & Disbursements)
    // Cash Inflow: ₹4,500
    // Operating Expenses Outflow: ₹2,140
    const sampleTransactions = [
      { id: "tx-1", type: "income", amount: 4500, description: "Client Advance Deposit", client_id: null },
      { id: "tx-2", type: "expense", amount: 2140, description: "Office Rent & Cloud Server Costs", supplier_id: null }
    ];

    // Calculate Accrual
    const accrual = calculateAccrualMetrics({
      invoices: sampleInvoices,
      bills: sampleBills,
      transactions: sampleTransactions
    });

    // Calculate Cash Flow
    const cashFlow = calculateCashFlowMetrics({
      transactions: sampleTransactions
    });

    // Cash Basis verification: ₹4,500 - ₹2,140 = ₹2,360
    expect(cashFlow.cashInflow).toBe(4500);
    expect(cashFlow.cashOutflow).toBe(2140);
    expect(cashFlow.netCashFlow).toBe(2360);

    // Accrual Basis verification: Sales = ₹2,000, OPEX = ₹2,140, Net Profit = -₹140
    expect(accrual.salesRevenue).toBe(2000);
    expect(accrual.totalRevenue).toBe(2000);
    expect(accrual.operatingExpenses).toBe(2140);
    expect(accrual.netProfit).toBe(-140);

    // They are now strictly separated without any calculation conflict!
    expect(cashFlow.netCashFlow).not.toBe(accrual.netProfit);
  });

  it("strictly balances Double-Entry Trial Balance where Debits == Credits", () => {
    const tb = generateTrialBalance({
      cashBalance: 2360,
      accountsReceivable: 2000,
      fixedAssets: 75000,
      accumulatedDepreciation: 0,
      accountsPayable: 0,
      taxPayable: 0,
      shareCapital: 75000,
      salesRevenue: 2000,
      otherIncome: 0,
      cogs: 0,
      operatingExpenses: 2140,
      retainedEarnings: 4500
    });

    expect(tb.isBalanced).toBe(true);
    expect(Math.abs(tb.totalDebits - tb.totalCredits)).toBeLessThan(0.01);
  });

  it("correctly buckets Accounts Receivable aging", () => {
    const today = new Date().toISOString();
    const invoices = [
      {
        id: "inv-recent",
        status: "sent",
        date: today,
        due_date: today,
        paid_amount: 0,
        invoice_items: [{ quantity: 1, rate: 5000, gst: 0 }]
      }
    ];

    const buckets = calculateARAging(invoices);
    expect(buckets[0].period).toContain("0-30 Days");
    expect(buckets[0].amount).toBe(5000);
    expect(buckets[0].count).toBe(1);
  });
});
