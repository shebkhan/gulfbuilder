import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Values = {
  city?: string | null;
  type?: string | null;
  bedrooms?: string | number | null;
  min?: string;
  max?: string;
  q?: string | null;
};

export function ListingSearch({
  locale,
  cities,
  labels,
  values = {},
}: {
  locale: string;
  cities: string[];
  labels: Record<string, string>;
  values?: Values;
}) {
  const field = "font-body-sm text-body-sm text-on-surface bg-surface-container-lowest rounded-xl border border-hairline px-3 py-2";

  return (
    <form action={`/${locale}/properties`} method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <Label htmlFor="q">{labels.keywords}</Label>
        <Input id="q" name="q" defaultValue={values.q ?? ""} className={field} />
      </div>
      <div>
        <Label htmlFor="city">{labels.city}</Label>
        <select id="city" name="city" defaultValue={values.city ?? ""} className={field}>
          <option value="">{labels.all}</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="type">{labels.type}</Label>
        <select id="type" name="type" defaultValue={values.type ?? ""} className={field}>
          <option value="">{labels.all}</option>
          {["studio", "1br", "2br", "3br", "office", "shop"].map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="bedrooms">{labels.bedrooms}</Label>
        <Input
          id="bedrooms"
          name="bedrooms"
          type="number"
          min={0}
          max={10}
          defaultValue={values.bedrooms ?? ""}
          className={field}
        />
      </div>
      <div>
        <Label htmlFor="min">{labels.min}</Label>
        <Input
          id="min"
          name="min"
          inputMode="decimal"
          defaultValue={values.min ?? ""}
          className={field}
          dir="ltr"
        />
      </div>
      <div>
        <Label htmlFor="max">{labels.max}</Label>
        <Input
          id="max"
          name="max"
          inputMode="decimal"
          defaultValue={values.max ?? ""}
          className={field}
          dir="ltr"
        />
      </div>
      <Button type="submit" className="self-end sm:col-span-2 lg:col-span-3">
        {labels.search}
      </Button>
    </form>
  );
}
