"use client"

import Link from "next/link"
import { ArrowRight, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import ProductCard from "@/components/productcard"
import { useWishlist } from "@/lib/wishlist-context"
import { useLang } from "@/lib/language-context"

export default function WishlistPage() {
    const { items } = useWishlist()
    const { t } = useLang()

    return (
        <div className="flex min-h-screen flex-col">
            <main className="flex-1">
                <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <span className="text-sm font-medium uppercase tracking-wider text-primary">{t("wishlist.eyebrow")}</span>
                            <h1 className="mt-2 font-serif text-3xl font-bold text-foreground sm:text-4xl">{t("wishlist.title")}</h1>
                            <p className="mt-2 text-muted-foreground">{t("wishlist.subtitle")} {items.length > 0 && t("wishlist.itemsCount", { n: items.length })}</p>
                        </div>
                        {items.length > 0 && <Button asChild variant="outline"><Link href="/products">{t("wishlist.browseMore")}</Link></Button>}
                    </div>

                    {items.length === 0 ? (
                        <div className="mt-16 flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-20 text-center">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"><Heart className="h-9 w-9 text-primary" /></div>
                            <h2 className="font-serif text-2xl font-bold text-foreground">{t("wishlist.emptyTitle")}</h2>
                            <p className="max-w-md text-muted-foreground">{t("wishlist.emptyHint")}</p>
                            <Button asChild className="mt-2 gap-2"><Link href="/products">{t("wishlist.startShopping")} <ArrowRight className="h-4 w-4" /></Link></Button>
                        </div>
                    ) : (
                        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
                            {items.map((item) => (
                                <ProductCard
                                    key={item.id}
                                    product={{
                                        id: Number(item.id),
                                        product_id: item.id,
                                        name: item.name,
                                        price: item.price,
                                        image: item.image,
                                        category: item.category,
                                        stock: 1,
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}