"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useCart } from "@/lib/cart-context"
import { colorToHex } from "@/lib/color-map"
type CartItem = {
    cart_item_id: number;
    quantity: number;

    product_name: string;

    variant_id: string;
    price: number;
    size: string;
    color: string;
    color_th: string | null;
    stock: number;

    image_url: string | null;
};

export default function CartPage() {
    const [items, setItems] = useState<CartItem[]>([]);

    const loadCart = async () => {
        try {
            const userStr = localStorage.getItem("user");
            if (!userStr) return;

            const user = JSON.parse(userStr);
            if (!user.id) return;

            const res = await fetch(
                `http://localhost:5000/cart/${user.id}`
            );

            if (!res.ok) {
                console.error("Cart fetch error:", res.status);
                return;
            }

            const data = await res.json();
            setItems(data || []);
        } catch (err) {
            console.error("Load cart error:", err);
        }

    };
    useEffect(() => {
        loadCart();
    }, []);
    const removeItem = async (
        cart_item_id: number
    ) => {
        try {
            const res = await fetch(
                `http://localhost:5000/cart/${cart_item_id}`,
                {
                    method: "DELETE",
                }
            )

            if (res.ok) {
                loadCart()
                window.dispatchEvent(new Event("cartUpdated"))
            }
        } catch (err) {
            console.error(err)
        }
    }
    const updateQuantity = async (
        cart_item_id: number,
        quantity: number
    ) => {
        await fetch(
            `http://localhost:5000/cart/${cart_item_id}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ quantity }),
            }
        );

        loadCart();
        window.dispatchEvent(new Event("cartUpdated"));
    };

    const totalPrice = items.reduce(
        (sum, item) =>
            sum + Number(item.price) * item.quantity,
        0
    );

    const shippingFee =
        totalPrice >= 1500 || totalPrice === 0
            ? 0
            : 50;

    const grandTotal =
        totalPrice + shippingFee;

    const formatPrice = (price: number) =>
        new Intl.NumberFormat("th-TH", {
            style: "currency",
            currency: "THB",
            minimumFractionDigits: 0,
        }).format(price);

    return (
        <div className="min-h-screen bg-[#b89f8d] p-8">
            <h1 className="mb-2 text-3xl font-bold">
                ตะกร้าสินค้า
            </h1>

            <p className="mb-6">
                {items.length} รายการ
            </p>

            {items.length === 0 ? (
                <div>
                    ไม่มีสินค้าในตะกร้า

                    <Link
                        href="/products"
                        className="ml-4 text-blue-500"
                    >
                        เลือกซื้อสินค้า
                    </Link>
                </div>
            ) : (
                <div className="grid gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-4">
                        {items.map((item) => (
                            <div
                                key={item.cart_item_id}
                                className="grid grid-cols-[104px_1fr_auto] gap-4 rounded-2xl bg-[#fbf8f5] p-4 shadow-[0_6px_18px_rgba(91,58,41,0.10)]"
                            >
                                <img
                                    src={
                                        item.image_url ||
                                        "https://placehold.co/300x400"
                                    }
                                    className="h-32 w-[104px] rounded-[11px] object-cover"
                                />

                                <div className="flex min-w-0 flex-col">
                                    <h3 className="font-semibold leading-tight text-[#5b3a29]">
                                        {item.product_name}
                                    </h3>

                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e4d6c8] bg-[#f0e7de] px-2.5 py-1 text-xs text-[#6B4A38]">
                                            <span
                                                className="h-3 w-3 flex-none rounded-full border border-[#5b3a29]/25"
                                                style={{ background: colorToHex(item.color_th || item.color) }}
                                            />
                                            <span>
                                                สี / Color:{" "}
                                                <span className="font-medium text-[#5b3a29]">
                                                    {item.color_th || item.color}
                                                </span>
                                            </span>
                                        </span>
                                        <span className="rounded-full border border-[#e4d6c8] bg-[#f0e7de] px-2.5 py-1 text-xs text-[#6B4A38]">
                                            ไซซ์ / Size:{" "}
                                            <span className="font-semibold text-[#5b3a29]">
                                                {item.size}
                                            </span>
                                        </span>
                                    </div>

                                    <div className="mt-auto flex items-center gap-3 pt-3.5">
                                        <div className="inline-flex items-center overflow-hidden rounded-[11px] border border-[#d9c7b6] bg-white">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-none text-[#8b5e3c] hover:bg-transparent hover:text-[#8b5e3c]"
                                                onClick={() => updateQuantity(item.cart_item_id,
                                                    item.quantity - 1)}
                                            >
                                                <Minus className="h-3 w-3" />
                                            </Button>
                                            <span className="w-8 text-center text-sm font-semibold text-[#5b3a29]">{item.quantity}</span>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-none text-[#8b5e3c] hover:bg-transparent hover:text-[#8b5e3c] disabled:opacity-40"
                                                disabled={item.quantity >= item.stock}
                                                onClick={() => updateQuantity(item.cart_item_id,
                                                    Math.min(item.stock, item.quantity + 1))}
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 gap-1.5 px-2 text-[#a1836d] hover:bg-transparent hover:text-[#b23b3b]"
                                            onClick={() => removeItem(item.cart_item_id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            <span className="text-xs">ลบ / Remove</span>
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end justify-between text-right">
                                    <div>
                                        <div className="text-lg font-bold text-[#5b3a29]">
                                            {formatPrice(
                                                Number(item.price) * item.quantity
                                            )}
                                        </div>
                                        <div className="mt-0.5 text-xs text-[#9a8571]">
                                            {formatPrice(Number(item.price))} / ชิ้น
                                        </div>
                                    </div>

                                    {item.stock <= 3 && (
                                        <span className="rounded-md bg-[#f6e7dc] px-2 py-1 text-[11px] font-medium text-[#a8552f]">
                                            เหลือ {item.stock} ชิ้น
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}

                        <Link
                            href="/products"
                            className="inline-flex items-center gap-2 pt-1 text-sm font-medium text-[#6B4A38] hover:text-[#5b3a29]"
                        >
                            <ArrowRight className="h-4 w-4 rotate-180" />
                            เลือกซื้อสินค้าต่อ / Continue shopping
                        </Link>
                    </div>

                    <div className="sticky top-24 h-fit rounded-[18px] bg-[#fbf8f5] p-6 shadow-[0_10px_30px_rgba(91,58,41,0.14)]">
                        <h2 className="mb-4 text-lg font-bold text-[#5b3a29]">
                            สรุปคำสั่งซื้อ / Order Summary
                        </h2>

                        <div className="flex flex-col gap-[11px] text-sm">
                            <div className="flex justify-between text-[#6B4A38]">
                                <span>ยอดรวมสินค้า / Subtotal</span>
                                <span className="font-semibold text-[#5b3a29]">
                                    {formatPrice(totalPrice)}
                                </span>
                            </div>

                            <div className="flex justify-between text-[#6B4A38]">
                                <span>ค่าจัดส่ง / Shipping</span>
                                <span className="font-semibold text-[#5b3a29]">
                                    {shippingFee === 0
                                        ? "ฟรี / Free"
                                        : formatPrice(shippingFee)}
                                </span>
                            </div>
                        </div>

                        <hr className="my-4 border-[#e4d6c8]" />

                        <div className="mb-5 flex items-baseline justify-between">
                            <span className="text-[15px] font-semibold text-[#5b3a29]">
                                ยอดชำระทั้งหมด / Total
                            </span>
                            <span className="text-2xl font-bold text-[#5b3a29]">
                                {formatPrice(grandTotal)}
                            </span>
                        </div>

                        <Link
                            href="/checkout"
                            className="block w-full rounded-[13px] bg-[#8b5e3c] py-[15px] text-center text-[15px] font-semibold text-white shadow-[0_6px_16px_rgba(139,94,60,0.34)] transition-colors hover:bg-[#7a4f30]"
                        >
                            ดำเนินการชำระเงิน / Checkout →
                        </Link>

                        <div className="mt-3.5 flex items-center justify-center gap-1.5 text-xs text-[#9a8571]">
                            <Lock className="h-3 w-3" />
                            ชำระเงินปลอดภัย · Secure checkout
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}