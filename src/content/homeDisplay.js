// Canonical: shared/src/content/homeDisplay.js. Synced into the public site
// and admin preview. Missing modes preserve the pre-existing render contract.
import defaults from "./homeDefaults.json" with { type: "json" };
export const HOME_DEFAULTS = defaults;
export const displayKey = (field) => field.startsWith("cta_primary_") ? "cta_primary"
  : field.startsWith("cta_secondary_") ? "cta_secondary" : field === "img" ? "image" : field;
export function homeField(section, block, field) {
  const fallback = HOME_DEFAULTS[section]?.[field] ?? "";
  const mode = block?.display_settings?.[displayKey(field)];
  if (mode === "hidden") return "";
  if (mode === "default" || !block) return fallback;
  const value = block[field];
  if (mode === "custom") return value ?? "";
  if (field === "heading_secondary" && section?.startsWith("about_")) return value ?? fallback;
  if (field === "heading_secondary" && section === "contact_hero") return value || (block.heading ? "" : fallback);
  return value || fallback;
}
export function collectionMode(block, key, rows) {
  return block?.display_settings?.[key] || (rows.length ? "custom" : "default");
}
export function homeCollection(block, key, rows, fallback) {
  const mode = block?.display_settings?.[key];
  if (mode === "hidden") return [];
  if (mode === "custom") return rows;
  if (mode === "default") return fallback;
  return rows.length ? rows : fallback;
}
export function previewContent(section, block) {
  const keys = new Set([...Object.keys(HOME_DEFAULTS[section] || {}), "body", "img"]);
  const values = Object.fromEntries([...keys].map((field) => [field, homeField(section, block, field)]));
  if (section?.startsWith("about_") && values.body) values.subhead = "";
  return values;
}
