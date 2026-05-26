import { getCustomers } from "./customersRepository";
import { getProducts } from "./productsRepository";
import { getInvoices } from "./invoicesRepository";
import { getCashbookEntries } from "./expensesRepository";
import { getInvoiceReturns } from "./returnsRepository";
import type { InvoiceReturnLine } from "../types/return";
import type {
  ReportsSummary,
  ReportInvoice,
  ReportProduct,
  ReportRange,
} from "../types/report";

function getRangeBounds(range: ReportRange) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  let end = new Date(start);

  switch (range) {
    case "today":
      end = new Date(start);
      end.setDate(start.getDate() + 1);
      break;
    case "yesterday":
      start.setDate(start.getDate() - 1);
      end = new Date(start);
      end.setDate(start.getDate() + 1);
      break;
    case "month":
      start.setDate(1);
      end = new Date(start);
      end.setMonth(start.getMonth() + 1);
      break;
    case "all":
      return { startIso: null, endIso: null };
  }

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function isInRange(isoDate: string, startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) {
    return true;
  }

  const date = new Date(isoDate).getTime();
  return date >= new Date(startIso).getTime() && date < new Date(endIso).getTime();
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export async function getReportsSummary(
  range: ReportRange = "today"
): Promise<ReportsSummary> {
  const [products, customers, invoices, cashbookEntries, invoiceReturns] =
    await Promise.all([
      getProducts(),
      getCustomers(),
      getInvoices(),
      getCashbookEntries(),
      getInvoiceReturns(),
    ]);

  const activeInvoices = invoices.filter(
    (invoice: any) =>
      invoice.status !== "void" && invoice.payment_status !== "void"
  );

  const { startIso, endIso } = getRangeBounds(range);
  const rangeInvoices = activeInvoices.filter((invoice) =>
    isInRange(invoice.created_at, startIso, endIso)
  );
  const rangeCashbook = cashbookEntries.filter((entry) =>
    isInRange(entry.entry_at, startIso, endIso)
  );

  const rangeReturns = invoiceReturns.filter((item) =>
    isInRange(item.created_at, startIso, endIso)
  );

  const returnsByInvoiceId = new Map<string, InvoiceReturnLine[]>();
  for (const item of invoiceReturns) {
    const list = returnsByInvoiceId.get(item.invoice_id) ?? [];
    list.push(item);
    returnsByInvoiceId.set(item.invoice_id, list);
  }

  const returnsTotal = rangeReturns.reduce(
    (sum, item) => sum + asNumber(item.line_total),
    0
  );

  const salesBeforeReturns = rangeInvoices.reduce(
    (sum, invoice) => sum + asNumber(invoice.grand_total),
    0
  );

  const rangeSales = salesBeforeReturns - returnsTotal;

  const todaySales = rangeSales;

  const todayPaid = rangeInvoices.reduce(
    (sum, invoice) => sum + asNumber(invoice.paid_amount),
    0
  );

  const todayCashIn = rangeCashbook.reduce(
    (sum, entry) => sum + asNumber(entry.amount_in),
    0
  );

  const todayCashOut = rangeCashbook.reduce(
    (sum, entry) => sum + asNumber(entry.amount_out),
    0
  );

  const customerBalanceTotal = customers.reduce(
    (sum, customer) => sum + asNumber(customer.current_balance),
    0
  );

  const balanceEntries = activeInvoices.map((invoice) => {
    const returnedTotal = (returnsByInvoiceId.get(invoice.id) ?? []).reduce(
      (sum, item) => sum + asNumber(item.line_total),
      0
    );
    const returnStatus =
      returnedTotal <= 0
        ? undefined
        : returnedTotal >= asNumber(invoice.grand_total)
        ? "FULLY RETURNED"
        : "PARTIAL RETURNED";
    const balanceDue = returnStatus === "FULLY RETURNED" ? 0 : asNumber(invoice.balance_due);

    return {
      invoice,
      returnStatus,
      balanceDue,
    };
  });

  const invoiceUnpaidTotal = balanceEntries.reduce(
    (sum, entry) => sum + entry.balanceDue,
    0
  );

  const invoiceBalanceMetaById = new Map(
    balanceEntries.map((entry) => [entry.invoice.id, entry])
  );

  balanceEntries.forEach(({ invoice, returnStatus, balanceDue }) => {
    console.debug("[ReportsSummary] invoice", invoice.invoice_no, {
      balance_due: balanceDue,
      payment_status: invoice.payment_status,
      return_status: returnStatus,
    });
  });

  console.debug(
    "[ReportsSummary] invoiceUnpaidTotal",
    invoiceUnpaidTotal,
    "customerBalanceTotal",
    customerBalanceTotal
  );

  const openingBalanceTotal = customers.reduce(
    (sum, customer) => sum + asNumber(customer.opening_balance),
    0
  );

  const expectedCustomerBalance = openingBalanceTotal + invoiceUnpaidTotal;

  const udhaarDifference = customerBalanceTotal - expectedCustomerBalance;

  const totalUdhaar = customerBalanceTotal;

  const totalStockValue = products.reduce(
    (sum, product) =>
      sum + asNumber(product.stock_quantity) * asNumber(product.cost_price),
    0
  );

  const lowStockProducts: ReportProduct[] = products
    .filter(
      (product) =>
        asNumber(product.stock_quantity) <=
        asNumber(product.low_stock_alert ?? 5)
    )
    .map((product) => ({
      id: product.id,
      name: product.name,
      stock_quantity: asNumber(product.stock_quantity),
      selling_price: asNumber(product.selling_price),
      cost_price: asNumber(product.cost_price),
      low_stock_alert: asNumber(product.low_stock_alert ?? 5),
    }));

  const recentInvoices: ReportInvoice[] = rangeInvoices
    .slice(0, 5)
    .map((invoice) => {
      const invoiceMeta = invoiceBalanceMetaById.get(invoice.id);
      const returnsForInvoice = returnsByInvoiceId.get(invoice.id) ?? [];
      const returnedTotal = returnsForInvoice.reduce(
        (sum, item) => sum + asNumber(item.line_total),
        0
      );
      const netTotal = Math.max(
        0,
        asNumber(invoice.grand_total) - returnedTotal
      );
      const returnStatus = invoiceMeta?.returnStatus ??
        (returnedTotal <= 0
          ? invoice.payment_status
          : returnedTotal >= asNumber(invoice.grand_total)
          ? "FULLY RETURNED"
          : "PARTIAL RETURNED");

      return {
        id: invoice.id,
        invoice_no: invoice.invoice_no,
        customer_name: invoice.customer_name,
        payment_status: invoice.payment_status,
        return_status: returnStatus,
        grand_total: asNumber(invoice.grand_total),
        returned_total: returnedTotal,
        net_total: netTotal,
        paid_amount: asNumber(invoice.paid_amount),
        balance_due: invoiceMeta?.balanceDue ?? asNumber(invoice.balance_due),
        created_at: invoice.created_at,
        item_summary: invoice.item_summary,
      };
    });

  return {
    todaySales,
    todayPaid,
    todayCashIn,
    todayCashOut,
    todayExpectedCash: todayCashIn - todayCashOut,
    totalUdhaar,
    totalStockValue,
    lowStockCount: lowStockProducts.length,
    productCount: products.length,
    customerCount: customers.length,
    invoiceCount: rangeInvoices.length,
    invoiceUnpaidTotal,
    openingBalanceTotal,
    expectedCustomerBalance,
    customerBalanceTotal,
    udhaarDifference,
    recentInvoices,
    lowStockProducts,
  };
}