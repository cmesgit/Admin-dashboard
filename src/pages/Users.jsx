import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { getUsers } from "../api/admin";
import StatusBadge from "../components/StatusBadge";
import "../css/Users.css";

const PAGE_SIZE = 25;

const Users = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const debounceRef = useRef(null);

  const fetchUsers = async (currentPage, currentSearch) => {
    setLoading(true);
    try {
      const params = { page: currentPage, page_size: PAGE_SIZE };
      if (currentSearch) params.search = currentSearch;
      if (roleFilter) params.role = roleFilter;
      if (verifiedFilter) params.is_verified = verifiedFilter;
      if (activeFilter) params.is_active = activeFilter;

      const data = await getUsers(params);
      setUsers(data.results || []);
      setTotalCount(data.count || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(page, search);
  }, [page, roleFilter, verifiedFilter, activeFilter]);

  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchUsers(1, val);
    }, 400);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">User Management</h1>

      <div className="users-controls">
        <div className="users-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by email, name, or username..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All Roles</option>
          <option value="STUDENT">Student</option>
          <option value="TEACHER">Teacher</option>
          <option value="ADMIN">Admin</option>
        </select>

        <select value={verifiedFilter} onChange={(e) => { setVerifiedFilter(e.target.value); setPage(1); }}>
          <option value="">Verified: All</option>
          <option value="true">Verified</option>
          <option value="false">Not Verified</option>
        </select>

        <select value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}>
          <option value="">Status: All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <div className="dashboard-card users-table-card">
        {loading ? (
          <div className="dashboard-loading">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="users-empty">No users found.</div>
        ) : (
          <>
            <div className="users-count">{totalCount} user{totalCount !== 1 ? "s" : ""} found</div>
            <table className="users-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Roles</th>
                  <th>Verified</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} onClick={() => navigate(`/users/${u.id}`)} className="users-row">
                    <td>{u.email}</td>
                    <td>{u.profile?.full_name || "—"}</td>
                    <td>
                      {u.roles?.length
                        ? u.roles.map((r) => (
                            <StatusBadge key={r} color="gray">{r}</StatusBadge>
                          ))
                        : "—"}
                    </td>
                    <td>
                      <StatusBadge color={u.is_verified ? "green" : "red"}>
                        {u.is_verified ? "Yes" : "No"}
                      </StatusBadge>
                    </td>
                    <td>
                      <StatusBadge color={u.is_active ? "green" : "red"}>
                        {u.is_active ? "Active" : "Inactive"}
                      </StatusBadge>
                    </td>
                    <td>{formatDate(u.date_joined)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="users-pagination">
          <button
            className="page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            &larr;
          </button>
          <span>Page {page} of {totalPages}</span>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .map((p, idx, arr) => {
              const prev = arr[idx - 1];
              const showEllipsis = prev && p - prev > 1;
              return (
                <span key={p}>
                  {showEllipsis && <span className="page-ellipsis">...</span>}
                  <button
                    className={`page-btn ${p === page ? "active" : ""}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                </span>
              );
            })}
          <button
            className="page-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            &rarr;
          </button>
        </div>
      )}
    </div>
  );
};

export default Users;
