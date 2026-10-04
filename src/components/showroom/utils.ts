import type { BoardPost } from "@/lib/site-content";
import { showroomAssignments, showroomCopy } from "@/config/showroom/content";

export type ShowItem = {
  id: string;
  name: string;
  tag: string;
  description?: string;
  href: string;
  groupName: string;
  art: "lab" | "cell" | "notes";
};
export type OpenCard = { item: ShowItem; layoutId: string; trigger: HTMLElement | null };
export const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
export const newTabProps = (href: string) => href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {};

export function exhibitionGroups(posts: BoardPost[]) {
  const buckets = new Map(showroomCopy.groups.map(group => [group.id, [] as (ShowItem & { order: number })[]]));
  for (const post of posts) {
    // Internal network links are already in the homepage; do not expose them in the exhibition.
    let url: URL;
    try {
      url = new URL(post.href);
      if (!["https:", "http:"].includes(url.protocol) || url.hostname.endsWith(".ts.net")) continue;
    } catch { continue; }
    const assignment = showroomAssignments[post.id] ?? showroomAssignments[url.hostname];
    const group = showroomCopy.groups.find(group => group.id === (assignment?.group ?? "other"))!;
    buckets.get(group.id)!.push({
      id: post.id, name: post.title, tag: assignment?.tag ?? post.category, description: post.summary,
      href: post.href, groupName: group.title,
      art: assignment?.art ?? "notes", order: assignment?.order ?? 100
    });
  }
  return showroomCopy.groups.map(group => ({ ...group, items: buckets.get(group.id)!.sort((a, b) => a.order - b.order) })).filter(group => group.items.length);
}
