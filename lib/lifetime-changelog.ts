export const CHANGELOG_CATEGORIES = ["Added", "Changed", "Fixed", "Removed", "Security", "Operations"] as const;

export type ChangelogCategory = (typeof CHANGELOG_CATEGORIES)[number];

export type LifetimeChangelogEntry = {
  date: string;
  category: ChangelogCategory;
  title: string;
  detail: string;
};

const datePattern = /^## (\d{4}-\d{2}-\d{2})$/;
const categoryPattern = /^### (Added|Changed|Fixed|Removed|Security|Operations)$/;
const entryPattern = /^- \*\*(.+?)\*\*:\s*(.+)$/;

export function parseLifetimeChangelog(markdown: string): LifetimeChangelogEntry[] {
  const entries: LifetimeChangelogEntry[] = [];
  let currentDate: string | null = null;
  let currentCategory: ChangelogCategory | null = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    const dateMatch = line.match(datePattern);
    if (dateMatch) {
      currentDate = dateMatch[1];
      currentCategory = null;
      continue;
    }

    const categoryMatch = line.match(categoryPattern);
    if (categoryMatch && currentDate) {
      currentCategory = categoryMatch[1] as ChangelogCategory;
      continue;
    }

    const entryMatch = line.match(entryPattern);
    if (!entryMatch || !currentDate || !currentCategory) continue;

    entries.push({
      date: currentDate,
      category: currentCategory,
      title: entryMatch[1],
      detail: entryMatch[2],
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
