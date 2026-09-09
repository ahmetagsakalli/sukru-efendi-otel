import { chromium, firefox, webkit, devices, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import {
  chooseBookingDate,
  chooseBookingOption,
} from "./booking-test-helpers.mjs";

const baseURL = process.env.BOOKING_SMOKE_URL || "http://127.0.0.1:3000";
const output = process.env.BOOKING_SCREENSHOTS;
const cases = [
  {
    name: "chrome",
    engine: chromium,
    launch: { channel: "chrome" },
    context: { viewport: { width: 1440, height: 1000 } },
  },
  {
    name: "firefox",
    engine: firefox,
    context: { viewport: { width: 1440, height: 1000 }, colorScheme: "dark" },
  },
  {
    name: "webkit",
    engine: webkit,
    context: { viewport: { width: 1440, height: 1000 } },
  },
  {
    name: "iphone",
    engine: webkit,
    context: { ...devices["iPhone 13"], colorScheme: "dark" },
  },
  {
    name: "android",
    engine: chromium,
    launch: { channel: "chrome" },
    context: { ...devices["Pixel 7"] },
  },
];

function plusDays(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

for (const testCase of cases) {
  const browser = await testCase.engine.launch({
    headless: true,
    ...testCase.launch,
  });
  const context = await browser.newContext({
    locale: "tr-TR",
    extraHTTPHeaders: {
      "x-forwarded-for": `10.73.${Math.floor(Math.random() * 254) + 1}.${cases.indexOf(testCase) + 1}`,
    },
    ...testCase.context,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Test only the controls. Any unexpected reservation submission is blocked.
  await page.route("**/api/reservations", (route) => {
    throw new Error(`Unexpected submission: ${route.request().url()}`);
  });
  const booking = page.locator("#rezervasyon");

  async function capture(label, panel) {
    await page.evaluate(() => document.fonts.ready);
    await expect(panel).toBeVisible();
    await expect(panel).toHaveCSS("opacity", "1");
    await expect(panel).toHaveCSS("background-color", "rgb(252, 250, 245)");
    await expect(panel).toHaveCSS("border-radius", "5px");
    const bodyFont = await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    await expect(panel).toHaveCSS("font-family", bodyFont);
    const rect = await panel.boundingBox();
    const viewport = page.viewportSize();
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height + 1);
    if (output) {
      await fs.mkdir(output, { recursive: true });
      await page.screenshot({
        path: path.join(output, `${testCase.name}-${label}.png`),
      });
    }
  }

  try {
    await page.goto(baseURL);
    await page.evaluate(() => document.fonts.ready);
    await expect(
      booking.getByRole("button", { name: "Devam edin", exact: true }),
    ).toBeEnabled({ timeout: 30000 });
    await expect(
      booking.locator('input[type="date"], select:not([aria-hidden="true"])'),
    ).toHaveCount(0);
    const room = booking.getByRole("combobox", { name: "Odanız", exact: true });
    await room.scrollIntoViewIfNeeded();
    await room.click();
    await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(3);
    await capture("rooms", page.getByRole("listbox"));
    const imgs = await page
      .getByRole("listbox")
      .locator("img")
      .evaluateAll((images) =>
        images.every((img) => img.complete && img.naturalWidth > 0),
      );
    expect(imgs).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(room).toBeFocused();
    await room.press("Space");
    await expect(page.getByRole("listbox")).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Suit Oda", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("End");
    await expect(
      page.getByRole("option", { name: "Aile Odaları", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(room).toHaveText("Aile Odaları");
    await room.press("Space");
    await expect(page.getByRole("listbox")).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Aile Odaları", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("s");
    await expect(
      page.getByRole("option", { name: "Standart Oda", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(room).toHaveText("Standart Oda");
    await chooseBookingOption(page, "Odanız", "Aile Odaları");
    await chooseBookingOption(page, "Yetişkin", "4");
    await booking.getByRole("combobox", { name: "Çocuk", exact: true }).click();
    await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(9);
    await capture("children", page.getByRole("listbox"));
    await page.getByRole("option", { name: "8", exact: true }).click();
    await expect(
      booking.getByRole("combobox", { name: "Çocuk", exact: true }),
    ).toHaveText("8");
    await expect(
      booking.getByRole("button", { name: "Devam edin", exact: true }),
    ).toBeDisabled();
    await chooseBookingOption(page, "Yetişkin", "8");
    await expect(
      booking.getByRole("combobox", { name: "Çocuk", exact: true }),
    ).toHaveText("8");
    await chooseBookingOption(page, "Yetişkin", "4");
    await booking.getByRole("combobox", { name: "Çocuk", exact: true }).click();
    await page.getByRole("option", { name: "0", exact: true }).click();
    await chooseBookingOption(page, "Odanız", "Standart Oda");
    const adults = booking.getByRole("combobox", {
      name: "Yetişkin",
      exact: true,
    });
    await expect(adults).toHaveText("4");
    await expect(
      booking.getByRole("button", { name: "Devam edin", exact: true }),
    ).toBeDisabled();
    await chooseBookingOption(page, "Yetişkin", "3");
    await adults.click();
    await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(8);
    await capture("guests", page.getByRole("listbox"));
    if (testCase.context.hasTouch) await page.touchscreen.tap(5, 5);
    else await page.mouse.click(5, 5);
    await expect(page.getByRole("listbox")).toHaveCount(0);

    const today = await booking.locator('[name="checkIn"]').inputValue();
    const checkIn = booking.locator('button[data-booking-date="checkIn"]');
    await checkIn.click();
    const dialog = page.getByRole("dialog", {
      name: "Giriş tarihiniz",
      exact: true,
    });
    await capture("calendar", dialog);
    const yesterday = dialog.locator(
      `[data-day="${plusDays(today, -1)}"] button`,
    );
    if (await yesterday.count()) await expect(yesterday).toBeDisabled();
    const selectedDay = dialog.locator(`[data-day="${today}"] button`);
    await expect(selectedDay).toBeFocused();
    await selectedDay.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect(booking.locator('[name="checkIn"]')).toHaveValue(
      plusDays(today, 1),
    );
    await expect(booking.locator('[name="checkOut"]')).toHaveValue(
      plusDays(today, 2),
    );
    await expect(checkIn).toBeFocused();

    await checkIn.click();
    const caption = dialog.locator(".rdp-caption_label");
    const initialMonth = await caption.textContent();
    await dialog
      .getByRole("button", { name: "Sonraki ay", exact: true })
      .click();
    await expect(caption).not.toHaveText(initialMonth);
    await dialog
      .getByRole("button", { name: "Önceki ay", exact: true })
      .click();
    await expect(caption).toHaveText(initialMonth);
    await page.keyboard.press("Escape");
    await expect(checkIn).toBeFocused();

    const checkOut = booking.locator('button[data-booking-date="checkOut"]');
    await checkOut.click();
    await expect(
      page
        .getByRole("dialog")
        .locator(`[data-day="${plusDays(today, 1)}"] button`),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Takvimi kapat", exact: true })
      .click();
    await chooseBookingDate(page, "checkOut", plusDays(today, 4));
    await expect(
      booking.getByRole("button", { name: "Devam edin", exact: true }),
    ).toBeEnabled();
    await expect(booking).toContainText("₺8.700");

    // Narrow and short viewports exercise collision/scroll handling, including zoom-like widths.
    if (testCase.name === "chrome") {
      for (const viewport of [
        { width: 320, height: 568 },
        { width: 768, height: 520 },
      ]) {
        await page.setViewportSize(viewport);
        await room.click();
        await capture(`rooms-${viewport.width}`, page.getByRole("listbox"));
        await page.keyboard.press("Escape");
        await checkOut.click();
        await capture(`calendar-${viewport.width}`, page.getByRole("dialog"));
        await page.keyboard.press("Escape");
      }
    }
    expect(errors).toEqual([]);
    console.log(
      `PASS ${testCase.name}: custom room/guest/date panels, consistent theme, keyboard and outside dismissal, bounds, date limits, capacity and live total.`,
    );
  } finally {
    await browser.close();
  }
}
