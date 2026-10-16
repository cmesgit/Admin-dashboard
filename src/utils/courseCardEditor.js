// Match PublicFeaturedView's precedence without mutating stored manual values.
export function courseCardPreview(form, course, board, uploadedImage, storedImage) {
  const follows = !form.use_own_details;
  const detailCourse = follows ? course : null;
  const detailBoard = follows && !form.course ? board : null;
  const ownImage = uploadedImage || storedImage || form.image_url || null;
  return {
    title: detailCourse?.title || detailBoard?.name || form.title,
    price: detailCourse ? (detailCourse.price == null ? '' : Number(detailCourse.price) ? `₹${Math.floor(Number(detailCourse.price) / 100).toLocaleString('en-IN')}/month` : 'Free')
      : detailBoard ? '' : form.price_label,
    image: detailCourse?.thumbnail || detailBoard?.logo || ownImage,
    soon: form.coming_soon_override !== null && form.coming_soon_override !== ''
      ? form.coming_soon_override === true || form.coming_soon_override === 'true'
      : form.course ? course?.status === 'COMING_SOON' : form.board ? board?.is_active === false : false,
  };
}

export function validateCourseCard(form, linkStateText) {
  const errors = {};
  for (const [key, label, max] of [['title', 'Card title', 120], ['level_label', 'Short label', 40], ['fact_line', 'Course summary', 80]]) {
    if (!form[key].trim()) errors[key] = `Enter a ${label.toLowerCase()}.`;
    else if (form[key].length > max) errors[key] = `Keep ${label.toLowerCase()} to ${max} characters.`;
  }
  if (!form.gradient_css.trim()) errors.gradient_css = 'Choose a background colour or restore the default.';
  if (!/^\d+$/.test(String(form.order)) || Number(form.order) > 32767) errors.order = 'Use a whole number from 0 to 32767.';
  let linkState;
  try {
    linkState = JSON.parse(linkStateText.trim() || '{}');
    if (!linkState || Array.isArray(linkState) || typeof linkState !== 'object') throw new Error();
  } catch {
    errors.link_state = 'Use a JSON object, such as {}. Your existing settings have been kept.';
  }
  return { errors, linkState };
}
