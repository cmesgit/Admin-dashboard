// Serialize requests so a slower, older save cannot land after a newer one.
export function createSaveQueue() {
  let tail = Promise.resolve();
  return (operation) => {
    const next = tail.then(operation);
    tail = next.catch(() => {});
    return next;
  };
}

// Newer values win, including intentional empty strings.
export function mergeSectionEdits(base, extra) {
  const out = { ...base };
  for (const [section, fields] of Object.entries(extra || {})) {
    out[section] = { ...(out[section] || {}), ...fields };
  }
  return out;
}
