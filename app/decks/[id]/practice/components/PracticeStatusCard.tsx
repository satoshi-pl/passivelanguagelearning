type Props = {
  text: string;
};

export default function PracticeStatusCard({ text }: Props) {
  return (
    <div className="mx-auto max-w-3xl lg:max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="rounded-2xl border border-black/10 bg-white/80 p-5 sm:p-6">
        <div className="text-sm opacity-70">{text}</div>
      </div>
    </div>
  );
}
