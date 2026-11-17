"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/lib/rbac";
import { uploadSchema } from "@/schemas/documents";
import { getOrgContext } from "@/server/org-context";

export type DocumentState = {
  error?: string;
  ok?: string;
  url?: string;
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

function fail(error: string): DocumentState {
  return { error };
}

export async function uploadDocumentAction(
  _prev: DocumentState,
  formData: FormData,
): Promise<DocumentState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "maintenance.write") && !can(ctx.role, "finance.write")) {
    return fail("not_authorised");
  }

  const parsed = uploadSchema.safeParse({
    entityType: formData.get("entityType"),
    entityId: formData.get("entityId"),
    kind: formData.get("kind"),
    expiresOn: formData.get("expiresOn") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return fail("invalid_input");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("file_required");
  if (file.size > MAX_UPLOAD_BYTES) return fail("file_too_large");
  if (!ALLOWED_TYPES.includes(file.type)) return fail("unsupported_file_type");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${ctx.orgId}/${parsed.data.entityType}/${parsed.data.entityId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await ctx.supabase.storage
    .from("documents")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return fail("upload_failed");

  const { error } = await ctx.supabase.from("documents").insert({
    org_id: ctx.orgId,
    entity_type: parsed.data.entityType,
    entity_id: parsed.data.entityId,
    kind: parsed.data.kind,
    path,
    expires_on: parsed.data.expiresOn || null,
    notes: parsed.data.notes || null,
    uploaded_by: ctx.userId,
  });
  if (error) {
    await ctx.supabase.storage.from("documents").remove([path]);
    return fail("failed");
  }

  revalidatePath("/documents");
  return { ok: "uploaded" };
}

/** Signed URL for one document the caller may read (RLS already scoped the row). */
export async function getDocumentUrlAction(documentId: string): Promise<DocumentState> {
  const ctx = await getOrgContext();
  if (!ctx) return fail("not_authorised");

  const { data: doc } = await ctx.supabase
    .from("documents")
    .select("path")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return fail("not_found");

  const { data, error } = await ctx.supabase.storage
    .from("documents")
    .createSignedUrl(doc.path, 60 * 10);
  if (error || !data) return fail("signing_failed");

  return { ok: "signed", url: data.signedUrl };
}
