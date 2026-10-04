import type { SiteContent } from "./site-content";

/** Compare values rather than Firestore's map field order. */
export function contentFingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(contentFingerprint).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${contentFingerprint(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function safeHref(value: string): boolean {
  if (!value) return true;
  try {
    return ["https:", "http:", "mailto:", "tel:"].includes(new URL(value).protocol);
  } catch { return false; }
}

export function validateContent(content: SiteContent): string | null {
  if (!content.profile.teacherName.trim() || !content.profile.introTitle.trim()) {
    return "이름과 첫 화면 제목을 입력해 주세요.";
  }
  if (content.tabs.some(tab => !tab.label.trim())) return "탭 이름을 입력해 주세요.";
  if (new Set(content.tabs.map(tab => tab.id)).size !== content.tabs.length) return "탭이 중복됐어요. 다시 확인해 주세요.";
  if (!content.tabs.some(tab => tab.kind === "home")) return "홈 탭은 남겨 주세요.";
  if (content.waveLinks[0]?.id !== "dorms-activity" || content.waveLinks[0]?.label !== "도름스 커뮤니티 나의 활동") {
    return "파도타기 첫 링크는 도름스 커뮤니티 나의 활동이어야 합니다.";
  }
  const links = [...content.waveLinks, ...content.boardPosts,
    ...Object.values(content.blocks).flat().filter(block => block.type === "link")];
  if (links.some(link => !safeHref(link.href))) return "링크 주소를 확인해 주세요. https://로 시작하는 주소를 사용할 수 있어요.";
  if (new TextEncoder().encode(JSON.stringify(content)).length > 900_000) {
    return "내용이 너무 많아요. 글을 조금 줄인 뒤 저장해 주세요.";
  }
  return null;
}
