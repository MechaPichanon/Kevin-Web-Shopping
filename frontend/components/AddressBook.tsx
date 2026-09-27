"use client"

// Profile "สมุดที่อยู่" section — Claude Design "Profile Addresses".
import { useEffect, useState } from "react"
import { useLang } from "@/lib/language-context"
import { en } from "@/lib/i18n/dictionaries"
import {
  type Address,
  type AddressInput,
  createAddress,
  emptyAddressInput,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from "@/lib/addresses"
import AddressForm from "@/components/AddressForm"
import AddressCard from "@/components/AddressCard"
import AddressDeleteDialog from "@/components/AddressDeleteDialog"

export default function AddressBook() {
  const { t, lang } = useLang()
  const [items, setItems] = useState<Address[] | null>(null)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<"new" | Address | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const reload = async () => {
    try {
      setItems(await listAddresses())
      setError("")
    } catch {
      setError(t("address.loadError"))
      setItems((prev) => prev ?? [])
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async (input: AddressInput) => {
    if (editing === "new") await createAddress(input)
    else if (editing) await updateAddress(editing.id, input)
    setEditing(null)
    await reload()
  }

  const handleMakeDefault = async (a: Address) => {
    setBusyId(a.id)
    try {
      await setDefaultAddress(a.id)
      await reload()
    } catch {
      setError(t("address.saveFailed"))
    } finally {
      setBusyId(null)
    }
  }

  if (items === null) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-xs uppercase tracking-[1.5px] text-accent">
          {t("address.count", { n: items.length })}
        </div>
        {editing === null && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="h-11 rounded-[10px] bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[#744d30]"
          >
            {t("address.add")}
            {lang === "th" && <span className="ml-1 font-fraunces font-normal italic opacity-85">Add</span>}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {editing !== null && (
        <AddressForm
          key={editing === "new" ? "new" : editing.id}
          mode={editing === "new" ? "new" : "edit"}
          initial={editing === "new" ? { ...emptyAddressInput, isDefault: items.length === 0 } : editing}
          lockDefault={editing === "new" ? items.length === 0 : editing.isDefault}
          onSubmit={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {items.length === 0 && editing === null && (
        <div className="rounded-[14px] border border-dashed border-[#c8b8a6] bg-card px-6 py-12 text-center">
          <div className="font-serif text-xl font-semibold">{t("address.empty")}</div>
          {lang === "th" && <div className="mt-1 font-fraunces text-sm italic text-muted-foreground">{en["address.empty"]}</div>}
        </div>
      )}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
        {items.map((a) => (
          <AddressCard
            key={a.id}
            address={a}
            busy={busyId === a.id}
            onEdit={() => setEditing(a)}
            onDelete={() => setDeleteTarget(a)}
            onMakeDefault={() => handleMakeDefault(a)}
          />
        ))}
      </div>

      <AddressDeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(id) => {
          if (editing !== null && editing !== "new" && editing.id === id) setEditing(null)
          reload()
        }}
      />
    </div>
  )
}
