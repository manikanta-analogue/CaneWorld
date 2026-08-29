import sugarcane from "@/assets/cat-sugarcane.jpg";
import vegetable from "@/assets/cat-vegetable.jpg";
import fruitmix from "@/assets/cat-fruitmix.jpg";
import fruit from "@/assets/cat-fruit.jpg";
import sipper from "@/assets/cat-sipper.jpg";

type Art = { image: string; tint: string; ring: string };

const ART: Array<{ match: RegExp; art: Art }> = [
  {
    match: /sipper|bottle/i,
    art: { image: sipper, tint: "bg-sky-50", ring: "ring-sky-200" },
  },
  {
    match: /mix/i,
    art: { image: fruitmix, tint: "bg-rose-50", ring: "ring-rose-200" },
  },
  {
    match: /vegetable/i,
    art: { image: vegetable, tint: "bg-lime-50", ring: "ring-lime-200" },
  },
  {
    match: /fruit/i,
    art: { image: fruit, tint: "bg-orange-50", ring: "ring-orange-200" },
  },
  {
    match: /sugarcane|cane/i,
    art: { image: sugarcane, tint: "bg-emerald-50", ring: "ring-emerald-200" },
  },
];

const FALLBACK: Art = { image: sugarcane, tint: "bg-emerald-50", ring: "ring-emerald-200" };

/** Colourful artwork for a category name, used when no uploaded image exists. */
export function categoryArt(name?: string | null): Art {
  if (!name) return FALLBACK;
  return ART.find((row) => row.match.test(name))?.art ?? FALLBACK;
}

/** All category artworks, used for the sliding home banner. */
export const bannerArt = [
  { image: sugarcane, label: "100% Natural", sub: "No Added Sugar", cta: "Order sugarcane", match: /sugarcane|cane/i },
  { image: fruitmix, label: "Fruit Mix Blends", sub: "Cane + your favourites", cta: "Try a mix", match: /mix/i },
  { image: fruit, label: "Fresh Fruit Juices", sub: "Pressed every morning", cta: "Shop fruit juices", match: /fruit/i },
  { image: vegetable, label: "Veggie Boosters", sub: "Green & clean", cta: "Shop veggie juices", match: /vegetable|veggie/i },
  { image: sipper, label: "Sipper Bottles", sub: "Take it anywhere", cta: "Grab a sipper", match: /sipper|bottle/i },
];

/** Prefer the admin-uploaded product image, otherwise fall back to category art. */
export function productImage(product: {
  image_signed_url?: string | null;
  category_name?: string | null;
  name?: string;
}): string {
  return (
    product.image_signed_url ??
    categoryArt(product.category_name ?? product.name ?? null).image
  );
}
