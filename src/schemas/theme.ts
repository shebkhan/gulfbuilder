import { z } from "zod";

export const themePresetSchema = z.object({
  code: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(80),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontFamily: z.string().min(1).max(80).regex(/^[A-Za-z0-9 ,'\-]+$/),
  isDefault: z.coerce.boolean(),
});

export type ThemePresetInput = z.infer<typeof themePresetSchema>;
