"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export type ListingState = { error?: string; ok?: string };

function fail(error: string): ListingState {
  return { error };
}

const updateSchema = z.object({
  unitId: z.string().uuid(),
  buildingId: z.string().uuid(),
  isListed: z.enum(["true", "false"]).optional(),
  title: z.string().trim().max(160).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .regex(/^[a-z0-9-]*$/, "invalid_slug")
    .optional()
    .or(z.literal("")),
});

export async function updateListingAction(
  _prev: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "properties.write")) return fail("not_authorised");

  const parsed = updateSchema.safeParse({
    unitId: formData.get("unitId"),
    buildingId: formData.get("buildingId"),
    isListed: (formData.get("isListed") as string | null) ?? undefined,
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    slug: formData.get("slug") ?? "",
  });
  if (!parsed.success) return fail("invalid_input");

  const d = parsed.data;
  const payload: Record<string, unknown> = {};
  if (d.isListed !== undefined) payload.is_listed_publicly = d.isListed === "true";
  if (d.title !== undefined) payload.listing_title = d.title === "" ? null : d.title;
  if (d.description !== undefined) payload.listing_description = d.description === "" ? null : d.description;
  if (d.slug !== undefined) payload.listing_slug = d.slug === "" ? null : d.slug;
  if (Object.keys(payload).length === 0) return { ok: "saved" };

  const { error } = await ctx.supabase.from("units").update(payload as never).eq("id", d.unitId);
  if (error) {
    if (error.code === "23505") return fail("duplicate_slug");
    return fail("failed");
  }

  revalidatePath(`/units/${d.unitId}`);
  revalidatePath(`/units/${d.unitId}/listing`);
  revalidatePath(`/${"en"}/properties`);
  return { ok: "saved" };
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function addListingImageAction(
  _prev: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "properties.write")) return fail("not_authorised");

  const unitId = String(formData.get("unitId") ?? "");
  const buildingId = String(formData.get("buildingId") ?? "");
  const altText = String(formData.get("altText") ?? "").trim();
  const file = formData.get("file");

  if (!unitId || !buildingId) return fail("invalid_input");
  if (!(file instanceof File) || file.size === 0) return fail("file_required");
  if (file.size > MAX_IMAGE_BYTES) return fail("file_too_large");
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return fail("unsupported_file_type");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${ctx.orgId}/${unitId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await ctx.supabase.storage
    .from("listing-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return fail("upload_failed");

  const { data: existing } = await ctx.supabase
    .from("listing_images")
    .select("sort_order")
    .eq("unit_id", unitId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (existing?.sort_order ?? -1) + 1;

  const { error } = await ctx.supabase.from("listing_images").insert({
    org_id: ctx.orgId,
    unit_id: unitId,
    path,
    alt_text: altText || null,
    sort_order: nextOrder,
    created_by: ctx.userId,
  });
  if (error) {
    await ctx.supabase.storage.from("listing-images").remove([path]);
    return fail("failed");
  }

  revalidatePath(`/units/${unitId}/listing`);
  return { ok: "uploaded" };
}

export async function removeListingImageAction(formData: FormData): Promise<void> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "properties.write")) return;

  const imageId = String(formData.get("imageId") ?? "");
  const unitId = String(formData.get("unitId") ?? "");
  if (!imageId || !unitId) return;

  const { data: img } = await ctx.supabase
    .from("listing_images")
    .select("path")
    .eq("id", imageId)
    .maybeSingle();
  if (img?.path) {
    await ctx.supabase.storage.from("listing-images").remove([img.path]);
  }
  await ctx.supabase.from("listing_images").delete().eq("id", imageId);

  revalidatePath(`/units/${unitId}/listing`);
}

export async function toggleBuildingListingAction(formData: FormData): Promise<void> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "properties.write")) return;

  const buildingId = String(formData.get("buildingId") ?? "");
  const isListed = formData.get("isListed") === "true";
  if (!buildingId) return;

  await ctx.supabase
    .from("buildings")
    .update({ is_listed_publicly: isListed })
    .eq("id", buildingId);

  revalidatePath(`/buildings/${buildingId}`);
}