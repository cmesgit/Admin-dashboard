import api from "./apiClient";
const root = "/explore/research/";
export const listResearch = async params => (await api.get(root, { params: { ...params, scope: "admin" } })).data;
export const getResearch = async id => (await api.get(`${root}${id}/`)).data;
export const actResearch = async (id, data) => (await api.post(`${root}${id}/`, data)).data;
export const listReviewers = async () => (await api.get(`${root}reviewers/`, { params: { scope: "admin" } })).data;
export const approveReviewer = async (id, approved) => (await api.patch(`${root}reviewers/${id}/`, { approved })).data;
export async function researchDownload(path, version) {
  const { data } = await api.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a"); link.href = url; link.download = `research-v${version}.pdf`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const researchError = error => {
  const data = error?.response?.data;
  return typeof data?.detail === "string" ? data.detail : Object.values(data || {}).flat().find(v => typeof v === "string") || "Couldn’t complete the request. Please try again.";
};
