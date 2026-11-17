import { z } from "zod";

export const buildingSchema = z.object({
  code: z.string().trim().min(1, "validation.required").max(40, "validation.tooLong"),
  name: z.string().trim().min(1, "validation.required").max(120, "validation.tooLong"),
  ownerId: z.string().uuid("validation.invalidUuid"),
  city: z.string().trim().max(80, "validation.tooLong").optional(),
});

export const floorsSchema = z.object({
  buildingId: z.string().uuid("validation.invalidUuid"),
  from: z.coerce.number().int("validation.invalidInput").min(-5, "validation.invalidRange").max(150, "validation.invalidRange"),
  to: z.coerce.number().int("validation.invalidInput").min(-5, "validation.invalidRange").max(199, "validation.invalidRange"),
});

export const unitsSchema = z.object({
  floorId: z.string().uuid("validation.invalidUuid"),
  prefix: z.string().trim().max(10, "validation.tooLong").optional(),
  start: z.coerce.number().int("validation.invalidInput").min(0, "validation.invalidRange").default(1),
  count: z.coerce.number().int("validation.invalidInput").min(1, "validation.invalidRange").max(500, "validation.invalidRange").default(1),
  pad: z.coerce.number().int("validation.invalidInput").min(1, "validation.invalidRange").max(5, "validation.invalidRange").default(2),
  unitType: z.string().trim().max(30, "validation.tooLong").optional(),
  // shortcut: empty string means "no area"; the action already maps "" to undefined.
  areaSqm: z.coerce.number().positive("validation.invalidRange").optional().or(z.literal("")),
  rent: z.string().trim().optional(),
});
