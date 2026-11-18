"use client";

import { useFormState } from "react-dom";
import { createApiKeyAction, type ApiKeyState } from "@/server/actions/api-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ApiKeyState = {};

export function ApiKeyCreateForm() {
  const [state, action] = useFormState(createApiKeyAction, initial);
  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-col gap-4 max-w-md">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
        </div>
        <div>
          <Label htmlFor="role">Role scope</Label>
          <select id="role" name="role" className="border rounded px-2 py-1" defaultValue="owner">
            <option value="owner">owner</option>
            <option value="org_admin">org_admin</option>
            <option value="manager">manager</option>
            <option value="accountant">accountant</option>
          </select>
        </div>
        <div>
          <Label htmlFor="ownerId">Owner ID (for owner keys)</Label>
          <Input id="ownerId" name="ownerId" />
        </div>
        <Button type="submit">Create</Button>
      </form>
      {state.key && (
        <div className="p-3 bg-yellow-50 border rounded">
          <p className="font-semibold">Copy this key now (shown once):</p>
          <code className="break-all">{state.key}</code>
        </div>
      )}
      {state.error && <p className="text-red-600">{state.error}</p>}
      {state.ok && !state.key && <p className="text-green-600">{state.ok}</p>}
    </div>
  );
}
