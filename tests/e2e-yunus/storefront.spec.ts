import { test, expect } from '@playwright/test';

// Public storefront acceptance only. No customer, admin, cart or payment writes.
const product = '/products/etiketli-18li-antrasit-ekonomik-kirilmaz-saklama-kabi-seti-x6-175-12-05-lt';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const req = route.request();
    const host = new URL(req.url()).hostname;
    if (!['GET', 'HEAD'].includes(req.method()) || /(^|\.)(facebook\.com|facebook\.net|google-analytics\.com)$/.test(host)) {
      await route.abort();
    } else {
      await route.continue();
    }
  });
});

test('m10 footer has six real image/SVG payment icons', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.vf-pay svg, .vf-pay img')).toHaveCount(6);
});

test('m11 favorites fit inside their grid and the viewport', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const grid = page.locator('.vmh2-products:not(.vmh2-products--slider)').first();
  await expect(grid).toBeVisible();
  const metrics = await grid.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      cards: el.children.length,
      overflow: Math.max(0, ...Array.from(el.children).map(child => child.getBoundingClientRect().right - r.right)),
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(metrics.cards).toBeGreaterThan(0);
  expect(metrics.overflow).toBeLessThanOrEqual(1);
  expect(metrics.pageOverflow).toBeLessThanOrEqual(1);
});

test('m2 product FAQ opens and shows actual answers', async ({ page }) => {
  await page.goto(product, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sıkça Sorulan Sorular', exact: true }).click();
  const faq = page.locator('[data-vm-sss]');
  await expect(faq).toBeVisible();
  await expect(faq.locator('.vm-sss-soru').first()).not.toBeEmpty();
  await expect(faq.locator('.vm-sss-cevap').first()).not.toBeEmpty();
});

test('m5 shipping countdown is connected to product UI', async ({ page }) => {
  await page.goto(product, { waitUntil: 'domcontentloaded' });
  const counter = page.locator('.vks-satir').first();
  await expect(counter).toBeVisible();
  await expect(counter).toContainText(/kargoda/i);
  const gap = await counter.evaluate(el => getComputedStyle(el).gap);
  expect(gap).toBe('8px');
});

test('m8 product offers the requested Hemen Al action', async ({ page }) => {
  await page.goto(product, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /hemen al/i }).or(page.getByRole('link', { name: /hemen al/i })).first()).toBeVisible();
});

test('m7 Turkish product alias resolves to the same product', async ({ page }) => {
  const response = await page.goto(product.replace('/products/', '/urunler/'), { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBeLessThan(400);
  await expect(page.getByRole('heading', { level: 1, name: "Etiketli 18'li Antrasit Ekonomik Kırılmaz Saklama Kabı Seti", exact: true })).toBeVisible();
});

// These 18 checks cover samples of m2/m5/m7/m8/m10/m11. They do not
// certify the remaining design items, email sending, variants or a paid Purchase.
