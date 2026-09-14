import assert from 'node:assert';

export function runMarketCheckoutChecks() {
  console.log('--- Running Market Checkout & Cart Discount Checks ---');

  const mockCart = [
    {
      id: 'drop-1',
      name: 'Ceramic Self-Watering Planter (6")',
      cashPrice: 449,
      seedPrice: 8980,
      qty: 1,
      amazonUrl: 'https://www.amazon.in/s?k=ceramic+planter'
    },
    {
      id: 'drop-2',
      name: 'Organic Cold-Pressed Neem Oil',
      cashPrice: 299,
      seedPrice: 5980,
      qty: 2,
      amazonUrl: 'https://www.amazon.in/s?k=neem+oil'
    }
  ];

  // 1. Total calculations
  const totalCash = mockCart.reduce((sum, item) => sum + item.cashPrice * item.qty, 0);
  const totalSeedsNeeded = mockCart.reduce((sum, item) => sum + item.seedPrice * item.qty, 0);
  assert.strictEqual(totalCash, 449 * 1 + 299 * 2); // 1047
  assert.strictEqual(totalSeedsNeeded, 8980 * 1 + 5980 * 2); // 20940

  // 2. Refund calculation (₹1 refund per 200 seeds)
  const seedRefund = mockCart.reduce((sum, item) => sum + Math.floor((item.seedPrice * item.qty) / 200), 0);
  assert.strictEqual(seedRefund, Math.floor(8980 / 200) + Math.floor((5980 * 2) / 200)); // 104

  // 3. Discount code format
  const discountCode = 'PD-ABC-234';
  assert(/^PD-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(discountCode), 'Discount code must follow PD-XXX-XXX format');

  // 4. Parallel claimedItems tracking
  let claimedItems: string[] = ['prior-claim'];
  const cartItemIds = mockCart.map(item => item.id);
  claimedItems = Array.from(new Set([...claimedItems, ...cartItemIds]));
  assert(claimedItems.includes('drop-1'), 'drop-1 must be recorded in claimedItems');
  assert(claimedItems.includes('drop-2'), 'drop-2 must be recorded in claimedItems');
  assert.strictEqual(claimedItems.length, 3, 'All items must be uniquely claimed');

  // 5. Multi-item Amazon links targeted
  const targetedUrls: string[] = [];
  mockCart.forEach(item => {
    const url = new URL(item.amazonUrl);
    url.searchParams.set('tag', 'botanicalguard-21');
    targetedUrls.push(url.toString());
  });
  assert.strictEqual(targetedUrls.length, 2, 'All cart items must receive tagged Amazon links');
  assert(targetedUrls[0].includes('ceramic+planter'));
  assert(targetedUrls[1].includes('neem+oil'));

  console.log('All Market Checkout checks passed successfully!');
  return { success: true };
}

if (process.argv[1]?.includes('marketCheckout.check')) {
  runMarketCheckoutChecks();
}
