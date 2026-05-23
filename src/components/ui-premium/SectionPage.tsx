import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { ListCardSkeleton } from "@/components/ui-premium/Skeletons";
import type { LucideIcon } from "lucide-react";

export function SectionPage({
  title,
  subtitle,
  hint,
  icon,
  emptyTitle,
  emptyDescription,
  action,
}: {
  title: string;
  subtitle?: string;
  hint?: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  action?: { label: string };
}) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  return (
    <PageContainer>
      <SectionHeader title={title} subtitle={subtitle} hint={hint} />
      {loading ? (
        <div className="space-y-2">
          <ListCardSkeleton />
          <ListCardSkeleton />
          <ListCardSkeleton />
        </div>
      ) : (
        <EmptyState
          icon={icon}
          title={emptyTitle}
          description={emptyDescription}
          action={action}
        />
      )}
    </PageContainer>
  );
}
