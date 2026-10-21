import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderProductSharePage } from '../../../api/_lib/share-page';

test('share page escapes seller-controlled text and only allows https images', () => {
  const html = renderProductSharePage('https://bazare.example', {
    id: 'abc', name: '"><script>alert(1)</script>', price: 1200, description: '<img src=x onerror=alert(1)>',
    imageUrl: 'javascript:alert(1)', sellerName: 'S',
  });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('og:image'));
  assert.match(html, /og:title/);
  assert.match(html, /product\.html\?id=abc/);
});

test('share page includes og:image for https images', () => {
  const html = renderProductSharePage('https://bazare.example', { id: 'abc', name: 'Panjabi', price: 500, imageUrl: 'https://res.cloudinary.com/x/a.jpg' });
  assert.match(html, /og:image" content="https:\/\/res\.cloudinary\.com\/x\/a\.jpg"/);
});
