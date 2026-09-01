import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

const outDir = "/private/tmp/sweet-rewards-loyalty-test";
execFileSync(
  "./node_modules/.bin/tsc",
  ["--target", "es2022", "--module", "nodenext", "--moduleResolution", "nodenext", "--outDir", outDir, "src/lib/loyalty-calculations.ts"],
  { stdio: "inherit" },
);
const { redeemableFreeQuantityForRule } = await import(`${outDir}/loyalty-calculations.js`);

test("a cart can complete a reward target", () => {
  assert.equal(redeemableFreeQuantityForRule(9, 0, 2, 10, 1), 1);
});

test("multiple free quantities are redeemed once", () => {
  assert.equal(redeemableFreeQuantityForRule(10, 0, 2, 10, 2), 2);
  assert.equal(redeemableFreeQuantityForRule(10, 2, 2, 10, 2), 0);
});

test("the next cycle starts from paid items only", () => {
  // Old Buy 10/Get 1 cycle: 10 previous paid + cart of 2 => 1 paid and 1 free.
  const free = redeemableFreeQuantityForRule(10, 0, 2, 10, 1);
  assert.equal(2 - free, 1);
  // That paid item is now 1/7 under the newly active rule.
  assert.equal(redeemableFreeQuantityForRule(1, 0, 1, 7, 1), 0);
});
