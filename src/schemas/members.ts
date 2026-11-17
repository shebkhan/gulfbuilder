import { z } from "zod";

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("validation.invalidEmail"),
  role: z.enum(["manager", "accountant", "caretaker", "owner", "tenant"], {
    message: "validation.required",
  }),
  locale: z.enum(["en", "ar"], { message: "validation.required" }),
});
