import { SectionHeader } from './SectionHeader';

export function DataActionCard({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="tds-card p-5">
      <SectionHeader title={title} description={description} />
      <div className="mt-4 flex flex-col gap-2">
        {children}
      </div>
    </section>
  );
}
