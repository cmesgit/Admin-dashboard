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

// The API may accept some sections and reject others in the same 200 response.
// A partial rejection must keep pending edits and prevent navigation/publishing.
export function assertDraftAccepted(data) {
  const rejected = data?.rejected || {};
  if (Object.keys(rejected).length) {
    const detail = `Some edits need attention: ${Object.values(rejected).join(" ")}`;
    const error = new Error(detail);
    error.response = { data: { detail } };
    throw error;
  }
  return data;
}
