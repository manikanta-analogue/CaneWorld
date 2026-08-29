import { useEffect, useMemo, useState } from "react";
import { Search, Minus, Plus, Sparkles, ShoppingCart, Leaf, ChevronLeft, ChevronRight } from "lucide-react";
import {
  buildOrder,
  formatMoney,
  isEligible,
  loyaltyOn,
  rewardQuantity,
  type CartLine,
  type Product,
  type Progress,
} from "@/lib/loyalty";
import { bannerArt, categoryArt, productImage } from "@/lib/category-art";
import { Button } from "@/components/ui/button";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";

export function PosScreen({
  products,
  progress,
  currency,
  quantities,
  setQty,
  onProceed,
  bannerUrls = [],
}: {
  products: Product[];
  progress: Progress[];
  currency: string;
  quantities: Record<string, number>;
  setQty: (productId: string, next: number) => void;
  onProceed: () => void;
  bannerUrls?: string[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [slide, setSlide] = useState(0);

  const promoBanners = useMemo(() => {
    if (bannerUrls.length > 0) {
      return bannerUrls.map((image, index) => ({
        image,
        label: `Fresh offer ${index + 1}`,
        sub: "Updated from admin settings",
        cta: "Shop now",
        match: /.*/,
      }));
    }
    return bannerArt;
  }, [bannerUrls]);

  const goTo = (index: number) =>
    setSlide(((index % promoBanners.length) + promoBanners.length) % promoBanners.length);

  /** Tapping a banner jumps into the matching category on the menu below. */
  const openBanner = (match: RegExp) => {
    const hit = categories.find((row) => match.test(row.name));
    setQuery("");
    setCategory(hit ? hit.name : "all");
    document.getElementById("menu-start")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (promoBanners.length <= 1) return;
    const timer = setInterval(() => setSlide((s) => (s + 1) % promoBanners.length), 4000);
    return () => clearInterval(timer);
  }, [promoBanners.length]);

  const progressByProduct = useMemo(
    () => Object.fromEntries(progress.map((row) => [row.product_id, row])),
    [progress],
  );

  const cart: CartLine[] = products.map((product) => ({
    product,
    qty: quantities[product.id] ?? 0,
  }));
  const { total, paidGlasses } = buildOrder(cart, []);

  /* Categories come straight from the catalogue the server returns. */
  const categories = useMemo(() => {
    const seen = new Map<string, number>();
    products.forEach((product) => {
      const name = product.category_name ?? "Menu";
      seen.set(name, (seen.get(name) ?? 0) + 1);
    });
    return Array.from(seen, ([name, count]) => ({ name, count }));
  }, [products]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      const inCategory = category === "all" || (product.category_name ?? "Menu") === category;
      const matches =
        needle.length === 0 ||
        product.name.toLowerCase().includes(needle) ||
        (product.category_name ?? "").toLowerCase().includes(needle);
      return inCategory && matches;
    });
  }, [products, query, category]);

  const groups = useMemo(() => {
    const map = new Map<string, Product[]>();
    visible.forEach((product) => {
      const key = product.category_name ?? "Menu";
      map.set(key, [...(map.get(key) ?? []), product]);
    });
    return Array.from(map, ([name, items]) => ({ name, items }));
  }, [visible]);

  const nextReward = useMemo(() => {
    const candidates = products
      .filter((product) => loyaltyOn(product))
      .map((product) => {
        const done = progressByProduct[product.id]?.purchased_count ?? 0;
        return {
          product,
          done,
          remaining: Math.max(0, product.loyalty_target - rewardQuantity(product) - done),
        };
      })
      .filter((row) => row.done > 0);
    return candidates.sort((a, b) => a.remaining - b.remaining)[0] ?? null;
  }, [products, progressByProduct]);

  return (
    <div className="space-y-6 px-4 pb-36 pt-4 sm:px-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for juices…"
          aria-label="Search juices"
          className="h-12 rounded-2xl border-border bg-card pl-11 text-base shadow-card"
        />
      </div>

      {/* Sliding promotional banner */}
      <section
        className="relative overflow-hidden rounded-3xl shadow-card"
        aria-roledescription="carousel"
        aria-label="Promotions"
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${slide * 100}%)` }}
        >
          {promoBanners.map((banner) => (
            <div
              key={banner.label}
              role="button"
              tabIndex={0}
              onClick={() => openBanner(banner.match)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openBanner(banner.match);
                }
              }}
              className="relative h-44 w-full shrink-0 cursor-pointer focus-visible:outline-none sm:h-56"
            >
              <img
                src={banner.image}
                alt={banner.label}
                width={512}
                height={512}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
              <div className="relative flex h-full flex-col justify-end p-5">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground">
                  <Leaf className="h-3.5 w-3.5" aria-hidden /> Fresh today
                </span>
                <p className="mt-2 text-xl font-extrabold leading-tight text-white">{banner.label}</p>
                <p className="mt-0.5 text-xs font-medium text-white/85">{banner.sub}</p>
                <Button
                  onClick={(event) => {
                    event.stopPropagation();
                    openBanner(banner.match);
                  }}
                  className="mt-3 h-10 w-fit rounded-full px-5 text-sm font-bold shadow-lift"
                >
                  {banner.cta}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => goTo(slide - 1)}
          aria-label="Previous banner"
          className="absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-cane-700 shadow-lift transition hover:bg-white active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => goTo(slide + 1)}
          aria-label="Next banner"
          className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-cane-700 shadow-lift transition hover:bg-white active:scale-95"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div className="absolute bottom-3 right-4 flex gap-1.5">
          {promoBanners.map((banner, index) => (
            <button
              key={`${banner.label}-${index}`}
              onClick={() => goTo(index)}
              aria-label={`Go to banner ${index + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                index === slide ? "w-5 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      </section>

      {nextReward ? (
        <section className="rounded-3xl border border-border bg-card p-4 shadow-card">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold">Your loyalty progress</p>
              <p className="truncate text-xs text-muted-foreground">
                {nextReward.remaining === 0
                  ? `Free ${nextReward.product.name} ready to redeem`
                  : `Buy ${nextReward.remaining} more & get ${rewardQuantity(nextReward.product)} FREE`}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
              {nextReward.done} / {nextReward.product.loyalty_target}
            </span>
          </div>
          <ProgressBar
            value={(nextReward.done / nextReward.product.loyalty_target) * 100}
            className="mt-3 h-2"
          />
        </section>
      ) : null}

      {categories.length > 0 ? (
        <section id="menu-start" className="scroll-mt-24 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold">Shop by category</h2>
            {category !== "all" ? (
              <button
                onClick={() => setCategory("all")}
                className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
              >
                View all
              </button>
            ) : null}
          </div>
          <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {categories.map(({ name, count }) => {
              const art = categoryArt(name);
              const active = category === name;
              return (
                <button
                  key={name}
                  onClick={() => setCategory(active ? "all" : name)}
                  aria-pressed={active}
                  className="w-20 shrink-0 snap-start text-center focus-visible:outline-none"
                >
                  <span
                    className={`grid h-20 w-20 place-items-center overflow-hidden rounded-full ring-2 transition-all ${art.tint} ${
                      active ? "ring-primary" : art.ring
                    }`}
                  >
                    <img
                      src={art.image}
                      alt={name}
                      loading="lazy"
                      width={512}
                      height={512}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span
                    className={`mt-2 block text-[11px] font-bold leading-tight ${
                      active ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {name}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">{count} sizes</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {products.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No drinks are available right now. Please check with the counter.
        </p>
      ) : null}

      {products.length > 0 && visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nothing matches “{query}”. Try another search.
        </p>
      ) : null}

      {groups.map((group) => (
        <section key={group.name} className="space-y-3">
          <h2 className="text-base font-extrabold">{group.name}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((product) => {
              const done = progressByProduct[product.id]?.purchased_count ?? 0;
              const hasLoyalty = loyaltyOn(product);
              const reward = rewardQuantity(product);
              const eligible = isEligible(done, product.loyalty_target, reward, hasLoyalty);
              const qty = quantities[product.id] ?? 0;
              const art = categoryArt(product.category_name);
              return (
                <article
                  key={product.id}
                  className="rounded-3xl border border-border bg-card p-3 shadow-card transition-shadow hover:shadow-lift"
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                    <img
                      src={productImage(product)}
                      alt={product.name}
                      loading="lazy"
                      width={512}
                      height={512}
                      className={`h-20 w-20 shrink-0 rounded-2xl object-cover ${art.tint}`}
                    />
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-base font-extrabold leading-tight">{product.name}</p>
                      {product.description ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
                      ) : null}
                      <p className="text-lg font-extrabold text-primary">
                        {formatMoney(Number(product.price), currency)}
                      </p>
                      {hasLoyalty ? (
                        <p className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                          <Sparkles className="h-3 w-3" aria-hidden />
                          Buy {product.loyalty_target - reward} get {reward} free
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    {hasLoyalty ? (
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={eligible ? "font-semibold text-primary" : "text-muted-foreground"}>
                            {eligible ? "Free glass ready!" : "Progress"}
                          </span>
                          <span className="font-semibold">
                            {done} / {product.loyalty_target}
                          </span>
                        </div>
                        <ProgressBar value={(done / product.loyalty_target) * 100} className="h-1.5" />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{product.volume_ml} ml</span>
                    )}

                    {qty === 0 ? (
                      <Button
                        size="icon"
                        className="h-10 w-10 rounded-full"
                        onClick={() => setQty(product.id, 1)}
                        aria-label={`Add ${product.name}`}
                      >
                        <Plus className="h-5 w-5" />
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 rounded-full bg-secondary p-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-full"
                          aria-label={`Decrease ${product.name}`}
                          onClick={() => setQty(product.id, qty - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-6 text-center text-base font-bold">{qty}</span>
                        <Button
                          size="icon"
                          className="h-9 w-9 rounded-full"
                          aria-label={`Increase ${product.name}`}
                          onClick={() => setQty(product.id, qty + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {paidGlasses > 0 ? (
        <div className="fixed inset-x-0 bottom-16 z-10 px-3 pb-2">
          <div className="mx-auto grid max-w-md grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-cane-700 px-4 py-3 text-primary-foreground shadow-lift">
            <div className="min-w-0">
              <p className="text-xs opacity-80">{paidGlasses} glasses in cart</p>
              <p className="truncate text-lg font-extrabold">{formatMoney(total, currency)}</p>
            </div>
            <Button
              className="h-11 rounded-full bg-primary px-6 text-base text-primary-foreground hover:bg-primary/90"
              onClick={onProceed}
            >
              <ShoppingCart className="mr-2 h-4 w-4" /> Checkout
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
