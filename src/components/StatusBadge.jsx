const colors = {
  green: { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
  red: { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
  yellow: { bg: "#fefce8", text: "#854d0e", border: "#fef08a" },
  gray: { bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" },
};

const StatusBadge = ({ color = "gray", children }) => {
  const c = colors[color] || colors.gray;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: "12px",
        fontSize: "0.78rem",
        fontWeight: 600,
        backgroundColor: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    >
      {children}
    </span>
  );
};

export default StatusBadge;
