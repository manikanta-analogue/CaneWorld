# Merge "Menu & Categories" and "Products" into one Menu screen

Today two admin pages overlap: "Menu & Categories" creates categories and adds juices (with price + loyalty), and "Products" edits every juice in detail (price, image, loyalty, order, visibility). Same job, two places.

## What changes

One sidebar item: **Menu** (replaces both "Menu & Categories" and "Products").

The Menu page is organised by category, top to bottom:

```text
Menu                                    [ + Add category ]

▼ Sugarcane Juice          order [1]  visible [on]  rename  delete
    [img] 300ml   Rs 40   Buy 9 get 1 free   visible   [Edit] 
    [img] 500ml   Rs 60   Loyalty off        hidden    [Edit]
    [ + Add juice to this category ]

▶ Fruit Mix with Sugarcane Juice   (3 juices)
```

- Each category is a collapsible section with inline rename, display order, visible toggle, and delete (still blocked while it has juices).
- Each juice shows a compact row: image thumbnail, name/size, price, loyalty summary, visible state.
- **Edit** opens a dialog with the full existing controls: category, name/size, volume, price, display order, description, image upload/replace/remove, loyalty on/off with required purchases + free quantity, visible in POS, Save.
- **Add juice** opens the same dialog pre-filled with the category, empty fields.
- A search box plus a "show hidden" toggle at the top, so long menus stay manageable.

Nothing about the customer POS, pricing rules, or loyalty maths changes — the same tables and fields are read and written.

## Technical notes

- New route `src/routes/admin.menu.tsx` holding one `["catalogue"]` query (categories + products + signed images, reused from `loadCatalogue`).
- Extract the juice form into `src/components/admin/ProductDialog.tsx` used for both create and edit; reuse the existing `validate()` logic, and the insert path from `admin.categories.tsx`.
- Category mutations (add/rename/reorder/toggle/delete-with-guard) move over unchanged from `admin.categories.tsx`.
- Delete `src/routes/admin.categories.tsx` and `src/routes/admin.products.tsx`; add redirects from `/admin/categories` and `/admin/products` to `/admin/menu` so old links and bookmarks keep working.
- `src/routes/admin.tsx`: replace the two sidebar entries with one `Menu` entry (`/admin/menu`, `ListTree` icon); super-admin-only as today.
- Keep invalidating `["catalogue"]`, `["menu"]`, `["products"]` so the POS refreshes.
- Own `head()` metadata for the new route.
