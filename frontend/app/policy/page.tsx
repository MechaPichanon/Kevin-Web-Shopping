"use client";

import { useEffect, useState } from "react";

type Policy = {
  policy_type: "SHIPPING" | "RETURN" | "PAYMENT" | string;
  content_en: string;
  content_th: string;
  updated_at: string;
};

const POLICY_LABELS: Record<string, { th: string; en: string }> = {
  SHIPPING: { th: "การจัดส่ง", en: "Shipping" },
  RETURN: { th: "การคืนสินค้า", en: "Returns & Exchanges" },
  PAYMENT: { th: "การชำระเงิน", en: "Payment" },
};

export default function PolicyPage() {
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000/policies")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setPolicies(data);
        }
      })
      .catch(() => setError("ไม่สามารถโหลดข้อมูลได้"));
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
        <p className="text-muted-foreground">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold text-foreground">นโยบายร้าน</h1>
            <p className="mt-2 text-muted-foreground">Store Policies</p>
          </div>

          {policies.length === 0 ? (
            <p className="text-muted-foreground">ไม่พบข้อมูลนโยบาย</p>
          ) : (
            <div className="space-y-6">
              {policies.map((p) => {
                const label = POLICY_LABELS[p.policy_type] ?? { th: p.policy_type, en: p.policy_type };
                return (
                  <section
                    key={p.policy_type}
                    className="rounded-xl border border-border bg-card p-6"
                  >
                    <h2 className="font-serif text-lg font-semibold text-foreground">{label.th}</h2>
                    <p className="text-sm text-muted-foreground">{label.en}</p>
                    <p className="mt-4 whitespace-pre-line text-sm text-foreground">
                      {p.content_th}
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
