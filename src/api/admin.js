import { mockStats, mockUsers } from "../data/mockData";

// In-memory copy so updates persist during session
let users = JSON.parse(JSON.stringify(mockUsers));

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const getStats = async () => {
  await delay();
  return { ...mockStats };
};

export const getUsers = async (params = {}) => {
  await delay();
  let filtered = [...users];

  // Search
  const search = (params.search || "").toLowerCase();
  if (search) {
    filtered = filtered.filter(
      (u) =>
        u.email.toLowerCase().includes(search) ||
        u.username.toLowerCase().includes(search) ||
        (u.profile?.full_name || "").toLowerCase().includes(search)
    );
  }

  // Role filter
  if (params.role) {
    filtered = filtered.filter((u) =>
      u.roles.includes(params.role.toUpperCase())
    );
  }

  // Verified filter
  if (params.is_verified !== undefined && params.is_verified !== "") {
    const val = params.is_verified === "true" || params.is_verified === true;
    filtered = filtered.filter((u) => u.is_verified === val);
  }

  // Active filter
  if (params.is_active !== undefined && params.is_active !== "") {
    const val = params.is_active === "true" || params.is_active === true;
    filtered = filtered.filter((u) => u.is_active === val);
  }

  // Pagination
  const page = parseInt(params.page) || 1;
  const pageSize = parseInt(params.page_size) || 25;
  const start = (page - 1) * pageSize;

  return {
    results: filtered.slice(start, start + pageSize),
    count: filtered.length,
  };
};

export const getUser = async (id) => {
  await delay();
  const user = users.find((u) => u.id === id);
  if (!user) throw new Error("User not found");
  return { ...user };
};

export const updateUser = async (id, data) => {
  await delay();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error("User not found");

  if ("is_active" in data) users[idx].is_active = data.is_active;
  if ("is_verified" in data) users[idx].is_verified = data.is_verified;

  return { ...users[idx] };
};
