/**
 * src/config/urls.js — admin app URLs, mirroring the other apps' detection so
 * the admin panel works on dev.shikshacom.com (and localhost) with no env vars.
 *
 * API_URL always includes /api. Override with VITE_API_URL (must include /api).
 */
const host = typeof window !== "undefined" ? window.location.hostname : "";
const isDev =
  host === "dev.shikshacom.com" ||
  host.endsWith(".dev.shikshacom.com") ||
  host === "localhost" ||
  host === "127.0.0.1" ||
  /^192\.168\.\d+\.\d+$/.test(host) ||
  /^10\.\d+\.\d+\.\d+$/.test(host);

const PROD = {
  HOME: "https://www.shikshacom.com",
  APP: "https://app.shikshacom.com",
  TEACHER: "https://teacher.shikshacom.com",
  API: "https://api.shikshacom.com/api",
};

const DEV = {
  HOME: "https://dev.shikshacom.com",
  APP: "https://app.dev.shikshacom.com",
  TEACHER: "https://teacher.dev.shikshacom.com",
  API: "https://api.dev.shikshacom.com/api",
};

const ENV = isDev ? DEV : PROD;
const clean = (s) => s.replace(/\/$/, "");

export const HOME_URL = clean(import.meta.env.VITE_HOME_URL || ENV.HOME);
export const APP_URL = clean(import.meta.env.VITE_APP_URL || ENV.APP);
export const TEACHER_URL = clean(import.meta.env.VITE_TEACHER_URL || ENV.TEACHER);
export const API_URL = clean(import.meta.env.VITE_API_URL || ENV.API);
