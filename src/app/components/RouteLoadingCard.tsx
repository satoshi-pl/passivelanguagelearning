export default function RouteLoadingCard({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="pll-workspace" style={{ maxWidth: 1040, margin: "24px auto", padding: "0 16px" }}>
      <div
        className="pll-primary-card"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 16,
          background: "var(--surface-solid)",
          color: "var(--foreground)",
          padding: 18,
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="pll-card-inner" style={{ width: "100%", maxWidth: 920, margin: "0 auto" }}>
          <div
            style={{
              minHeight: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--foreground-muted)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

