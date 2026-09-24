"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/language-context";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { API_BASE } from "@/lib/api";

type Policy = {
  policy_type: "SHIPPING" | "RETURN" | "PAYMENT" | string;
  content_en: string;
  content_th: string;
  updated_at: string;
};

const POLICY_LABEL_KEYS: Record<string, TranslationKey> = {
  SHIPPING: "policy.label.SHIPPING",
  RETURN: "policy.label.RETURN",
  PAYMENT: "policy.label.PAYMENT",
};

export default function PolicyPage() {
  const { t, pick } = useLang();
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/policies`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setPolicies(data);
        }
      })
      .catch(() => setError(t("policy.loadError")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!policies) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("policy.loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold text-foreground">{t("policy.title")}</h1>
            <p className="mt-2 text-muted-foreground">{t("policy.subtitle")}</p>
          </div>

          {policies.length === 0 ? (
            <p className="text-muted-foreground">{t("policy.none")}</p>
          ) : (
            <div className="space-y-6">
              {policies.map((p) => {
                const labelKey = POLICY_LABEL_KEYS[p.policy_type];
                return (
                  <section
                    key={p.policy_type}
                    className="rounded-xl border border-border bg-card p-6"
                  >
                    <h2 className="font-serif text-lg font-semibold text-foreground">
                      {labelKey ? t(labelKey) : p.policy_type}
                    </h2>
                    <p className="mt-4 whitespace-pre-line text-sm text-foreground">
                      {pick(p.content_th, p.content_en)}
                    </p>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
