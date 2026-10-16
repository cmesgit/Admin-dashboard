import test from 'node:test';
import assert from 'node:assert/strict';
import { courseCardPreview, validateCourseCard } from './courseCardEditor.js';
const form = { title: 'My course', level_label: 'Foundation', fact_line: 'Live classes', price_label: '500', gradient_css: '#000,#fff', order: 0, course: 7, board: '', use_own_details: false, coming_soon_override: null, image_url: 'manual.jpg' };

test('linked free courses use their actual details and launch status', () => {
  const p = courseCardPreview(form, { title: 'Linked title', price: 0, thumbnail: 'course.jpg', status: 'COMING_SOON' }, null, null, 'old.jpg');
  assert.deepEqual(p, { title: 'Linked title', price: 'Free', image: 'course.jpg', soon: true });
});
test('own details override linked copy and artwork while launch state follows the course', () => {
  const p = courseCardPreview({ ...form, use_own_details: true }, { title: 'Linked title', price: 150000, thumbnail: 'course.jpg', status: 'COMING_SOON' }, null, 'new.jpg', 'old.jpg');
  assert.deepEqual(p, { title: 'My course', price: '500', image: 'new.jpg', soon: true });
  assert.equal(courseCardPreview({ ...form, coming_soon_override: false }, { status: 'COMING_SOON' }).soon, false);
});
test('boards have no invented price and course prices are in paise', () => {
  const p = courseCardPreview({ ...form, course: '', board: 2 }, null, { name: 'CBSE', logo: 'board.jpg', is_active: false });
  assert.deepEqual(p, { title: 'CBSE', price: '', image: 'board.jpg', soon: true });
  assert.equal(courseCardPreview(form, { price: 150099 }).price, '₹1,500/month');
  assert.equal(courseCardPreview(form, { title: 'Loading' }).price, '');
});
test('required fields, order and JSON objects are validated without dropping advanced values', () => {
  assert.deepEqual(validateCourseCard(form, '{"selectedBoard":"cbse"}'), { errors: {}, linkState: { selectedBoard: 'cbse' } });
  for (const raw of ['[]', 'null', 'false', 'oops']) assert.ok(validateCourseCard(form, raw).errors.link_state);
  assert.deepEqual(Object.keys(validateCourseCard({ ...form, title: '', level_label: '', fact_line: '', order: -1, gradient_css: '' }, '{}').errors), ['title', 'level_label', 'fact_line', 'gradient_css', 'order']);
});
