// The showroom reads the same published posts as the mini homepage.
export const showroomCopy = {
  title: "생명과학, 펼쳐 보다.",
  scroll: "아래로 스크롤해 보세요",
  phases: [
    { label: "DOUBLE HELIX", title: "생명과학, 펼쳐 보다.", description: "N의 상상을 더한 N가지 생명과학 이야기" },
    { label: "UNWIND", title: "꼬임을 풀고", description: "두 가닥 사이에 담긴 이야기를 펼칩니다." },
    { label: "TRANSCRIBE", title: "새로운 가닥을 따라", description: "작은 질문 하나에서 수업의 아이디어가 자라납니다." }
  ],
  catalogTitle: "수업에서 만나는 생명과학",
  catalogDescription: "직접 만든 앱과 자료를 둘러보세요.",
  groups: [
    { id: "learning", title: "탐구·개념 학습", description: "가상 실험과 귀추적 사고 연습, AI 튜터로 배우는 생명과학" },
    { id: "games", title: "학습 게임", description: "방탈출과 꾸준한 학습을 위한 게임" },
    { id: "materials", title: "활동지·평가", description: "도입 활동지부터 형성평가와 수행평가까지" },
    { id: "coding", title: "코딩 연습", description: "자연어로 표현하며 익히는 바이브코딩" },
    { id: "other", title: "그 밖의 작업", description: "새로 추가한 앱과 글" }
  ]
};

// Curate each work by its purpose. Titles and publication order can change in the editor.
// Stable post IDs cover the original works; hostnames cover the newly published apps.
type Assignment = { group: string; tag: string; art: "lab" | "cell" | "notes"; order: number };
export const showroomAssignments: Record<string, Assignment> = {
  "virtual-biolab": { group: "learning", tag: "가상 실험", art: "lab", order: 10 },
  "thinking-loop.vercel.app": { group: "learning", tag: "귀추적 사고", art: "cell", order: 20 },
  "life-definition.vercel.app": { group: "learning", tag: "AI 튜터", art: "cell", order: 30 },
  "cell-escape": { group: "games", tag: "방탈출", art: "cell", order: 10 },
  "life-island.vercel.app": { group: "games", tag: "학습 게임", art: "cell", order: 20 },
  "cell-metabolism-intro-activity-library": { group: "materials", tag: "도입 활동지", art: "notes", order: 10 },
  "cell-metabolism-quiz-library": { group: "materials", tag: "형성평가", art: "notes", order: 20 },
  "suhaeng-biology-archive": { group: "materials", tag: "수행평가", art: "notes", order: 30 },
  "vibe-coding-workshop": { group: "coding", tag: "바이브코딩", art: "notes", order: 10 }
};
