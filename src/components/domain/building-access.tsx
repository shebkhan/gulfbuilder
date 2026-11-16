"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  grantBuildingAccessAction,
  revokeBuildingAccessAction,
  type PropertyState,
} from "@/server/actions/property";
import { Label } from "@/components/ui/label";

const selectClass =
  "h-11 w-full rounded-xl bg-surface-container-lowest px-3.5 font-body-md text-body-md text-on-surface shadow-sm outline-none transition-shadow focus:bg-surface-container-low focus:ring-[3px] focus:ring-primary-fixed";

type Props = {
  buildingId: string;
  staff: { id: string; name: string }[];
  access: { userId: string; name: string }[];
  labels: {
    staff: string;
    grant: string;
    revoke: string;
    noStaff: string;
    errors: Record<string, string>;
  };
};

export function BuildingAccess({
  buildingId,
  staff,
  access,
  labels,
}: Props) {
  const [state, formAction, pending] = useActionState<PropertyState, FormData>(
    grantBuildingAccessAction,
    {},
  );
  const assigned = new Set(access.map((entry) => entry.userId));
  const available = staff.filter((member) => !assigned.has(member.id));

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-2">
        {access.length === 0 ? (
          <li className="font-body-sm text-body-sm text-on-surface-variant">{labels.noStaff}</li>
        ) : (
          access.map((entry) => (
            <li
              key={entry.userId}
              className="flex items-center gap-2 rounded-full border border-hairline bg-surface-container-low py-1 pe-1 ps-3 font-label-md text-label-md"
            >
              {entry.name}
              <form action={revokeBuildingAccessAction}>
                <input type="hidden" name="buildingId" value={buildingId} />
                <input type="hidden" name="userId" value={entry.userId} />
                <button
                  type="submit"
                  aria-label={`${labels.revoke} ${entry.name}`}
                  className="rounded-full px-2 py-1 font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                >
                  ×
                </button>
              </form>
            </li>
          ))
        )}
      </ul>

      {available.length > 0 ? (
        <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="buildingId" value={buildingId} />
          <div className="flex-1">
            <Label htmlFor="userId">{labels.staff}</Label>
            <select id="userId" name="userId" className={selectClass} required>
              {available.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="secondary" disabled={pending}>
            {labels.grant}
          </Button>
        </form>
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {labels.errors[state.error] ?? labels.errors.failed}
        </p>
      ) : null}
    </div>
  );
}
