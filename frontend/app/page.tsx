import HeroBanner from "@/components/HeroBanner";
import CategoryShowcase from "@/components/CategoryShowcase";
import Recommendation from "@/components/recommendation";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <HeroBanner />
        <CategoryShowcase />
        <Recommendation />
      </main>
    </div>
  );
}
