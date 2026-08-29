# Remove category display-order field from the Menu screen

## Goal
Remove the per-category "display order" number input from the admin Menu page (`src/routes/admin.menu.tsx`), matching the earlier removal of product display order. Categories should no longer expose a manual sort-order control.

## Changes (single file: `src/routes/admin.menu.tsx`)

1. **Delete the display-order `<Input>`** (lines 278–291) next to the category name input. This removes the visible numeric field and its `onBlur` save handler.

2. **Keep `sort_order` working behind the scenes** — no database change needed:
   - `addCategory` already auto-assigns the next order (`last sort_order + 1`), so new categories still sort correctly.
   - The category name input's `onBlur` calls `saveCategory` with `sort_order: category.sort_order` (unchanged), so renaming preserves order.

3. **Leave the query `.order("sort_order")` calls** in `loadCatalogue` untouched — categories/products continue to render in their stored order.

4. No change to the `saveCategory` mutation signature (it still accepts `sort_order`); only the UI control that let admins edit it is removed.

## Result
The Menu screen shows each category with just a rename input, juice count, visibility toggle, and delete — no manual order field. Ordering stays automatic by creation order.
