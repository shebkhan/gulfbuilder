"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  generateFloorsAction,
  generateUnitsAction,
  type PropertyState,
} from "@/server/actions/property";

const selectClass =
  "h-11 w-full rounded-xl bg-surface-container-lowest px-3.5 font-body-md text-body-md text-on-surface shadow-sm outline-none transition-shadow focus:bg-surface-container-low focus:ring-[3px] focus:ring-primary-fixed";

type Labels = {
  bulkFloors: string;
  bulkUnits: string;
  from: string;
  to: string;
  prefix: string;
  start: string;
  count: string;
  pad: string;
  floor: string;
  type: string;
  area: string;
  rent: string;
  generate: string;
  generating: string;
  result: string;
  errors: Record<string, string>;
};

function Result({ state, labels }: { state: PropertyState; labels: Labels }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container">
        {labels.errors[state.error] ?? labels.errors.failed}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container">
        {labels.result.replace("{count}", state.ok)}
      </p>
    );
  }
  return null;
}

export function FloorsForm({
  buildingId,
  labels,
}: {
  buildingId: string;
  labels: Labels;
}) {
  const [state, formAction, pending] = useActionState<PropertyState, FormData>(
    generateFloorsAction,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.bulkFloors}</CardTitle>
      </CardHeader>
      <CardBody>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="buildingId" value={buildingId} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="from">{labels.from}</Label>
              <Input id="from" name="from" type="number" defaultValue={0} required />
            </div>
            <div>
              <Label htmlFor="to">{labels.to}</Label>
              <Input id="to" name="to" type="number" defaultValue={4} required />
            </div>
          </div>
          <Result state={state} labels={labels} />
          <Button type="submit" disabled={pending} className="self-start" variant="secondary">
            {pending ? labels.generating : labels.generate}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export function UnitsForm({
  floors,
  labels,
}: {
  floors: { id: string; level: number; label: string | null }[];
  labels: Labels;
}) {
  const [state, formAction, pending] = useActionState<PropertyState, FormData>(
    generateUnitsAction,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.bulkUnits}</CardTitle>
      </CardHeader>
      <CardBody>
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="floorId">{labels.floor}</Label>
            <select id="floorId" name="floorId" className={selectClass} required>
              {floors.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  {floor.label ?? floor.level}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prefix">{labels.prefix}</Label>
              <Input id="prefix" name="prefix" dir="ltr" maxLength={10} />
            </div>
            <div>
              <Label htmlFor="count">{labels.count}</Label>
              <Input id="count" name="count" type="number" defaultValue={4} min={1} max={500} required />
            </div>
            <div>
              <Label htmlFor="start">{labels.start}</Label>
              <Input id="start" name="start" type="number" defaultValue={1} min={0} required />
            </div>
            <div>
              <Label htmlFor="pad">{labels.pad}</Label>
              <Input id="pad" name="pad" type="number" defaultValue={2} min={1} max={5} required />
            </div>
            <div>
              <Label htmlFor="unitType">{labels.type}</Label>
              <Input id="unitType" name="unitType" dir="ltr" maxLength={30} />
            </div>
            <div>
              <Label htmlFor="areaSqm">{labels.area}</Label>
              <Input id="areaSqm" name="areaSqm" type="number" step="0.01" min={1} />
            </div>
          </div>
          <div>
            <Label htmlFor="rent">{labels.rent}</Label>
            <Input id="rent" name="rent" inputMode="decimal" dir="ltr" />
          </div>
          <Result state={state} labels={labels} />
          <Button type="submit" disabled={pending} className="self-start" variant="secondary">
            {pending ? labels.generating : labels.generate}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
