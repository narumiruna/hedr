import { expect, type Page, test } from "@playwright/test";
import {
  themeAppearance,
  themeStyle,
  toggleThemeAppearance,
  WORKBENCH_THEMES,
} from "../src/theme-preferences";

const cleanThemes = WORKBENCH_THEMES.filter(({ theme }) =>
  /^(mist|sage|linen)-/.test(theme),
);

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  return page.getByRole("dialog", { name: "Settings", exact: true });
}

for (const { browserColor, label, theme } of cleanThemes) {
  test(`${label} supports cancel, save, reload, portals, and appearance toggle`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    let settings = await openSettings(page);
    await settings
      .getByRole("radio", { name: new RegExp(`^${label}`) })
      .check();
    await settings.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.locator("html")).toHaveClass(/theme-editorial/);
    expect(
      await page.evaluate(() => localStorage.getItem("herdr-web-theme")),
    ).toBe("editorial-dark");

    settings = await openSettings(page);
    await expect(
      settings.getByRole("radio", { name: /^Editorial Dark/ }),
    ).toBeChecked();
    await settings
      .getByRole("radio", { name: new RegExp(`^${label}`) })
      .check();
    await settings.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.locator("html")).toHaveClass(
      new RegExp(`theme-${themeStyle(theme)}`),
    );
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      browserColor,
    );
    expect(
      await page.evaluate(() => localStorage.getItem("herdr-web-theme")),
    ).toBe(theme);
    await page.reload();
    await expect(page.locator(".herdr-web-theme")).toHaveClass(
      new RegExp(themeAppearance(theme)),
    );
    expect(
      await page
        .locator("html")
        .evaluate((element) =>
          [...element.classList].filter((name) => name.startsWith("theme-")),
        ),
    ).toEqual([`theme-${themeStyle(theme)}`]);

    const command = page.getByRole("button", { name: "Open Action Palette" });
    await command.focus();
    const metrics = await command.evaluate((element) => {
      const root = document.querySelector(".herdr-web-theme") as HTMLElement;
      const styles = getComputedStyle(root);
      const probe = document.createElement("span");
      root.append(probe);
      const resolve = (value: string) => {
        probe.style.color = value;
        return getComputedStyle(probe).color;
      };
      const luminance = (color: string) => {
        const channels = (color.match(/[\d.]+/g) ?? [])
          .slice(0, 3)
          .map(Number)
          .map((value) => {
            const channel = color.startsWith("color(") ? value : value / 255;
            return channel <= 0.04045
              ? channel / 12.92
              : ((channel + 0.055) / 1.055) ** 2.4;
          });
        return (
          (channels[0] ?? 0) * 0.2126 +
          (channels[1] ?? 0) * 0.7152 +
          (channels[2] ?? 0) * 0.0722
        );
      };
      const contrast = (left: string, right: string) => {
        const [lighter, darker] = [luminance(left), luminance(right)].sort(
          (a, b) => b - a,
        );
        return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
      };
      const surfaces = [
        "--canvas",
        "--panel",
        "--panel-raised",
        "--panel-muted",
      ].map((token) => resolve(`var(${token})`));
      const text = ["--ink", "--ink-secondary", "--ink-muted"].flatMap(
        (token) =>
          surfaces.map((surface) =>
            contrast(resolve(`var(${token})`), surface),
          ),
      );
      const controls = getComputedStyle(element);
      const activeTab = getComputedStyle(
        document.querySelector('.session-tab[data-state="active"]') as Element,
      );
      const result = {
        accent: styles.getPropertyValue("--clean-accent").trim(),
        canvas: styles.getPropertyValue("--canvas").trim(),
        text,
        border: contrast(controls.borderColor, controls.backgroundColor),
        focus: contrast(controls.outlineColor, controls.backgroundColor),
        outline: controls.outlineStyle,
        tab: contrast(activeTab.borderBottomColor, resolve("var(--panel)")),
        terminal: getComputedStyle(
          document.querySelector(".terminal-shell") as Element,
        ).backgroundColor,
        terminalToken: resolve("var(--terminal)"),
        semantic: ["--amber-9", "--blue-9", "--grass-9", "--red-9"].map(
          (token) => styles.getPropertyValue(token).trim(),
        ),
      };
      probe.remove();
      return result;
    });
    expect(metrics.canvas).toBe(browserColor);
    for (const ratio of metrics.text) expect(ratio).toBeGreaterThanOrEqual(4.5);
    for (const ratio of [metrics.border, metrics.focus, metrics.tab])
      expect(ratio).toBeGreaterThanOrEqual(3);
    expect(metrics.outline).toBe("solid");
    expect(metrics.terminal).toBe(metrics.terminalToken);
    expect(new Set(metrics.semantic).size).toBe(4);
    await expect(page.locator(".brand-type strong")).toHaveCSS(
      "font-family",
      /Bricolage Grotesque/,
    );
    await page.screenshot({
      path: testInfo.outputPath(`${theme}-desktop.png`),
      animations: "disabled",
    });

    settings = await openSettings(page);
    const portal = await settings.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        canvas: styles.getPropertyValue("--canvas").trim(),
        accent: styles.getPropertyValue("--clean-accent").trim(),
        semantic: ["--amber-9", "--blue-9", "--grass-9", "--red-9"].map(
          (token) => styles.getPropertyValue(token).trim(),
        ),
      };
    });
    expect(portal).toEqual({
      canvas: browserColor,
      accent: metrics.accent,
      semantic: metrics.semantic,
    });
    await expect(
      settings.getByRole("radio", { name: new RegExp(`^${label}`) }),
    ).toBeChecked();
    const swatches = await settings
      .locator(".theme-swatch")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const channels =
            getComputedStyle(element).backgroundColor.match(/\d+/g) ?? [];
          return `#${channels
            .slice(0, 3)
            .map((value) => Number(value).toString(16).padStart(2, "0"))
            .join("")}`;
        }),
      );
    expect(swatches).toEqual(
      WORKBENCH_THEMES.map((option) => option.browserColor),
    );
    await settings.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", {
        name: `Use ${themeAppearance(theme) === "light" ? "dark" : "light"} appearance`,
      })
      .click();
    expect(
      await page.evaluate(() => localStorage.getItem("herdr-web-theme")),
    ).toBe(toggleThemeAppearance(theme));
    await expect(page.locator("html")).toHaveClass(
      new RegExp(`theme-${themeStyle(theme)}`),
    );
  });

  test(`${label} fits 320px mobile Settings with keyboard selection`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      (value) => localStorage.setItem("herdr-web-theme", value),
      theme,
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation" }).click();
    const settings = await openSettings(page);
    const selected = settings.getByRole("radio", {
      name: new RegExp(`^${label}`),
    });
    await selected.scrollIntoViewIfNeeded();
    await selected.focus();
    await expect(selected).toBeFocused();
    await expect(selected).toBeChecked();
    await page.keyboard.press("ArrowDown");
    await expect(selected).not.toBeChecked();
    await page.keyboard.press("ArrowUp");
    await expect(selected).toBeChecked();
    const bounds = await settings.boundingBox();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(320);
    expect(
      await settings.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`${theme}-mobile-settings.png`),
      animations: "disabled",
    });
    const apply = settings.getByRole("button", { name: "Apply", exact: true });
    await apply.scrollIntoViewIfNeeded();
    await expect(apply).toBeVisible();
    await apply.click();
    await expect(settings).toBeHidden();
    expect(
      await page.evaluate(() => localStorage.getItem("herdr-web-theme")),
    ).toBe(theme);
  });
}
