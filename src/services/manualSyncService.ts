import {
  buildProductsAndCustomersSyncQueue,
  getSyncQueueStats,
  pushProductsAndCustomersToCloud as pushQueuedItemsToCloud,
  retryPendingSyncQueue,
} from "../database/syncQueueRepository";

type QueueBuildResult = {
  productsQueued: number;
  customersQueued: number;
  message: string;
};

type QueueSyncResult = {
  pushed: number;
  failed: number;
  message: string;
};

type ManualSyncResult = {
  productsPushed: number;
  customersPushed: number;
  message: string;
};

export async function getCurrentSyncQueueSummary() {
  return getSyncQueueStats();
}

export async function queueProductsAndCustomersForSync(): Promise<QueueBuildResult> {
  const result = await buildProductsAndCustomersSyncQueue();

  return {
    productsQueued: result.products,
    customersQueued: result.customers,
    message: `Sync queue built. Products: ${result.products}, Customers: ${result.customers}.`,
  };
}

export async function syncPendingQueue(): Promise<QueueSyncResult> {
  const result = await retryPendingSyncQueue();

  return {
    pushed: result.pushed,
    failed: result.failed,
    message: `Queue sync finished. Pushed: ${result.pushed}, Failed: ${result.failed}.`,
  };
}

export async function pushProductsAndCustomersToCloud(): Promise<ManualSyncResult> {
  const queueResult = await buildProductsAndCustomersSyncQueue();
  const syncResult = await pushQueuedItemsToCloud(true);

  return {
    productsPushed: queueResult.products,
    customersPushed: queueResult.customers,
    message: `Cloud backup complete. Products: ${queueResult.products}, Customers: ${queueResult.customers}. Queue pushed: ${syncResult.pushed}, Failed: ${syncResult.failed}.`,
  };
}