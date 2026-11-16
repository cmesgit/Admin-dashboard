// Admin API for Explore community verification.
// Spec: shiksha-backend/docs/EXPLORE_VERIFICATION.md §5.
//
// ⚠ Every endpoint 404s unless BOTH are true: the feature flag is on, and the
// caller is a superuser or holds an active ADMIN role. `is_staff` is NOT
// enough — content editors carry it for CMS work, and it must not also hand
// them the switch that decides what the whole library counts as checked.
//
// Because both failures are a 404, a screen cannot tell "feature off" from
// "you are not an admin" — which is deliberate, and why `verificationOff()`
// below is phrased as one condition rather than two.
import api from "./apiClient";

const root = "/explore/verification/admin";

export const getSettings = async () => (await api.get(`${root}/settings/`)).data;
export const saveSettings = async patch => (await api.patch(`${root}/settings/`, patch)).data;

export const getReviewers = async () => (await api.get(`${root}/reviewers/`)).data;
export const reviewerAction = async (specId, action) =>
  (await api.post(`${root}/reviewers/${specId}/${action}/`, {})).data;

export const getAttention = async () => (await api.get(`${root}/attention/`)).data;
export const attentionAction = async (docId, action, body = {}) =>
  (await api.post(`${root}/attention/${docId}/${action}/`, body)).data;

export const getEligibleReviewers = async docId =>
  (await api.get(`${root}/sets/${docId}/reviewers/`)).data;

export const verificationOff = error => error?.response?.status === 404;

export const verificationError = error => {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  return (
    Object.values(data || {}).flat().find(v => typeof v === "string")
    || "Couldn’t complete the request. Please try again."
  );
};
