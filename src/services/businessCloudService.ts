import type { User } from "@supabase/supabase-js";

import { supabase } from "./supabase";
import type {
  CloudBusiness,
  CloudBusinessContext,
  CloudProfile,
  CloudStore,
} from "../types/cloud";

type CreateBusinessInput = {
  businessName: string;
  storeName: string;
  address?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export async function ensureCloudProfile(user: User): Promise<CloudProfile> {
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";

  const email = user.email ?? "";

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name: fullName,
        email,
        updated_at: nowIso(),
      },
      {
        onConflict: "id",
      }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as CloudProfile;
}

export async function getUserBusinessContext(
  user: User
): Promise<CloudBusinessContext> {
  await ensureCloudProfile(user);

  const { data: ownedBusiness, error: ownedBusinessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (ownedBusinessError) {
    throw ownedBusinessError;
  }

  if (ownedBusiness) {
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .eq("business_id", ownedBusiness.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (storeError) {
      throw storeError;
    }

    return {
      business: ownedBusiness as CloudBusiness,
      store: (store as CloudStore | null) ?? null,
      role: "owner",
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("business_members")
    .select(
      `
      role,
      business_id,
      businesses (
        id,
        owner_id,
        name,
        currency,
        country,
        created_at,
        updated_at
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  const business = Array.isArray(membership?.businesses)
    ? membership?.businesses[0]
    : membership?.businesses;

  if (!business) {
    return {
      business: null,
      store: null,
      role: null,
    };
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("*")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (storeError) {
    throw storeError;
  }

  return {
    business: business as CloudBusiness,
    store: (store as CloudStore | null) ?? null,
    role: membership?.role ?? "member",
  };
}

export async function createBusinessWithFirstStore(
  user: User,
  input: CreateBusinessInput
): Promise<CloudBusinessContext> {
  const businessName = input.businessName.trim();
  const storeName = input.storeName.trim();
  const address = input.address?.trim() || null;

  if (!businessName) {
    throw new Error("Business name is required.");
  }

  if (!storeName) {
    throw new Error("Store name is required.");
  }

  await ensureCloudProfile(user);

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .insert({
      owner_id: user.id,
      name: businessName,
      currency: "PKR",
      country: "PK",
    })
    .select("*")
    .single();

  if (businessError) {
    throw businessError;
  }

  const typedBusiness = business as CloudBusiness;

  const { error: memberError } = await supabase.from("business_members").insert({
    business_id: typedBusiness.id,
    user_id: user.id,
    role: "owner",
  });

  if (memberError) {
    throw memberError;
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .insert({
      business_id: typedBusiness.id,
      name: storeName,
      code: "MAIN",
      address,
      is_active: true,
    })
    .select("*")
    .single();

  if (storeError) {
    throw storeError;
  }

  return {
    business: typedBusiness,
    store: store as CloudStore,
    role: "owner",
  };
}