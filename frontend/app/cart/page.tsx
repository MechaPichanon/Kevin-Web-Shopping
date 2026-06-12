"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type CartItem = {
    cart_item_id: number;
    quantity: number;

    product_name: string;

    variant_id: string;
    price: number;

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
                                className="flex gap-4 rounded-xl bg-white p-4"
                            >
                                <img
                                    src={
                                        item.image_url ||
                                        "https://placehold.co/300x400"
                                    }
                                    className="h-32 w-24 object-cover rounded"
                                />

                                <div className="flex-1">
                                    <h3 className="font-bold">
                                        {item.product_name}
                                    </h3>

                                    <p>
                                        จำนวน :
                                        {item.quantity}
                                    </p>

                                    <p>
                                        {formatPrice(
                                            Number(item.price)
                                        )}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-xl bg-white p-6 h-fit">
                        <h2 className="text-xl font-bold mb-4">
                            สรุปคำสั่งซื้อ
                        </h2>

                        <div className="flex justify-between">
                            <span>ยอดสินค้า</span>

                            <span>
                                {formatPrice(totalPrice)}
                            </span>
                        </div>

                        <div className="flex justify-between mt-2">
                            <span>ค่าจัดส่ง</span>

                            <span>
                                {shippingFee === 0
                                    ? "ฟรี"
                                    : formatPrice(
                                        shippingFee
                                    )}
                            </span>
                        </div>

                        <hr className="my-4" />

                        <div className="flex justify-between font-bold text-lg">
                            <span>รวมทั้งหมด</span>

                            <span>
                                {formatPrice(grandTotal)}
                            </span>
                        </div>

                        <Link
                            href="/checkout"
                            className="mt-6 block rounded-lg bg-black py-3 text-center text-white"
                        >
                            ดำเนินการสั่งซื้อ
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}