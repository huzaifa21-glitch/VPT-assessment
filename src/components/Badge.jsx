const styles = {
  active: 'bg-emerald-50 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-500',
  urgent: 'bg-rose-50 text-rose-700',
  neutral: 'bg-slate-100 text-slate-600',
};

export function Badge({ tone = 'neutral', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        styles[tone] || styles.neutral
      }`}
    >
      {children}
    </span>
  );
}
