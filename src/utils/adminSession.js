// Cached account data cannot establish which cookie identity is active now.
// A single bootstrap flight is shared by StrictMode's duplicate mount effect.
export function adminSessionLoader(api) {
  let pending = null;
  const load = async () => {
    let data;
    try {
      ({ data } = await api.get('/accounts/me/', { timeout: 10000 }));
    } catch (error) {
      if (error.response?.status === 403) return null;
      if (error.response?.status !== 401) throw error;
      try {
        await api.post('/accounts/refresh/', {}, { timeout: 10000 });
        ({ data } = await api.get('/accounts/me/', { timeout: 10000 }));
      } catch (retryError) {
        if ([401, 403].includes(retryError.response?.status)) return null;
        throw retryError;
      }
    }
    return Array.isArray(data?.roles) && data.roles.some((role) => String(role).toUpperCase() === 'ADMIN') ? data : null;
  };
  return () => {
    if (!pending) pending = load().finally(() => { pending = null; });
    return pending;
  };
}
