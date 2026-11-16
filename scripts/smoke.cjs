const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {})});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:3000');
    await page.getByLabel('Applicant name').fill('Demo User');
    await page.getByLabel('Monthly income (₹)').fill('25000');
    await page.getByLabel('Requested loan (₹)').fill('100000');
    await page.getByRole('button', {name: 'Try a simpler layout'}).click();
    await page.getByRole('status').filter({hasText: 'Mock layout applied'}).waitFor();
    for (const [id, value] of [['fullName','Demo User'], ['monthlyIncome','25000'], ['loanAmount','100000']]) {
      if (await page.locator('#' + id).inputValue() !== value) throw Error('Value lost: ' + id);
    }
    await page.route('**/api/ui/generate', route => route.abort());
    await page.getByRole('button', {name: 'Try a simpler layout'}).click();
    await page.getByRole('status').filter({hasText: 'Could not simplify'}).waitFor();
    if (await page.locator('#fullName').inputValue() !== 'Demo User') throw Error('Value lost on failure');
    await page.setViewportSize({width: 390, height: 844});
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Mobile overflow');
    if (errors.length) throw Error(errors.join('\n'));
    console.log('PASS: adaptation, three-field preservation, failure recovery, mobile width, no page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
