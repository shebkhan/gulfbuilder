"use server";

import { z } from "zod";
import { getOrgContext } from "@/server/org-context";

export type SearchResult = {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export type SearchState = { results: SearchResult[] };

const schema = z.object({ q: z.string().trim().min(2).max(80) });

export async function searchAction(q: string): Promise<SearchState> {
  const parsed = schema.safeParse({ q });
  if (!parsed.success) return { results: [] };

  const ctx = await getOrgContext();
  if (!ctx) return { results: [] };

  const term = `%${parsed.data.q}%`;
  const supabase = ctx.supabase;
  const results: SearchResult[] = [];

  const [buildings, units, tenants, leases, owners, cheques] = await Promise.all([
    supabase.from("buildings").select("id, code, name").or(`name.ilike.${term},code.ilike.${term}`).limit(5),
    supabase.from("units").select("id, unit_no, building_id").ilike("unit_no", term).limit(5),
    supabase.from("tenants").select("id, full_name, phone").ilike("full_name", term).limit(5),
    supabase.from("leases").select("id, lease_no").ilike("lease_no", term).limit(5),
    supabase.from("owners").select("id, name").ilike("name", term).limit(5),
    supabase.from("cheques").select("id, cheque_no, bank_name").ilike("cheque_no", term).limit(5),
  ]);

  for (const b of buildings.data ?? []) results.push({ type: "building", id: b.id, title: b.name, subtitle: b.code, href: `/buildings/${b.id}` });
  for (const u of units.data ?? []) results.push({ type: "unit", id: u.id, title: u.unit_no, href: `/units/${u.id}` });
  for (const t of tenants.data ?? []) results.push({ type: "tenant", id: t.id, title: t.full_name, subtitle: t.phone ?? undefined, href: `/tenants/${t.id}` });
  for (const l of leases.data ?? []) results.push({ type: "lease", id: l.id, title: l.lease_no, href: `/leases/${l.id}` });
  for (const o of owners.data ?? []) results.push({ type: "owner", id: o.id, title: o.name, href: `/owners` });
  for (const c of cheques.data ?? []) results.push({ type: "cheque", id: c.id, title: c.cheque_no, subtitle: c.bank_name ?? undefined, href: `/cheques` });

  return { results };
}