import { CollectionsSection } from '@/components/collections/collections-section';

export default function CollectionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Collections</h1>
        <p className="text-muted-foreground mt-2">
          Organize your bookmarks into collections
        </p>
      </div>

      <CollectionsSection showHeader={false} />
    </div>
  );
}
