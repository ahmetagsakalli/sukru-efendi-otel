import { expect } from "@playwright/test";

export async function chooseBookingOption(page, label, option) {
  await page
    .locator("#rezervasyon")
    .getByRole("combobox", { name: label, exact: true })
    .click();
  await page
    .getByRole("listbox")
    .getByRole("option", { name: option, exact: true })
    .click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
}

export async function chooseBookingDate(page, name, value) {
  const trigger = page.locator(
    `#rezervasyon button[data-booking-date="${name}"]`,
  );
  await trigger.click();
  const dialog = page.getByRole("dialog");
  const target = dialog.locator(`[data-day="${value}"] button`);
  for (
    let attempt = 0;
    attempt < 24 && (await target.count()) === 0;
    attempt++
  ) {
    const firstVisibleDate = await dialog
      .locator("[data-day]")
      .first()
      .getAttribute("data-day");
    await dialog
      .getByRole("button", {
        name: value < firstVisibleDate ? "Önceki ay" : "Sonraki ay",
        exact: true,
      })
      .click();
  }
  await target.click();
  await expect(dialog).toHaveCount(0);
}
