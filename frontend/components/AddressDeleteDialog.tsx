"use client"

// Confirm-before-delete for a saved address (profile address book + checkout chips).
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useLang } from "@/lib/language-context"
import { type Address, deleteAddress, formatFullAddress } from "@/lib/addresses"

type Props = {
  target: Address | null
  onClose: () => void
  onDeleted: (id: number) => void
}

export default function AddressDeleteDialog({ target, onClose, onDeleted }: Props) {
  const { t } = useLang()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  const handleDelete = async () => {
    if (!target) return
    setDeleting(true)
    setError("")
    try {
      await deleteAddress(target.id)
      onDeleted(target.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("address.deleteFailed"))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open && !deleting) { setError(""); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("address.deleteTitle")}</DialogTitle>
          <DialogDescription>{t("address.deleteHint")}</DialogDescription>
        </DialogHeader>
        {target && (
          <div className="rounded-[10px] border border-border bg-[#faf7f2] p-3 font-plex-thai text-sm leading-relaxed">
            <div className="font-medium">{target.recipientName}</div>
            <div>{formatFullAddress(target, t)}</div>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleting}>{t("common.cancel")}</Button>
          <Button onClick={handleDelete} disabled={deleting} className="bg-[#a2472f] text-white hover:bg-[#8a3b27]">
            {deleting ? t("address.deleting") : t("address.deleteConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
