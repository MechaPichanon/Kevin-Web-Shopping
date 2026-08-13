"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IMAGE_SEARCH_STORAGE_KEY,
  type ImageSearchResult,
} from "@/components/ImageSearchButton";

type StoredImageSearch = {
  previewSrc: string;
  results: ImageSearchResult[];
};

function formatPrice(price: number | null) {
  if (price === null) return "";
  return `${price.toLocaleString()} THB`;
}

export default function ImageSearchResultsPage() {
  const router = useRouter();
  const [data, setData] = useState<StoredImageSearch | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(IMAGE_SEARCH_STORAGE_KEY);
    if (!raw) {
      setNotFound(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as StoredImageSearch;
      if (!parsed.previewSrc || !Array.isArray(parsed.results)) {
        setNotFound(true);
        return;
      }
      setData(parsed);
    } catch {
      setNotFound(true);
    }
  }, []);

  useEffect(() => {
    if (notFound) router.replace("/");
  }, [notFound, router]);

  if (!data) return null;

  return (
    <main className="max-w-[1240px] mx-auto px-8 pt-8 pb-20">
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-[#8b6f5a] text-[13px] font-medium py-1.5 mb-4.5"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6"></path>
        </svg>
        Back to shop
      </button>

      <div className="flex items-center gap-3.5 mb-7 bg-white border border-[#e0d5c8] rounded-2xl px-4.5 py-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.previewSrc}
          alt="Uploaded search photo"
          className="w-14 h-14 object-cover rounded-[10px] border border-[#e0d5c8]"
        />
        <div>
          <div className="text-xs text-[#8b6f5a] mb-0.5">
            Visual search results for
          </div>
          <div className="text-[15px] font-bold text-[#3a2e22]">
            your uploaded photo
          </div>
        </div>
      </div>

      {data.results.length === 0 ? (
        <p className="text-sm text-[#8b6f5a]">
          No similar products found. Try a different photo.
        </p>
      ) : (
        <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
          {data.results.map((item, i) => (
            <Link
              key={`${item.product_id}-${i}`}
              href={`/products/${item.product_id}`}
              className="block bg-white border border-[#e0d5c8] rounded-2xl overflow-hidden no-underline"
            >
              <div className="relative w-full h-[220px] bg-[#ece2d6]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image_url}
                  alt={item.product_name}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2 left-2 bg-[#8b5e3c] text-white text-[10px] font-bold px-2 py-1 rounded-full">
                  {Math.round(item.similarity * 100)}% match
                </span>
              </div>
              <div className="px-4 py-3.5">
                <div className="text-sm font-semibold text-[#3a2e22] mb-1">
                  {item.product_name}
                </div>
                <div className="text-sm text-[#8b5e3c] font-semibold">
                  {formatPrice(item.min_price)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
