export default function RouteLoadingCard() {
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
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: "min(460px, 70%)",
                height: 10,
                borderRadius: 999,
                background:
                  "linear-gradient(90deg, rgba(148,163,184,0.14) 0%, rgba(148,163,184,0.22) 40%, rgba(148,163,184,0.14) 80%)",
                backgroundSize: "200% 100%",
                animation: "pll-sheen 900ms ease-in-out infinite",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

