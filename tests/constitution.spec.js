import { test, expect } from "@playwright/test";
import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("routes.manifest.json", "utf8"));
const BASE = process.env.BASE_URL || manifest.baseUrl;
if (!BASE) throw new Error("BASE_URL not set and routes.manifest.json has no baseUrl.");

const LOGIN_RE = new RegExp(manifest.loginUrlRegex || "\\/login\\.html", "i");

async function forceLoggedOut(page) {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

test("PUBLIC routes load without redirect when logged out", async ({ page }) => {
  await forceLoggedOut(page);
  for (const path of manifest.public || []) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(LOGIN_RE);
  }
});

test("PROTECTED routes redirect to login when logged out", async ({ page }) => {
  await forceLoggedOut(page);
  for (const path of manifest.protected || []) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(LOGIN_RE);
  }
});

test("PAID routes redirect to login when logged out (minimum guarantee)", async ({ page }) => {
  await forceLoggedOut(page);
  for (const path of manifest.paid || []) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(LOGIN_RE);
  }
});
