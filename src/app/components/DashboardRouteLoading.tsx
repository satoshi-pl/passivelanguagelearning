type Props = {
  title: string;
  subtitle?: string;
};

function SkeletonLine({ width }: { width: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 12,
        width,
        borderRadius: 999,
        background: "color-mix(in srgb, var(--foreground) 10%, transparent)",
      }}
    />
  );
}

export default function DashboardRouteLoading({ title, subtitle }: Props) {
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
        <div className="pll-card-inner" style={{ width: "100%", maxWidth: 940, margin: "0 auto" }}>
          <div
            aria-hidden="true"
            style={{
              width: 130,
              height: 14,
              borderRadius: 999,
              background: "color-mix(in srgb, var(--foreground) 12%, transparent)",
            }}
          />

          <div style={{ marginTop: 18 }}>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(2rem, 4.6vw, 2.125rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              {title}
            </h1>
            {subtitle ? (
              <div style={{ marginTop: 8, color: "var(--foreground-muted)", fontSize: 15 }}>{subtitle}</div>
            ) : null}

            <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <SkeletonLine width="120px" />
                <SkeletonLine width="170px" />
                <SkeletonLine width="120px" />
              </div>
              <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
                <SkeletonLine width="100%" />
                <SkeletonLine width="100%" />
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", maxWidth: 360 }}>
                <SkeletonLine width="48%" />
                <SkeletonLine width="48%" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
