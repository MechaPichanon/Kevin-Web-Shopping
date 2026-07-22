import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HeroBanner() {
  return (
    <section
      className="relative overflow-hidden py-24 sm:py-32"
      style={{
        background:
          "linear-gradient(150deg, #f4ede3 0%, #ece2d6 60%, #e3d4c2 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(139,111,90,.05) 0 2px, transparent 2px 22px)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <span className="font-mono text-xs font-medium uppercase tracking-[0.25em] text-[#8b6f5a]">
          ร้านบอสเนยย์ · Boss Butter
        </span>

        <h1 className="font-serif mt-4 text-4xl font-semibold text-[#3d3025] sm:text-6xl">
          เสื้อผ้าคุณภาพดี
          <br className="hidden sm:block" /> ราคาที่คุณเข้าถึงได้
        </h1>

        <p className="font-fraunces mx-auto mt-4 max-w-xl text-lg italic text-[#8b6f5a]">
          Quality clothing at a price you can afford
        </p>

        <Link
          href="/products"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#8b5e3c] px-6 py-3 font-medium text-white transition hover:bg-[#7a5233]"
        >
          ช้อปเลย · Shop now
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
