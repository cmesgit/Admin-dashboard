import test from 'node:test';
import assert from 'node:assert/strict';
import { announcementStart, isoToLocalInput, localInputToIso } from './datetimeLocal.js';
process.env.TZ = 'Asia/Kolkata';

test('clearing a scheduled advertisement starts it now instead of retaining its old window', () => {
  const now = '2026-10-16T16:00:00.000Z';
  const old = announcementStart('2026-10-17T12:00', true);
  assert.ok(new Date(old) > new Date(now));
  const cleared = announcementStart('', true, () => now);
  assert.equal(cleared, now);
  assert.ok(new Date(cleared) < new Date('2026-10-18T00:00:00Z'));
  assert.equal(announcementStart('', false), undefined);
});
test('local date editing preserves IST dates across midnight and optional end dates clear', () => {
  const iso = '2026-10-15T19:30:00.000Z';
  assert.equal(isoToLocalInput(iso), '2026-10-16T01:00');
  assert.equal(localInputToIso(isoToLocalInput(iso)), iso);
  assert.equal(announcementStart('2026-10-16T01:00', true), iso);
  assert.equal(localInputToIso(''), null);
});
