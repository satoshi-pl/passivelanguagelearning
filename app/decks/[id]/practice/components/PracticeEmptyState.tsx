type Props = {
  title: string;
  text: string;
  onBack: () => void;
  actionLabel?: string;
};

export default function PracticeEmptyState({
  title,
  text,
  onBack,
  actionLabel = "Go back",
}: Props) {
  return (
    <div className="pll-card-inner mx-auto max-w-3xl lg:max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="rounded-2xl border border-black/10 bg-white/80 p-5 sm:p-6">
        <div className="text-lg font-semibold sm:text-xl">{title}</div>
        <div className="mt-2 text-sm opacity-70">{text}</div>

        <div className="mt-5">
          <button
            type="button"
            onClick={onBack}
            className="min-h-11 rounded-xl border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
