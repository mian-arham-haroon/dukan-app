import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { getDatabase } from "../database/database";
import { DEFAULT_BUSINESS_ID } from "../database/seed";
import type { InvoicePrintData, InvoicePrintLine } from "../types/invoicePrint";
import type { InvoiceReturnLine } from "../types/return";
import { getUserBusinessContext } from "./businessCloudService";
import { supabase } from "./supabase";

const WEB_INVOICES_KEY = "dukan_app_web_invoices";
const WEB_INVOICE_ITEMS_KEY = "dukan_app_web_invoice_items";
const WEB_RETURNS_KEY = "dukan_app_web_invoice_returns";

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatMoney(value: number): string {
  return `Rs ${Number(value || 0).toLocaleString("en-PK")}`;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString();
}

function buildReturnKey(productId: string | null, productName: string): string {
  return productId ? `id:${productId}` : `name:${productName.trim().toLowerCase()}`;
}

function aggregateReturnedQuantities(returns: InvoiceReturnLine[]) {
  const map = new Map<string, number>();

  for (const item of returns) {
    const key = buildReturnKey(item.product_id ?? null, item.product_name);
    map.set(key, (map.get(key) ?? 0) + asNumber(item.quantity));
  }

  return map;
}

function sumReturnTotal(returns: InvoiceReturnLine[]) {
  return returns.reduce((sum, item) => sum + asNumber(item.line_total), 0);
}

function readWebArray<T>(key: string): T[] {
  const storage = (globalThis as any).localStorage;

  if (!storage) {
    return [];
  }

  const raw = storage.getItem(key);

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildFallbackLines(invoice: any): InvoicePrintLine[] {
  const summary = String(
    invoice.item_summary ??
      `${invoice.item_name ?? "Item"} × ${invoice.quantity ?? 1}`
  );

  const grandTotal = asNumber(invoice.grand_total);

  const match = summary.match(/^(.*?)\s*[×x]\s*(\d+(\.\d+)?)$/i);

  if (match) {
    const productName = match[1].trim() || "Item";
    const quantity = asNumber(match[2]) || 1;
    const unitPrice = quantity > 0 ? grandTotal / quantity : 0;

    return [
      {
        id: `${invoice.id}-summary`,
        product_name: productName,
        quantity,
        unit_price: unitPrice,
        line_total: grandTotal,
      },
    ];
  }

  return [
    {
      id: `${invoice.id}-summary`,
      product_name: summary,
      quantity: asNumber(invoice.quantity ?? invoice.item_count ?? 1) || 1,
      unit_price: 0,
      line_total: grandTotal,
    },
  ];
}

export async function getInvoicePrintData(
  invoiceId: string
): Promise<InvoicePrintData> {
  if (!invoiceId) {
    throw new Error("Invoice id is required.");
  }

  if (Platform.OS === "web") {
    const invoices = readWebArray<any>(WEB_INVOICES_KEY);
    const invoice = invoices.find((item) => item.id === invoiceId);

    if (!invoice) {
      throw new Error("Invoice not found.");
    }

    let items = readWebArray<any>(WEB_INVOICE_ITEMS_KEY).filter(
      (item) =>
        item.invoice_id === invoiceId && Number(item.is_deleted ?? 0) === 0
    );

    if (items.length === 0) {
      const embeddedItems =
        invoice.items ??
        invoice.invoice_items ??
        invoice.line_items ??
        invoice.lines ??
        [];

      items = Array.isArray(embeddedItems) ? embeddedItems : [];
    }

    const returns = readWebArray<InvoiceReturnLine>(WEB_RETURNS_KEY).filter(
      (item) => item.invoice_id === invoiceId
    );

    const returnedMap = aggregateReturnedQuantities(returns);
    const returnedTotal = sumReturnTotal(returns);
    const originalTotal = asNumber(invoice.grand_total);
    const netTotal = Math.max(0, originalTotal - returnedTotal);
    const returnStatus =
      returnedTotal <= 0
        ? undefined
        : returnedTotal >= originalTotal
        ? "FULLY RETURNED"
        : "PARTIAL RETURNED";

    const lines: InvoicePrintLine[] =
      items.length > 0
        ? items.map((item) => {
            const productId =
              item.product_id ?? item.productId ?? item.id ?? null;
            const productName = String(
              item.product_name_snapshot ??
                item.product_name ??
                item.productName ??
                item.name ??
                item.item_name ??
                "Item"
            );
            const soldQuantity = asNumber(
              item.quantity ?? item.qty ?? item.count ?? 0
            );
            const returnedQuantity =
              returnedMap.get(buildReturnKey(productId, productName)) ?? 0;

            return {
              id: String(item.id ?? `${invoice.id}-${productName}`),
              product_name: productName,
              quantity: soldQuantity,
              unit_price: asNumber(
                item.unit_price ?? item.unitPrice ?? item.price ?? 0
              ),
              line_total: asNumber(item.line_total),
              returned_quantity: returnedQuantity,
            };
          })
        : buildFallbackLines(invoice);

    return {
      id: String(invoice.id),
      local_id: invoice.local_id ? String(invoice.local_id) : undefined,
      invoice_no: String(invoice.invoice_no),
      customer_name: String(invoice.customer_name ?? "Walk-in"),
      payment_status: String(invoice.payment_status ?? "unpaid"),
      return_status: returnStatus,
      original_total: originalTotal,
      returned_total: returnedTotal,
      net_total: netTotal,
      grand_total: originalTotal,
      paid_amount: asNumber(invoice.paid_amount),
      balance_due: asNumber(invoice.balance_due),
      created_at: String(invoice.created_at),
      item_summary: String(invoice.item_summary ?? ""),
      lines,
    };
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  const invoice = await db.getFirstAsync<any>(
    `
    SELECT
      invoices.id,
      invoices.invoice_no,
      COALESCE(customers.name, 'Walk-in') as customer_name,
      invoices.payment_status,
      invoices.grand_total,
      invoices.paid_amount,
      invoices.balance_due,
      invoices.created_at,
      COALESCE(
        GROUP_CONCAT(invoice_items.product_name_snapshot || ' × ' || invoice_items.quantity, ', '),
        'Items'
      ) as item_summary
    FROM invoices
    LEFT JOIN customers ON customers.id = invoices.customer_id
    LEFT JOIN invoice_items ON invoice_items.invoice_id = invoices.id
    WHERE invoices.id = ?
      AND invoices.business_id = ?
      AND invoices.is_deleted = 0
    GROUP BY invoices.id
    LIMIT 1;
    `,
    [invoiceId, DEFAULT_BUSINESS_ID]
  );

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  const returns = await db.getAllAsync<InvoiceReturnLine>(
    `
    SELECT *
    FROM invoice_returns
    WHERE invoice_id = ?
      AND is_deleted = 0;
    `,
    [invoiceId]
  );

  const returnedMap = aggregateReturnedQuantities(returns);
  const returnedTotal = sumReturnTotal(returns);
  const originalTotal = asNumber(invoice.grand_total);
  const netTotal = Math.max(0, originalTotal - returnedTotal);
  const returnStatus =
    returnedTotal <= 0
      ? undefined
      : returnedTotal >= originalTotal
      ? "FULLY RETURNED"
      : "PARTIAL RETURNED";

  const lines = await db.getAllAsync<InvoicePrintLine>(
    `
    SELECT
      id,
      product_name_snapshot as product_name,
      quantity,
      unit_price,
      line_total
    FROM invoice_items
    WHERE invoice_id = ?
      AND is_deleted = 0
    ORDER BY created_at ASC;
    `,
    [invoiceId]
  );

  const enrichedLines = lines.map((line) => {
    const returnedQuantity =
      returnedMap.get(buildReturnKey(line.id ?? null, line.product_name)) ?? 0;
    return {
      ...line,
      returned_quantity: returnedQuantity,
    };
  });

  return {
    id: String(invoice.id),
    invoice_no: String(invoice.invoice_no),
    customer_name: String(invoice.customer_name ?? "Walk-in"),
    payment_status: String(invoice.payment_status ?? "unpaid"),
    return_status: returnStatus,
    original_total: originalTotal,
    returned_total: returnedTotal,
    net_total: netTotal,
    grand_total: originalTotal,
    paid_amount: asNumber(invoice.paid_amount),
    balance_due: asNumber(invoice.balance_due),
    created_at: String(invoice.created_at),
    item_summary: String(invoice.item_summary ?? ""),
    lines: enrichedLines.length > 0 ? enrichedLines : buildFallbackLines(invoice),
  };
}

type InvoiceBusinessInfo = {
  businessName: string;
  storeName: string;
  address: string;
  currency: string;
};

const defaultBusinessInfo: InvoiceBusinessInfo = {
  businessName: "My Dukan",
  storeName: "Main Store",
  address: "",
  currency: "PKR",
};

async function getInvoiceBusinessInfo(): Promise<InvoiceBusinessInfo> {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return defaultBusinessInfo;
    }

    const context = await getUserBusinessContext(data.user);

    return {
      businessName: context.business?.name ?? defaultBusinessInfo.businessName,
      storeName: context.store?.name ?? defaultBusinessInfo.storeName,
      address: context.store?.address ?? "",
      currency: context.business?.currency ?? "PKR",
    };
  } catch {
    return defaultBusinessInfo;
  }
}

export function buildInvoiceHtml(
  invoice: InvoicePrintData,
  businessInfo: InvoiceBusinessInfo = defaultBusinessInfo
): string {
  const rows = invoice.lines
    .map(
      (line, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(line.product_name)}</td>
          <td class="right">${line.quantity}</td>
          <td class="right">${
            line.unit_price > 0 ? formatMoney(line.unit_price) : "-"
          }</td>
          <td class="right">${formatMoney(line.line_total)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(invoice.invoice_no)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 24px;
            color: #111827;
          }

          .invoice {
            max-width: 760px;
            margin: 0 auto;
          }

          .header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            border-bottom: 2px solid #111827;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }

          h1 {
            margin: 0;
            font-size: 28px;
          }

          .muted {
            color: #64748b;
            font-size: 13px;
          }

          .box {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 14px;
            margin-bottom: 16px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
          }

          th, td {
            border-bottom: 1px solid #e5e7eb;
            padding: 10px;
            text-align: left;
            font-size: 14px;
          }

          th {
            background: #f8fafc;
          }

          .right {
            text-align: right;
          }

          .totals {
            margin-left: auto;
            width: 320px;
            margin-top: 20px;
          }

          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }

          .grand {
            font-size: 18px;
            font-weight: 700;
          }

          .status {
            display: inline-block;
            padding: 6px 10px;
            border-radius: 999px;
            background: #e0f2fe;
            color: #075985;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 12px;
          }

          @media print {
            button {
              display: none;
            }

            body {
              padding: 0;
            }
          }
        </style>
      </head>

      <body>
        <div class="invoice">
          <div class="header">
            <div>
              <h1>${escapeHtml(businessInfo.businessName)}</h1>
              <div class="muted">${escapeHtml(businessInfo.storeName)}</div>
              <div class="muted">${escapeHtml(businessInfo.address)}</div>
            </div>

            <div class="right">
              <strong>${escapeHtml(invoice.invoice_no)}</strong>
              <div class="muted">${escapeHtml(formatDate(invoice.created_at))}</div>
              <div style="margin-top: 8px;">
                <span class="status">${escapeHtml(invoice.payment_status)}</span>
              </div>
            </div>
          </div>

          <div class="box">
            <strong>Customer</strong>
            <div>${escapeHtml(invoice.customer_name)}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th class="right">Qty</th>
                <th class="right">Unit Price</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>Grand total</span>
              <strong>${formatMoney(invoice.grand_total)}</strong>
            </div>

            <div class="total-row">
              <span>Paid amount</span>
              <strong>${formatMoney(invoice.paid_amount)}</strong>
            </div>

            <div class="total-row grand">
              <span>Balance due</span>
              <strong>${formatMoney(invoice.balance_due)}</strong>
            </div>
          </div>

          <p class="muted" style="margin-top: 32px;">
            Thank you for shopping with ${escapeHtml(businessInfo.businessName)}.
          </p>
        </div>

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `;
}

export async function printInvoice(invoice: InvoicePrintData): Promise<void> {
  const businessInfo = await getInvoiceBusinessInfo();
  const html = buildInvoiceHtml(invoice, businessInfo);

  if (Platform.OS === "web") {
    const browserWindow = (globalThis as any).open("", "_blank");

    if (!browserWindow) {
      throw new Error("Popup blocked. Allow popups and try again.");
    }

    browserWindow.document.open();
    browserWindow.document.write(html);
    browserWindow.document.close();
    return;
  }

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    await Print.printAsync({
      uri,
    });

    return;
  }

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: `Share ${invoice.invoice_no}`,
  });
}