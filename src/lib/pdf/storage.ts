import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Uploads a rendered PDF to the private `documents` bucket under
 * `{orgId}/{folder}/{entityId}.pdf`, records a row in `documents`, and returns
 * a short-lived signed URL. Shared by receipt/owner-statement/contract PDF
 * actions to avoid repeating the upload+record+sign logic.
 */
export async function storePdf(
  supabase: SupabaseClient<any>,
  orgId: string,
  userId: string,
  folder: string,
  entityType: string,
  entityId: string,
  kind: string,
  buffer: Buffer,
): Promise<{ url?: string; error?: string }> {
  const path = `${orgId}/${folder}/${entityId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) return { error: "upload_failed" };

  await supabase.from("documents").insert({
    org_id: orgId,
    entity_type: entityType,
    entity_id: entityId,
    kind,
    path,
    uploaded_by: userId,
  });

  const { data: signed } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
  return { url: signed?.signedUrl };
}