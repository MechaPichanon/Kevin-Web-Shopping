"use client"

// Saved-address card — Claude Design "Profile Addresses" (profile address book).
import { useLang } from "@/lib/language-context"
import { type Address, formatFullAddress, formatPhone } from "@/lib/addresses"

type Props = {
  address: Address
  onEdit: () => void
  onDelete: () => void
  onMakeDefault: () => void
  busy?: boolean
}

export default function AddressCard({ address: a, onEdit, onDelete, onMakeDefault, busy = false }: Props) {
  const { t } = useLang()

  return (
    <div
      className={`flex flex-col gap-3 rounded-[14px] border bg-card p-[22px] shadow-[0_10px_30px_-12px_rgba(61,48,37,.18)] ${
        a.isDefault ? "border-primary" : "border-black/10"
      }`}
    >
      {a.isDefault && (
        <div className="flex">
          <span className="rounded-full bg-primary px-2.5 py-1 font-mono text-[10px] tracking-[1.5px] text-primary-foreground">
            {t("address.defaultBadge")}
          </span>
        </div>
      )}
      <div className="flex-1 font-plex-thai text-[15px] leading-[1.7]">
        <div className="font-medium">
          {a.recipientName}
          <span className="ml-1.5 font-mono text-[13px] font-normal text-accent">{formatPhone(a.phone)}</span>
        </div>
        <div className="text-foreground">{formatFullAddress(a, t)}</div>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-[#ece2d6] pt-3 text-sm">
        <button type="button" onClick={onEdit} disabled={busy} className="font-medium text-primary hover:underline">
          {t("address.edit")}
        </button>
        <button type="button" onClick={onDelete} disabled={busy} className="text-muted-foreground hover:text-foreground">
          {t("address.delete")}
        </button>
        {!a.isDefault && (
          <button
            type="button"
            onClick={onMakeDefault}
            disabled={busy}
            className="ml-auto rounded-full border border-border bg-[#faf7f2] px-3.5 py-1.5 text-[13px] text-foreground hover:border-primary"
          >
            {t("address.makeDefault")}
          </button>
        )}
      </div>
    </div>
  )
}
