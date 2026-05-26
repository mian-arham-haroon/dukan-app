import { Platform } from "react-native";
import type { User } from "@supabase/supabase-js";

import { getDatabase } from "../database/database";
import { DEFAULT_BUSINESS_ID } from "../database/seed";
import { getUserBusinessContext } from "./businessCloudService";
import { supabase } from "./supabase";

const WEB_DAILY_CLOSES_KEY = "dukan_app_web_daily_closes";

type LocalDailyClose = {
  id: string;
  business_id: string;
  store_id: string;
  expected_cash: number;
  actual_cash: number;
  difference: number;
  note: string | null;
  closed_at: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
};

type PushDailyCloseResult = {
  dailyClosesPushed: number;
  message: string;
};

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

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function getLocalDailyCloses(): Promise<LocalDailyClose[]> {
  if (Platform.OS === "web") {
    return readWebArray<LocalDailyClose>(WEB_DAILY_CLOSES_KEY);
  }

  const db = await getDatabase();

  if (!db) {
    throw new Error("SQLite database is not available.");
  }

  try {
    return await db.getAllAsync<LocalDailyClose>(
      `
      select
        id,
        business_id,
        store_id,
        expected_cash,
        actual_cash,
        difference,
        note,
        closed_at,
        created_at,
        updated_at,
        is_deleted
      from daily_closes
      where business_id = ?
      order by closed_at desc;
      `,
      [DEFAULT_BUSINESS_ID]
    );
  } catch {
    return [];
  }
}

export async function pushDailyClosesToCloud(
  user: User
): Promise<PushDailyCloseResult> {
  const context = await getUserBusinessContext(user);

  if (!context.business) {
    throw new Error("Cloud business not found. Setup business first.");
  }

  if (!context.store) {
    throw new Error("Cloud store not found. Setup store first.");
  }

  const closes = await getLocalDailyCloses();

  if (closes.length === 0) {
    return {
      dailyClosesPushed: 0,
      message: "No local daily close records found to push.",
    };
  }

  const now = new Date().toISOString();

  const rows = closes.map((close) => ({
    business_id: context.business!.id,
    store_id: context.store!.id,

    local_id: String(close.id),
    expected_cash: asNumber(close.expected_cash),
    actual_cash: asNumber(close.actual_cash),
    difference: asNumber(close.difference),
    note: close.note ?? null,
    closed_at: close.closed_at ?? now,

    is_deleted: Number(close.is_deleted ?? 0) === 1,
    created_at: close.created_at ?? now,
    updated_at: close.updated_at ?? now,
  }));

  const { error } = await supabase.from("daily_closes").upsert(rows, {
    onConflict: "business_id,local_id",
  });

  if (error) {
    throw error;
  }

  return {
    dailyClosesPushed: rows.length,
    message: `Daily closes pushed: ${rows.length}.`,
  };
}