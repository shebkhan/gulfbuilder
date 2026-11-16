"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  next: string;
  labels: {
    title: string;
    subtitle: string;
    enroll: string;
    scan: string;
    secret: string;
    code: string;
    verify: string;
    pending: string;
    failed: string;
  };
};

type Step = "loading" | "enroll" | "verify";

export function MfaForm({ next, labels }: Props) {
  const [step, setStep] = useState<Step>("loading");
  const [factorId, setFactorId] = useState<string>();
  const [qr, setQr] = useState<string>();
  const [secret, setSecret] = useState<string>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp.find((factor) => factor.status === "verified");
      setFactorId(verified?.id);
      setStep(verified ? "verify" : "enroll");
    })();
  }, []);

  async function enroll() {
    setPending(true);
    setError(undefined);
    const supabase = createSupabaseBrowserClient();
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setPending(false);
    if (enrollError || !data) {
      setError(labels.failed);
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setStep("verify");
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId) return;
    setPending(true);
    setError(undefined);

    const supabase = createSupabaseBrowserClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    setPending(false);

    if (verifyError) {
      setError(labels.failed);
      return;
    }
    // A full navigation, not the client router: the server has to read the new aal2 cookie.
    window.location.assign(next);
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-md text-headline-md text-on-surface">{labels.title}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{labels.subtitle}</p>
      </div>

      {step === "loading" ? <p className="font-body-sm text-body-sm">{labels.pending}</p> : null}

      {step === "enroll" ? (
        <Button type="button" size="lg" onClick={enroll} disabled={pending}>
          {pending ? labels.pending : labels.enroll}
        </Button>
      ) : null}

      {step === "verify" ? (
        <form onSubmit={verify} className="flex flex-col gap-4">
          {qr ? (
            <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-container-low p-4">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                {labels.scan}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="" className="size-40 self-center rounded-lg bg-white" />
              {secret ? (
                <p className="tabular break-all text-center font-body-sm text-body-sm text-on-surface-variant">
                  {labels.secret}: {secret}
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <Label htmlFor="code">{labels.code}</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" disabled={pending || code.length !== 6}>
            {pending ? labels.pending : labels.verify}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
