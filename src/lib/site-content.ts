"use client";

/* 미니홈피에서 "주인장이 화면에서 직접 고칠 수 있는 것" 을 모아 둔 저장소입니다.

   - 내용은 Firestore 문서 하나(site/content)에 통째로 들어갑니다.
   - 아직 아무것도 저장하지 않았다면 src/config/*.ts 의 값이 그대로 기본값이 됩니다.
     즉 편집을 한 번도 안 해도 지금과 똑같이 보입니다.
   - 사진은 문서 크기 제한(1MB) 때문에 본문에 같이 넣지 않고, images 컬렉션에
     한 장씩 따로 저장한 뒤 블록에서는 그 id 만 가리킵니다. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "firebase/firestore";
import { asset } from "./asset";
import { contentFingerprint, validateContent } from "./editor-state";
import {
  currentUser,
  getStore,
  isGuestbookEnabled,
  setKnownOwnerUid,
  subscribeAuthState
} from "./firebase";
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
  /* 사진 블록은 여러 장을 담을 수 있습니다. imageIds 의 첫 장이 대표 사진이고,
     imageId 에는 예전 글·예전 화면을 위해 그 첫 장을 똑같이 적어 둡니다. */
  | (BlockBase & { type: "image"; imageId: string; imageIds?: string[]; caption: string });

/* guestbook 은 이제 탭이 아니라 홈 미니룸 아래에만 있습니다. 예전에 저장된
   탭 목록에 남아 있어도 normalize() 가 걷어냅니다. oekaki 가 낙서장입니다. */
export type TabKind = "home" | "profile" | "board" | "photo" | "guestbook" | "oekaki" | "custom";

/* 탭 내용을 어떻게 보여 줄지입니다.
   - list: 글 흐름대로 세로로
   - album: 사진첩처럼 격자로
   - year: 연도별로 묶어서 */
export type TabView = "list" | "album" | "year";

export type TabDef = {
  id: string;
  label: string;
  kind: TabKind;
  /* Legacy values remain compatible; activity tabs always normalize to year view. */
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
          blocks.push({ id: `profile-${blocks.length}`, type: "text", text: line });
        });
      } else if (block.kind === "list") {
        blocks.push({ id: `profile-${blocks.length}`, type: "heading", text: block.heading });
        block.items.forEach(item => {
          blocks.push({ id: `profile-${blocks.length}`, type: "text", text: `· ${item}` });
        });
      } else {
        block.items.forEach(item => {
          blocks.push({ id: `profile-${blocks.length}`, type: "link", label: item.label || item.value, href: item.href });
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
      { id: "photo", label: staticProfile.photoLabel, kind: "photo", view: "year" },
      { id: "oekaki", label: "낙서장", kind: "oekaki" }
    ],
    blocks: {
      profile: defaultProfileBlocks(),
      photo: staticPhotos.map(p => ({
        id: `photo-${p.id}`,
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
export function normalize(raw: Partial<SiteContent> | undefined): SiteContent {
  const base = defaultContent();
  if (!raw) return base;
  /* Remove the legacy guestbook tab without resurrecting deleted optional tabs. */
  let tabs = Array.isArray(raw.tabs) && raw.tabs.length > 0 ? raw.tabs : base.tabs;
  tabs = tabs.filter(t => t.kind !== "guestbook");
  tabs = tabs.map(t => t.kind === "photo" || t.kind === "custom" ? { ...t, view: "year" } : t);
  if (!tabs.some(t => t.kind === "home")) tabs = [base.tabs[0], ...tabs];
  const fixed = base.waveLinks[0];
  const savedWaves = Array.isArray(raw.waveLinks) ? raw.waveLinks : base.waveLinks;
  const savedFixed = savedWaves.find(w => w.id === fixed.id);
  return {
    ownerUid: typeof raw.ownerUid === "string" ? raw.ownerUid : null,
    profile: { ...base.profile, ...(raw.profile ?? {}) },
    tabs,
    blocks: raw.blocks && typeof raw.blocks === "object" ? raw.blocks : base.blocks,
    boardPosts: Array.isArray(raw.boardPosts) ? raw.boardPosts : base.boardPosts,
    waveLinks: [{ ...fixed, href: savedFixed?.href ?? fixed.href }, ...savedWaves.filter(w => w.id !== fixed.id)]
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

/* 사진 블록이 들고 있는 사진 id 를 순서대로 돌려줍니다.
   한 장만 있던 예전 글은 imageIds 가 없으므로 imageId 를 한 장짜리 목록으로 봅니다. */
export function blockImageIds(block: ContentBlock): string[] {
  if (block.type !== "image") return [];
  const list = Array.isArray(block.imageIds) ? block.imageIds.filter(Boolean) : [];
  if (list.length > 0) return list;
  return block.imageId ? [block.imageId] : [];
}

/* 바뀐 사진 목록을 블록에 다시 담을 때 쓰는 조각입니다.
   대표 사진(첫 장)을 imageId 에도 같이 넣어 두어야, 이 기능이 없던 때에 만들어진
   화면에서도 사진이 사라지지 않습니다. */
export function imageIdsPatch(ids: string[]) {
  const list = ids.filter(Boolean);
  return { imageId: list[0] ?? "", imageIds: list };
}

/* 블록이 가리키는 사진의 실제 주소를 돌려줍니다.
   "static:/assets/..." 는 저장소에 원래 들어 있던 파일을 그대로 가리킵니다. */
export function resolveImageSrc(imageId: string, images: Record<string, string>) {
  if (imageId.startsWith("static:")) return asset(imageId.slice("static:".length));
  return images[imageId] ?? "";
}

/* ------------------------------------------------------------------ */
/* 본문 구독 + 저장                                                     */
/* ------------------------------------------------------------------ */

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type SiteContentState = {
  content: SiteContent;
  ready: boolean;
  loadError: string | null;
  connected: boolean;
  isOwner: boolean;
  claimable: boolean;
  signedIn: boolean;
  dirty: boolean;
  conflict: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  canUndo: boolean;
  canRedo: boolean;
  claimOwnership: () => Promise<void>;
  beginEditing: () => void;
  update: (patch: Partial<SiteContent>) => void;
  save: () => Promise<boolean>;
  discard: () => void;
  undo: () => void;
  redo: () => void;
  retry: () => void;
};

export function useSiteContent(): SiteContentState {
  const [published, setPublished] = useState<SiteContent>(defaultContent);
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const [ready, setReady] = useState(!isEditableSiteEnabled);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connected, setConnected] = useState(!isEditableSiteEnabled);
  const [uid, setUid] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const publishedRef = useRef(published);
  const draftRef = useRef<SiteContent | null>(null);
  const baselineRef = useRef(published);
  const past = useRef<SiteContent[]>([]);
  const future = useRef<SiteContent[]>([]);
  const savingRef = useRef(false);
  const content = draft ?? published;
  const dirty = Boolean(draft && contentFingerprint(draft) !== contentFingerprint(baselineRef.current));
  const conflict = Boolean(draft && contentFingerprint(published) !== contentFingerprint(baselineRef.current));

  useEffect(() => subscribeAuthState(user => {
    setUid(user?.uid ?? null);
    draftRef.current = null;
    setDraft(null);
    past.current = [];
    future.current = [];
    setHistoryVersion(v => v + 1);
  }), []);

  useEffect(() => {
    const store = getStore();
    if (!store) return;
    setLoadError(null);
    let received = false;
    const timer = window.setTimeout(() => {
      if (!received) setLoadError("최신 내용을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
    }, 12000);
    const unsubscribe = onSnapshot(doc(store, "site", "content"), { includeMetadataChanges: true }, snapshot => {
      // Cached defaults and unacknowledged writes must never masquerade as live content.
      if (snapshot.metadata.hasPendingWrites) return;
      setConnected(!snapshot.metadata.fromCache);
      if (snapshot.metadata.fromCache) return;
      received = true;
      window.clearTimeout(timer);
      const next = normalize(snapshot.data() as Partial<SiteContent> | undefined);
      setKnownOwnerUid(next.ownerUid);
      // An untouched editor follows live changes; only actual edits need conflict protection.
      if (draftRef.current && contentFingerprint(draftRef.current) === contentFingerprint(baselineRef.current)
        && contentFingerprint(next) !== contentFingerprint(baselineRef.current)) {
        baselineRef.current = next;
        draftRef.current = next;
        setDraft(next);
        past.current = [];
        future.current = [];
        setHistoryVersion(v => v + 1);
      }
      publishedRef.current = next;
      setPublished(next);
      setLoadError(null);
      setReady(true);
    }, () => {
      window.clearTimeout(timer);
      setConnected(false);
      setLoadError("내용을 불러오지 못했어요. 다시 시도해 주세요.");
    });
    const onOffline = () => setConnected(false);
    const onOnline = () => setAttempt(v => v + 1);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [attempt]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const beginEditing = useCallback(() => {
    if (draftRef.current) return;
    baselineRef.current = publishedRef.current;
    draftRef.current = publishedRef.current;
    setDraft(draftRef.current);
    past.current = [];
    future.current = [];
    setHistoryVersion(v => v + 1);
    setSaveStatus("idle");
    setSaveError(null);
  }, []);

  const update = useCallback((patch: Partial<SiteContent>) => {
    if (savingRef.current) return;
    const prev = draftRef.current ?? publishedRef.current;
    const next = { ...prev, ...patch };
    if (contentFingerprint(next) === contentFingerprint(prev)) return;
    if (!draftRef.current) baselineRef.current = publishedRef.current;
    past.current = [...past.current.slice(-99), prev];
    future.current = [];
    draftRef.current = next;
    setDraft(next);
    setSaveStatus("idle");
    setSaveError(null);
    setHistoryVersion(v => v + 1);
  }, []);

  const undo = useCallback(() => {
    if (savingRef.current || !past.current.length || !draftRef.current) return;
    future.current.push(draftRef.current);
    draftRef.current = past.current.pop()!;
    setDraft(draftRef.current);
    setSaveStatus("idle");
    setSaveError(null);
    setHistoryVersion(v => v + 1);
  }, []);
  const redo = useCallback(() => {
    if (savingRef.current || !future.current.length || !draftRef.current) return;
    past.current.push(draftRef.current);
    draftRef.current = future.current.pop()!;
    setDraft(draftRef.current);
    setSaveStatus("idle");
    setSaveError(null);
    setHistoryVersion(v => v + 1);
  }, []);
  const discard = useCallback(() => {
    if (savingRef.current) return;
    draftRef.current = null;
    setDraft(null);
    past.current = [];
    future.current = [];
    setSaveStatus("idle");
    setSaveError(null);
    setHistoryVersion(v => v + 1);
  }, []);

  const save = useCallback(async () => {
    if (savingRef.current) return false;
    const store = getStore();
    const user = currentUser();
    const next = draftRef.current;
    if (!next) return true;
    const validation = validateContent(next);
    if (validation || !store || !user || user.uid !== next.ownerUid || !navigator.onLine) {
      setSaveStatus("error");
      setSaveError(validation ?? (!navigator.onLine ? "인터넷 연결이 끊겼어요. 연결한 뒤 다시 저장해 주세요." : "주인장 계정으로 로그인한 뒤 저장해 주세요."));
      return false;
    }
    savingRef.current = true;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await runTransaction(store, async transaction => {
        const ref = doc(store, "site", "content");
        const latest = normalize((await transaction.get(ref)).data() as Partial<SiteContent> | undefined);
        if (contentFingerprint(latest) !== contentFingerprint(baselineRef.current)) {
          throw new Error("다른 창에서 내용이 바뀌었어요. 편집한 내용을 복사한 뒤 변경 취소를 눌러 최신 내용을 확인해 주세요.");
        }
        transaction.set(ref, { ...next, updatedAt: serverTimestamp() });
      });
      baselineRef.current = next;
      publishedRef.current = next;
      setPublished(next);
      setSaveStatus("saved");
      return true;
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error && !('code' in error) ? error.message : "저장하지 못했어요. 수정한 내용은 그대로 있으니 다시 저장해 주세요.");
      return false;
    } finally { savingRef.current = false; }
  }, []);

  const claimOwnership = useCallback(async () => {
    const store = getStore();
    const user = currentUser();
    if (!store || !user) throw new Error("먼저 구글 로그인을 해 주세요.");
    await runTransaction(store, async transaction => {
      const ref = doc(store, "site", "content");
      const snapshot = await transaction.get(ref);
      const existing = normalize(snapshot.data() as Partial<SiteContent> | undefined);
      if (existing.ownerUid && existing.ownerUid !== user.uid) throw new Error("이미 등록된 주인장이 있어요.");
      transaction.set(ref, { ...existing, ownerUid: user.uid, updatedAt: serverTimestamp() });
    });
  }, []);

  return useMemo(() => ({ content, ready, loadError, connected,
    isOwner: Boolean(uid && published.ownerUid && uid === published.ownerUid),
    claimable: Boolean(ready && connected && uid && !published.ownerUid), signedIn: Boolean(uid),
    dirty, conflict, saveStatus, saveError, canUndo: past.current.length > 0, canRedo: future.current.length > 0,
    claimOwnership, beginEditing, update, save, discard, undo, redo, retry: () => setAttempt(v => v + 1)
  }), [content, published, ready, loadError, connected, uid, dirty, conflict, saveStatus, saveError,
    historyVersion, claimOwnership, beginEditing, update, save, discard, undo, redo]);
}
