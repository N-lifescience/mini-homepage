"use client";

/* 미니홈피에서 "주인장이 화면에서 직접 고칠 수 있는 것" 을 모아 둔 저장소입니다.

   - 내용은 Firestore 문서 하나(site/content)에 통째로 들어갑니다.
   - 아직 아무것도 저장하지 않았다면 src/config/*.ts 의 값이 그대로 기본값이 됩니다.
     즉 편집을 한 번도 안 해도 지금과 똑같이 보입니다.
   - 사진은 문서 크기 제한(1MB) 때문에 본문에 같이 넣지 않고, images 컬렉션에
     한 장씩 따로 저장한 뒤 블록에서는 그 id 만 가리킵니다. */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc
} from "firebase/firestore";
import { currentUser, getStore, isGuestbookEnabled, subscribeAuthState } from "./firebase";
import {
  boardPosts as staticBoardPosts,
  photos as staticPhotos,
  profile as staticProfile,
  profileSections as staticProfileSections,
  waveLinks as staticWaveLinks
} from "@/config/linktree";

export const isEditableSiteEnabled = isGuestbookEnabled;

/* ------------------------------------------------------------------ */
/* 내용의 모양                                                          */
/* ------------------------------------------------------------------ */

/* year 는 "연도별 보기" 에서 묶는 기준입니다. 비워 두면 "기타" 로 모입니다. */
type BlockBase = { id: string; year?: string };

export type ContentBlock =
  | (BlockBase & { type: "heading"; text: string })
  | (BlockBase & { type: "text"; text: string })
  | (BlockBase & { type: "link"; label: string; href: string })
  | (BlockBase & { type: "image"; imageId: string; caption: string });

export type TabKind = "home" | "profile" | "board" | "photo" | "guestbook" | "custom";

/* 탭 내용을 어떻게 보여 줄지입니다.
   - list: 글 흐름대로 세로로
   - album: 사진첩처럼 격자로
   - year: 연도별로 묶어서 */
export type TabView = "list" | "album" | "year";

export type TabDef = {
  id: string;
  label: string;
  kind: TabKind;
  /* 주인장이 정한 기본 보기. 방문자는 화면에서 잠깐 바꿔 볼 수 있습니다. */
  view?: TabView;
};

export type BoardPost = {
  id: string;
  category: string;
  title: string;
  summary: string;
  date: string;
  href: string;
};

export type WaveLink = {
  id: string;
  label: string;
  href: string;
};

export type SiteProfile = {
  teacherName: string;
  introTitle: string;
  introDescription: string;
  catalogTitle: string;
  catalogDescription: string;
  displayUrl: string;
  miniroomTitle: string;
  miniroomSub: string;
  boardSubtitle: string;
  boardEmptyText: string;
  guestbookTitle: string;
  guestbookSub: string;
};

export type SiteContent = {
  ownerUid: string | null;
  profile: SiteProfile;
  tabs: TabDef[];
  /* 탭 id 별 내용입니다. 프로필/사진첩/직접 만든 탭이 여기를 씁니다. */
  blocks: Record<string, ContentBlock[]>;
  boardPosts: BoardPost[];
  waveLinks: WaveLink[];
};

/* ------------------------------------------------------------------ */
/* 기본값 — 아직 한 번도 저장하지 않았을 때 보여 줄 내용                  */
/* ------------------------------------------------------------------ */

export function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/* 지금 config 에 적혀 있는 프로필 소개글을 편집 가능한 블록으로 옮겨 옵니다. */
function defaultProfileBlocks(): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  staticProfileSections.forEach(section => {
    section.blocks.forEach(block => {
      if (block.kind === "text") {
        block.lines.forEach(line => {
          blocks.push({ id: newId("b"), type: "text", text: line });
        });
      } else if (block.kind === "list") {
        blocks.push({ id: newId("b"), type: "heading", text: block.heading });
        block.items.forEach(item => {
          blocks.push({ id: newId("b"), type: "text", text: `· ${item}` });
        });
      } else {
        block.items.forEach(item => {
          blocks.push({ id: newId("b"), type: "link", label: item.label || item.value, href: item.href });
        });
      }
    });
  });
  return blocks;
}

export function defaultContent(): SiteContent {
  return {
    ownerUid: null,
    profile: {
      teacherName: staticProfile.teacherName,
      introTitle: staticProfile.introTitle,
      introDescription: staticProfile.introDescription,
      catalogTitle: staticProfile.catalogTitle,
      catalogDescription: staticProfile.catalogDescription,
      displayUrl: staticProfile.displayUrl,
      miniroomTitle: "Mini Room",
      miniroomSub: "미니룸",
      boardSubtitle: staticProfile.boardSubtitle,
      boardEmptyText: staticProfile.boardEmptyText,
      guestbookTitle: "What friends say",
      guestbookSub: "한마디로 표현한다면~"
    },
    tabs: [
      { id: "home", label: "홈", kind: "home" },
      { id: "profile", label: "프로필", kind: "profile" },
      { id: "board", label: staticProfile.boardLabel, kind: "board" },
      { id: "photo", label: staticProfile.photoLabel, kind: "photo" },
      { id: "guestbook", label: "방명록", kind: "guestbook" }
    ],
    blocks: {
      profile: defaultProfileBlocks(),
      photo: staticPhotos.map(p => ({
        id: newId("b"),
        type: "image" as const,
        imageId: `static:${p.src}`,
        caption: p.name
      }))
    },
    boardPosts: staticBoardPosts.map(p => ({
      id: p.id,
      category: p.category,
      title: p.title,
      summary: p.summary ?? "",
      date: p.date,
      href: p.href
    })),
    waveLinks: staticWaveLinks.map(w => ({ id: w.id, label: w.label, href: w.href }))
  };
}

/* Firestore 에서 읽어온 값에 빠진 항목이 있어도 화면이 깨지지 않게 채웁니다. */
function normalize(raw: Partial<SiteContent> | undefined): SiteContent {
  const base = defaultContent();
  if (!raw) return base;
  return {
    ownerUid: typeof raw.ownerUid === "string" ? raw.ownerUid : null,
    profile: { ...base.profile, ...(raw.profile ?? {}) },
    tabs: Array.isArray(raw.tabs) && raw.tabs.length > 0 ? raw.tabs : base.tabs,
    blocks: raw.blocks && typeof raw.blocks === "object" ? raw.blocks : base.blocks,
    boardPosts: Array.isArray(raw.boardPosts) ? raw.boardPosts : base.boardPosts,
    waveLinks: Array.isArray(raw.waveLinks) ? raw.waveLinks : base.waveLinks
  };
}

/* ------------------------------------------------------------------ */
/* 사진 — images 컬렉션에 한 장씩 따로 저장합니다                        */
/* ------------------------------------------------------------------ */

/* Firestore 문서 하나는 1MB 까지입니다. base64 로 바꾸면 용량이 3분의 1쯤 늘어나므로
   넉넉히 잡아 여기까지만 저장합니다. */
const MAX_IMAGE_CHARS = 700_000;
const MAX_IMAGE_DIMENSION = 1400;

/* 고른 사진을 브라우저에서 줄이고 압축해 base64 문자열로 만듭니다.
   용량이 기준을 넘으면 화질을 한 단계씩 낮춰 가며 다시 시도합니다. */
export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이 브라우저에서는 사진을 처리하지 못했어요.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.82, 0.7, 0.6, 0.5, 0.4, 0.3]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_IMAGE_CHARS) return dataUrl;
  }
  throw new Error("사진 용량이 너무 커요. 조금 더 작은 사진으로 올려 주세요.");
}

export async function uploadImage(file: File): Promise<string> {
  const store = getStore();
  if (!store) throw new Error("사진 저장 기능이 설정되지 않았습니다.");
  if (!currentUser()) throw new Error("로그인 후 올릴 수 있어요.");
  const dataUrl = await compressImage(file);
  const ref = await addDoc(collection(store, "images"), { dataUrl });
  return ref.id;
}

export async function deleteImage(imageId: string) {
  const store = getStore();
  if (!store || imageId.startsWith("static:")) return;
  await deleteDoc(doc(store, "images", imageId));
}

/* 올려둔 사진을 한꺼번에 구독해 { id: base64 } 지도로 들고 있습니다. */
export function useImages() {
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    const store = getStore();
    if (!store) return;
    return onSnapshot(
      collection(store, "images"),
      snapshot => {
        const next: Record<string, string> = {};
        snapshot.docs.forEach(d => {
          next[d.id] = String(d.data().dataUrl ?? "");
        });
        setImages(next);
      },
      () => setImages({})
    );
  }, []);

  return images;
}

/* 블록이 가리키는 사진의 실제 주소를 돌려줍니다.
   "static:/assets/..." 는 저장소에 원래 들어 있던 파일을 그대로 가리킵니다. */
export function resolveImageSrc(imageId: string, images: Record<string, string>) {
  if (imageId.startsWith("static:")) return imageId.slice("static:".length);
  return images[imageId] ?? "";
}

/* ------------------------------------------------------------------ */
/* 본문 구독 + 저장                                                     */
/* ------------------------------------------------------------------ */

export type SiteContentState = {
  content: SiteContent;
  ready: boolean;
  /* 로그인한 사람이 이 미니홈피의 주인장인지 */
  isOwner: boolean;
  /* 아직 주인이 정해지지 않아서 지금 등록할 수 있는 상태인지 */
  claimable: boolean;
  signedIn: boolean;
  claimOwnership: () => Promise<void>;
  update: (patch: Partial<SiteContent>) => Promise<void>;
};

export function useSiteContent(): SiteContentState {
  const [content, setContent] = useState<SiteContent>(defaultContent);
  const [ready, setReady] = useState(!isEditableSiteEnabled);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => subscribeAuthState(user => setUid(user?.uid ?? null)), []);

  useEffect(() => {
    const store = getStore();
    if (!store) return;
    return onSnapshot(
      doc(store, "site", "content"),
      snapshot => {
        setContent(normalize(snapshot.data() as Partial<SiteContent> | undefined));
        setReady(true);
      },
      () => setReady(true)
    );
  }, []);

  /* 저장은 화면에 먼저 반영하고 뒤에서 씁니다. 그래야 타이핑이 끊기지 않습니다. */
  const update = useCallback(
    async (patch: Partial<SiteContent>) => {
      const store = getStore();
      setContent(prev => ({ ...prev, ...patch }));
      if (!store) return;
      await setDoc(doc(store, "site", "content"), patch, { merge: true });
    },
    []
  );

  const claimOwnership = useCallback(async () => {
    const store = getStore();
    const user = currentUser();
    if (!store || !user) throw new Error("먼저 구글 로그인을 해 주세요.");
    const base = defaultContent();
    await setDoc(
      doc(store, "site", "content"),
      { ...base, ownerUid: user.uid },
      { merge: true }
    );
  }, []);

  return useMemo(
    () => ({
      content,
      ready,
      isOwner: Boolean(uid && content.ownerUid && uid === content.ownerUid),
      claimable: Boolean(uid && !content.ownerUid),
      signedIn: Boolean(uid),
      claimOwnership,
      update
    }),
    [content, ready, uid, claimOwnership, update]
  );
}
