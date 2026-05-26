export type SyncEntityTable = "products" | "customers";

export type SyncOperation = "upsert" | "delete";

export type SyncStatus = "pending" | "synced" | "failed";

export type SyncQueueItem = {
  id: string;
  entity_table: SyncEntityTable;
  entity_id: string;
  operation: SyncOperation;
  payload_json: string;
  status: SyncStatus;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type SyncQueueSummary = {
  pending: number;
  synced: number;
  failed: number;
  total: number;
  lastSyncedAt?: string | null;
};

export type EnqueueSyncItemInput = {
  entityTable: SyncEntityTable;
  entityId: string;
  operation: SyncOperation;
  payload: unknown;
};