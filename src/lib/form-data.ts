// shortcut: flat values only; arrays and objects are stringified, add explicit encoding if a structured field is ever submitted.
export function toFormData(values: Record<string, unknown>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    fd.append(key, value instanceof File ? value : String(value));
  }
  return fd;
}
