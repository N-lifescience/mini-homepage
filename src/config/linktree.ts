export const profile = {
  teacherName: "N의 생명과학",
  title: "N의 생명과학",
  introTitle: "N의 생명과학",
  introDescription: "N의 상상을 더한 N가지 생명과학 이야기",
  catalogTitle: "N의 생명과학",
  catalogDescription: "N의 상상을 더한 N가지 생명과학 이야기",
  /* 왼쪽 프로필 사진입니다. public/assets/ 안에 파일을 넣고 경로를 적으세요. */
  photo: { src: "/assets/profile-n.jpg", alt: "N의 생명과학 프로필 사진" },
  /* 홈 탭 위쪽 미니룸 이미지입니다. public/assets/ 안에 파일을 넣고 경로를 적으세요. */
  miniroom: { src: "/assets/miniroom-bg-cyberpunk.jpg", alt: "사이버펑크 랩 미니룸" },
  /* 아래는 탭 이름표입니다. 나만의 이름으로 바꿔도 되고, 안 바꾸면 기본값 그대로 나옵니다. */
  storyLabel: "연재물",
  boardLabel: "게시판",
  boardSubtitle: "앱과 게시글",
  boardEmptyText: "아직 올린 글이 없습니다.",
  photoLabel: "사진첩",
  photoSubtitlePrefix: "사진",
  /* 오른쪽 위, 옛날 싸이월드 주소창을 흉내 낸 문구입니다. */
  displayUrl: "n-lifescience.github.io/mini-homepage/"
};

/* 프로필 탭에 들어가는 소개 글입니다. 문구만 바꿔서 쓰세요. */
export type ProfileBlock =
  | { kind: "text"; lines: string[] }
  | { kind: "list"; heading: string; items: string[] }
  | { kind: "contact"; items: { label: string; value: string; href: string }[] };

export type ProfileSection = {
  id: string;
  title: string;
  /* 제목 옆 작은 글씨입니다. 생략하면 제목만 나옵니다. */
  subtitle?: string;
  blocks: ProfileBlock[];
};

export const profileSections: ProfileSection[] = [
  {
    id: "intro",
    title: "소개",
    blocks: [
      {
        kind: "text",
        lines: [
          "N의 상상을 더한, N가지 생명과학 이야기!",
          "수업에 활용할 수 있는 다양한 것들을 만들고,",
          "실제 수업 적용을 통해,",
          "꾸준히 업데이트를 진행하고 있습니다."
        ]
      }
    ]
  }
];

/* 미요툰 회차는 src/config/miyotoon.ts 에 있습니다. */
export { episodes, type Episode } from "./miyotoon";

/* 미요앱 탭입니다. 앱과 게시글 링크를 여기에 추가하세요.
   preview 는 화면 미리보기 이미지입니다. public/assets/apps 에 넣고 경로를 적으세요.
   생략하면 썸네일 없이 제목만 나옵니다. */
export type BoardPost = {
  id: string;
  category: "앱" | "글";
  title: string;
  summary?: string;
  date: string;
  href: string;
  preview?: { src: string; alt: string };
};

export const boardPosts: BoardPost[] = [
  {
    id: "virtual-biolab",
    category: "앱",
    title: "생명과학 가상 실험실",
    date: "2026-08-30",
    href: "https://virtual-biolab.vercel.app/"
  },
  {
    id: "cell-metabolism-quiz-library",
    category: "앱",
    title: "[세포와 물질대사] 형성평가 라이브러리 - 생명공학연구소",
    date: "2026-08-20",
    href: "https://script.google.com/macros/s/AKfycbwEOr3svUleGebhDrPGskPmUWdFYRn3aEVvy-K7FrwnXEET9AoeLeauq7ENCHsFk2tj9A/exec"
  },
  {
    id: "cell-metabolism-intro-activity-library",
    category: "앱",
    title: "[세포와 물질대사] 도입 활동지 라이브러리 - What IF?!",
    date: "2026-08-10",
    href: "https://script.google.com/macros/s/AKfycbzlOZS-51yY4oxX7d3-_j-qM5XmlHSXEFYYwhroJlNyiDbFVgl-pIhAHtzzFL8IOmYI/exec"
  },
  {
    id: "cell-escape",
    category: "앱",
    title: "[세포와 물질대사] 대단원 방탈출 - 세포 이스케이프 : 항상성 붕괴",
    date: "2026-07-30",
    href: "https://cell-escape.netlify.app/"
  },
  {
    id: "suhaeng-biology-archive",
    category: "앱",
    title: "2026 생명과학 수행평가 아이디어 아카이브",
    date: "2026-07-15",
    href: "https://suhaeng-biology.vercel.app/"
  },
  {
    id: "shape-inference-ai",
    category: "앱",
    title: "형태추론 AI",
    date: "2026-06-30",
    href: "https://macmini.tail10f794.ts.net/"
  },
  {
    id: "vibe-coding-workshop",
    category: "앱",
    title: "바이브코딩 제도실",
    date: "2026-06-15",
    href: "https://script.google.com/macros/s/AKfycbwPq15yiNlOKImjVZdz9HMISmHCqvzs0g_8K3QON7CtR12gQzVqc4PVn0-LxjHFIVob4A/exec"
  }
];

/* 사진첩 탭입니다. */
export type PhotoItem = {
  id: string;
  name: string;
  src: string;
};

export const photos: PhotoItem[] = [];

/* 왼쪽 아래 파도타기 목록입니다.
   고정 규칙: 첫 번째 항목은 반드시 "도름스 커뮤니티 나의 활동" 링크입니다. 지우지 마세요. */
export type WaveLink = {
  id: string;
  label: string;
  href: string;
};

export const waveLinks: WaveLink[] = [
  { id: "dorms-activity", label: "도름스 커뮤니티 나의 활동", href: "https://dorms.school/u/7b38a24d-02e2-44cd-a6f5-0d85ef80b55d" },
  { id: "instagram", label: "인스타그램", href: "https://www.instagram.com/n_life_science" },
  { id: "naver-blog", label: "블로그", href: "https://blog.naver.com/n_lifescience" }
];

/* 미니홈피 BGM 입니다. 유튜브 영상을 음원으로 씁니다.
   videoId 는 https://www.youtube.com/watch?v=abcd1234XYZ 에서 v= 뒤에 오는 값입니다.
   배열을 비우면 플레이어가 아예 표시되지 않습니다.

   여러 곡이 이어진 플레이리스트 영상이라면, 같은 videoId 를 쓰면서 startAt 에
   각 곡이 시작하는 지점을 초 단위로 적으세요. 제목을 누르면 그 지점부터 재생됩니다.
   startAt 은 secondsAt("3:21") 처럼 적으면 편합니다. */
export type BgmTrack = {
  id: string;
  title: string;
  artist?: string;
  videoId: string;
  /* 영상 안에서 이 곡이 시작하는 지점입니다. 초 단위이고, 생략하면 처음부터입니다. */
  startAt?: number;
};

/* "3:21" 이나 "1:02:30" 을 초로 바꿔 줍니다. */
export function secondsAt(timestamp: string): number {
  return timestamp
    .split(":")
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0);
}

export const bgmTracks: BgmTrack[] = [
  { id: "die-for-you", title: "Die For You", artist: "The Weeknd & Ariana Grande", videoId: "b8EYaOwq2Fo" }
];

/* 홈 탭 아래쪽 한마디입니다. */
export type GuestbookEntry = {
  id: number;
  author: string;
  text: string;
  date: string;
};

export const guestbook: GuestbookEntry[] = [
  { id: 1, author: "N의 생명과학", text: "안녕하세요, N의 생명과학입니다. 반갑습니다!", date: "2026-08-30" }
];
