"use client"

// Add / edit address form — Claude Design "Profile Addresses". Used inline on
// the profile address book and inside a Dialog on checkout.
import { useState } from "react"
import { useLang } from "@/lib/language-context"
import { en, type TranslationKey } from "@/lib/i18n/dictionaries"
import {
  type AddressErrors,
  type AddressInput,
  formatPhone,
  validateAddress,
} from "@/lib/addresses"
import { THAI_PROVINCES } from "@/lib/thaiProvinces"
import { RequiredMark } from "@/components/ui/required-mark"

type Props = {
  mode: "new" | "edit"
  initial: AddressInput
  /** Editing the current default: the checkbox stays checked + disabled (a default is only moved, never cleared). */
  lockDefault?: boolean
  /** Card chrome (white card + shadow). Off inside a Dialog, which is already a card. */
  framed?: boolean
  onSubmit: (input: AddressInput) => Promise<void>
  onCancel: () => void
}

const inputBase =
  "h-12 w-full rounded-[10px] border bg-[#faf7f2] px-3.5 text-[15px] text-foreground outline-none transition-shadow focus:border-primary focus:shadow-[0_0_0_3px_rgba(139,94,60,.15)]"

export default function AddressForm({ mode, initial, lockDefault = false, framed = true, onSubmit, onCancel }: Props) {
  const { t, lang } = useLang()
  const [f, setF] = useState<AddressInput>({ ...initial, phone: formatPhone(initial.phone) })
  const [err, setErr] = useState<AddressErrors>({})
  const [submitError, setSubmitError] = useState("")
  const [saving, setSaving] = useState(false)

  // Small italic English accent under/after Thai labels (design), TH view only.
  const accent = (key: TranslationKey) =>
    lang === "th" ? <span className="font-fraunces text-xs italic text-muted-foreground">{en[key]}</span> : null

  const set = (k: keyof AddressInput, v: string) => {
    if (k === "phone") v = formatPhone(v)
    if (k === "postalCode") v = v.replace(/\D/g, "").slice(0, 5)
    setF((prev) => ({ ...prev, [k]: v }))
    setErr((prev) => ({ ...prev, [k]: "" }))
  }

  const border = (k: keyof AddressInput) => (err[k] ? "border-[#c0765e]" : "border-border")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Stops the checkout page's outer <form> from also submitting (the dialog
    // is portalled, but React synthetic events still bubble through the tree).
    e.stopPropagation()
    const v = validateAddress(f, t)
    if (Object.keys(v).length) { setErr(v); return }
    setSaving(true)
    setSubmitError("")
    try {
      await onSubmit({ ...f, phone: f.phone.replace(/\D/g, ""), isDefault: lockDefault || f.isDefault })
    } catch (e) {
      setSubmitError(e instanceof Error && e.message ? e.message : t("address.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const field = (
    k: keyof AddressInput,
    labelKey: TranslationKey,
    required: boolean,
    input: React.ReactNode,
  ) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {t(labelKey)} {accent(labelKey)} {required && <RequiredMark />}
      </span>
      {input}
      {err[k] && <span className="text-xs text-[#a2472f]">{err[k]}</span>}
    </label>
  )

  // Keep an existing province selectable even if it isn't in the list
  // (addresses saved before the <select> existed were free text).
  const provinces: string[] =
    f.province && !(THAI_PROVINCES as readonly string[]).includes(f.province)
      ? [f.province, ...THAI_PROVINCES]
      : [...THAI_PROVINCES]

  const titleKey = mode === "new" ? "address.newTitle" : "address.editTitle"

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`flex flex-col gap-5 ${framed ? "rounded-[14px] border border-black/10 bg-card p-7 shadow-[0_10px_30px_-12px_rgba(61,48,37,.18)]" : ""}`}
    >
      <div>
        <div className="font-serif text-xl font-semibold">{t(titleKey)}</div>
        {lang === "th" && <div className="font-fraunces text-sm italic text-muted-foreground">{en[titleKey]}</div>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {field("recipientName", "address.fullName", true,
          <input value={f.recipientName} onChange={(e) => set("recipientName", e.target.value)}
            placeholder={t("address.fullNamePlaceholder")} className={`${inputBase} ${border("recipientName")}`} />)}
        {field("phone", "address.phone", true,
          <input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel"
            placeholder="081-234-5678" className={`${inputBase} ${border("phone")} font-mono`} />)}
      </div>

      {field("addressLine1", "address.line1", true,
        <input value={f.addressLine1} onChange={(e) => set("addressLine1", e.target.value)}
          placeholder={t("address.line1Placeholder")} className={`${inputBase} ${border("addressLine1")} h-[52px]`} />)}

      {field("addressLine2", "address.line2", false,
        <input value={f.addressLine2} onChange={(e) => set("addressLine2", e.target.value)}
          placeholder={t("address.line2Placeholder")} className={`${inputBase} border-border h-[52px]`} />)}

      <div className={`grid gap-4 sm:grid-cols-2 ${framed ? "lg:grid-cols-4" : ""}`}>
        {field("province", "address.province", true,
          <select value={f.province} onChange={(e) => set("province", e.target.value)}
            className={`${inputBase} ${border("province")}`}>
            <option value="">{t("address.selectProvince")}</option>
            {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>)}
        {field("district", "address.district", true,
          <input value={f.district} onChange={(e) => set("district", e.target.value)}
            placeholder={t("address.districtPlaceholder")} className={`${inputBase} ${border("district")}`} />)}
        {field("subDistrict", "address.subDistrict", true,
          <input value={f.subDistrict} onChange={(e) => set("subDistrict", e.target.value)}
            placeholder={t("address.subDistrictPlaceholder")} className={`${inputBase} ${border("subDistrict")}`} />)}
        {field("postalCode", "address.postalCode", true,
          <input value={f.postalCode} onChange={(e) => set("postalCode", e.target.value)} inputMode="numeric"
            maxLength={5} placeholder="10110" className={`${inputBase} ${border("postalCode")} font-mono tracking-[2px]`} />)}
      </div>

      <label className={`flex items-center gap-2.5 text-sm ${lockDefault ? "cursor-default" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          checked={lockDefault || f.isDefault}
          disabled={lockDefault}
          onChange={() => setF((prev) => ({ ...prev, isDefault: !prev.isDefault }))}
          className="h-[18px] w-[18px] accent-primary"
        />
        {t("address.setDefault")} {accent("address.setDefault")}
        {lockDefault && mode === "edit" && <span className="text-xs text-muted-foreground">({t("address.alreadyDefault")})</span>}
      </label>

      {submitError && <p className="text-sm text-[#a2472f]">{submitError}</p>}

      <div className="flex flex-wrap justify-end gap-3 border-t border-[#ece2d6] pt-4">
        <button type="button" onClick={onCancel} disabled={saving}
          className="h-12 rounded-[10px] border border-border bg-card px-5 text-[15px] text-foreground">
          {t("common.cancel")}
        </button>
        <button type="submit" disabled={saving}
          className="h-12 rounded-[10px] bg-primary px-7 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-[#744d30] disabled:opacity-60">
          {saving ? t("address.saving") : t("address.save")}
          {!saving && lang === "th" && <span className="ml-1 font-fraunces font-normal italic opacity-85">Save</span>}
        </button>
      </div>
    </form>
  )
}
