"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listingEnquirySchema } from "@/schemas/marketplace";

export type EnquiryState = {
  error?: "invalid_input" | "submit_failed";
  ok?: boolean;
};

export async function submitListingEnquiryAction(
  _prev: EnquiryState,
  formData: FormData,
): Promise<EnquiryState> {
  const parsed = listingEnquirySchema.safeParse({
    orgId: formData.get("orgId"),
    unitId: formData.get("unitId"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    message: formData.get("message"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("listing_enquiries").insert({
    org_id: parsed.data.orgId,
    unit_id: parsed.data.unitId,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    message: parsed.data.message,
  });
  if (error) return { error: "submit_failed" };

  revalidatePath("/listings/enquiries");
  return { ok: true };
}
