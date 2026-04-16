type Props = {
  text?: string;
};

export default function PracticeStatusCard({ text }: Props) {
  return (
    <div className="pll-card-inner mx-auto max-w-3xl lg:max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="rounded-2xl border border-black/10 bg-white/80 p-5 sm:p-6">
        {text ? (
          <div className="text-sm opacity-70">{text}</div>
        ) : (
          <div
            aria-hidden="true"
            style={{
              height: 10,
              borderRadius: 999,
              width: "min(420px, 70%)",
              background:
                "linear-gradient(90deg, rgba(148,163,184,0.12) 0%, rgba(148,163,184,0.2) 40%, rgba(148,163,184,0.12) 80%)",
              backgroundSize: "200% 100%",
              animation: "pll-sheen 900ms ease-in-out infinite",
            }}
          />
        )}
      </div>
    </div>
  );
}
