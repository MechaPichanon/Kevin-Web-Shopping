"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ImageSearchResult = {
  product_id: string;
  product_name: string;
  image_url: string;
  similarity: number;
  min_price: number | null;
};

export const IMAGE_SEARCH_STORAGE_KEY = "kevin_image_search_result";

export default function ImageSearchButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"dropzone" | "loading">("dropzone");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const toggleOpen = () => {
    setOpen((o) => !o);
    setPhase("dropzone");
    setIsDraggingOver(false);
    setError("");
  };

  const closePanel = () => setOpen(false);

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const uploadAndSearch = async (file: File, dataUrl: string) => {
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/image-search", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ค้นหาไม่สำเร็จ / Search failed");
        setPhase("dropzone");
        return;
      }
      sessionStorage.setItem(
        IMAGE_SEARCH_STORAGE_KEY,
        JSON.stringify({ previewSrc: dataUrl, results: data.results ?? [] })
      );
      setOpen(false);
      router.push("/search/by-image");
    } catch {
      setError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ / Unable to reach server");
      setPhase("dropzone");
    }
  };

  const runSearch = (file: File) => {
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreviewSrc(dataUrl);
      setPhase("loading");
      uploadAndSearch(file, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) runSearch(file);
    e.target.value = "";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) runSearch(file);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        aria-label="Search by image"
        title="Search by image"
        onClick={toggleOpen}
        className={`p-2 rounded-full transition-colors text-[#8b6f5a] hover:bg-[#ece2d6] ${
          open ? "bg-[#ece2d6]" : "bg-transparent"
        }`}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
          <circle cx="12" cy="13" r="4"></circle>
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-[calc(100%+12px)] right-0 w-80 bg-white border border-[#e0d5c8] rounded-2xl shadow-[0_12px_32px_rgba(58,46,34,0.16)] p-[18px] z-[60]"
          style={{ animation: "fadeIn 0.15s ease-out" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-[#3a2e22]">
              Search by image
            </span>
            <button
              aria-label="Close"
              onClick={closePanel}
              className="w-6 h-6 rounded-full text-[#8b6f5a] hover:bg-[#ece2d6] flex items-center justify-center transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <path d="M18 6 6 18M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          {phase === "loading" ? (
            <div className="flex flex-col items-center px-2 py-5">
              {previewSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewSrc}
                  alt=""
                  className="w-16 h-16 object-cover rounded-[10px] mb-3 border border-[#e0d5c8]"
                />
              )}
              <div className="w-5 h-5 rounded-full border-[3px] border-[#ece2d6] border-t-[#8b5e3c] animate-spin mb-2.5"></div>
              <div className="text-[13px] text-[#8b6f5a] font-medium">
                Searching for similar shirts...
              </div>
            </div>
          ) : (
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={triggerFilePicker}
              className={`border-2 border-dashed rounded-xl px-4 py-7 text-center cursor-pointer transition-colors ${
                isDraggingOver
                  ? "border-[#8b5e3c] bg-[#f5efe6]"
                  : "border-[#e0d5c8] bg-[#fdfcfa]"
              }`}
            >
              <div className="w-11 h-11 rounded-full bg-[#ece2d6] flex items-center justify-center mx-auto mb-3">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#8b5e3c"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 16V4M12 4 7 9M12 4l5 5"></path>
                  <path d="M20 16.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5"></path>
                </svg>
              </div>
              <div className="text-[13.5px] font-semibold text-[#3a2e22] mb-1">
                Drag an image here
              </div>
              <div className="text-xs text-[#8b6f5a]">
                or click to browse — search starts instantly
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onFileSelected}
                className="hidden"
              />
            </div>
          )}

          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
