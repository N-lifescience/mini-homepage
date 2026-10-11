"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Spiral, type SpiralProps } from "@paper-design/shaders-react";
import { asset } from "@/lib/asset";
import BgmPlayer, { type BgmHandle } from "@/components/BgmPlayer";
import {
  GUESTBOOK_LIMITS,
  addGuestbookEntry,
  deleteGuestbookEntry,
  isCounterEnabled,
  isGuestbookEnabled,
  recordVisit,
  signInWithGoogle,
  signOutOfGoogle,
  subscribeAuthState,
  subscribeGuestbook,
  subscribeReplies,
  addReply,
  deleteReply,
  REPLY_LIMITS,
  type RemoteEntry,
  type RemoteReply,
  type VisitCounts
} from "@/lib/firebase";
import type { User } from "firebase/auth";
import {
  guestbook,
  profile
} from "@/config/linktree";
import { theme } from "@/config/theme";
import "./minihome.css";
import MiniRoom from "@/components/MiniRoom";
import {
  newId,
  useImages,
  useSiteContent,
  type BoardPost,
  type ContentBlock,
  type SiteContent,
  type TabDef,
  type TabView
} from "@/lib/site-content";
import { BlockList, EditableText } from "@/components/Editable";
import Oekaki from "@/components/Oekaki";
import AdminEditor from "@/components/AdminEditor";

/* 진입 화면 셰이더 배경 설정입니다. 색은 theme.ts 를 따릅니다. */
const spiralProps = {
  fit: "none",
  scale: 1.3,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  originX: 0.5,
  originY: 0.5,
  worldWidth: 0,
  worldHeight: 0,
  density: 0.5,
  colorBack: theme.colors.cream,
  colorFront: theme.colors.spiralFront,
  distortion: 0,
  strokeWidth: 0.5,
  strokeTaper: 0,
  strokeCap: 0,
  noise: 1,
  noiseFrequency: 0.25,
  softness: 0,
  speed: 0.75,
  frame: 0,
  maxPixelCount: 1_500_000
} satisfies Partial<SpiralProps>;

const introStyle = {
  "--cream": theme.colors.cream,
  "--ink": theme.colors.ink,
  "--brown": theme.colors.brown,
  "--display": "'Pretendard', 'Noto Sans KR', system-ui, sans-serif",
  "--body": "'Pretendard', 'Noto Sans KR', system-ui, sans-serif"
} as React.CSSProperties;

function ChevronDown({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IntroOverlay({
  title,
  description,
  onBrowse
}: {
  title: string;
  description: string;
  onBrowse: () => void;
}) {
  return (
    <div className="lt-intro" style={introStyle}>
      <Spiral className="lt-intro-spiral" {...spiralProps} />
      <div className="lt-intro-card">
        <span className="lt-intro-title">{title}</span>
        <p className="lt-intro-copy">{description}</p>
        <div className="lt-intro-actions">
          <button type="button" className="lt-intro-cta" onClick={onBrowse}>
            모든 활동 구경하기
            <ChevronDown size={18} />
          </button>
          <a className="lt-intro-cta lt-intro-showroom" href={asset("/showroom/")}>
            쇼룸
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, sub }: { title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="cy-section-title">
      {title}
      {sub ? <span className="cy-sub-text">{sub}</span> : null}
    </div>
  );
}

type TabViewProps = {
  tab: TabDef;
  content: SiteContent;
  editing: boolean;
  images: Record<string, string>;
  update: (patch: Partial<SiteContent>) => void;
};

/* 탭 하나의 블록 목록을 통째로 갈아 끼웁니다. */
function setBlocks(props: TabViewProps, blocks: ContentBlock[]) {
  props.update({ blocks: { ...props.content.blocks, [props.tab.id]: blocks } });
}

function HomeTab({
  introSkipped,
  content,
  editing,
  update,
  isOwner,
  roomEditable,
  roomBusy
}: {
  introSkipped: boolean;
  content: SiteContent;
  editing: boolean;
  update: (patch: Partial<SiteContent>) => void;
  isOwner: boolean;
  roomEditable: boolean;
  roomBusy: boolean;
}) {
  const setProfile = (patch: Partial<SiteContent["profile"]>) =>
    update({ profile: { ...content.profile, ...patch } });

  const miniroomTitle = /^(Punky Room|Mini Room)$/i.test(content.profile.miniroomTitle)
    ? "미니룸" : content.profile.miniroomTitle;
  const miniroomSub = /^(펑키룸|미니룸)$/.test(content.profile.miniroomSub)
    ? "생명과학 탐구 정원" : content.profile.miniroomSub;

  return (
    <>
      <div className="cy-content-box cy-miniroom-box">
        <SectionTitle
          title={
            <EditableText
              value={miniroomTitle}
              editing={editing}
              placeholder="Mini Room"
              onSave={miniroomTitle => setProfile({ miniroomTitle })}
            />
          }
          sub={
            <EditableText
              value={miniroomSub}
              editing={editing}
              placeholder="미니룸"
              onSave={miniroomSub => setProfile({ miniroomSub })}
            />
          }
        />
        <div className="cy-miniroom-inner">
          <MiniRoom introSkipped={introSkipped} roomLayout={content.miniroomLayout} disabled={roomBusy}
            onLayoutChange={roomEditable ? miniroomLayout => update({ miniroomLayout }) : undefined} />
        </div>
      </div>

      <div className="cy-content-box">
        <SectionTitle
          title={
            <EditableText
              value={content.profile.guestbookTitle}
              editing={editing}
              placeholder="What friends say"
              onSave={guestbookTitle => setProfile({ guestbookTitle })}
            />
          }
          sub={
            <EditableText
              value={content.profile.guestbookSub}
              editing={editing}
              placeholder="한마디로 표현한다면~"
              onSave={guestbookSub => setProfile({ guestbookSub })}
            />
          }
        />
        <GuestbookList isOwner={isOwner} />
      </div>
    </>
  );
}

/* Profile text stays in a list; activity photos are always grouped by year. */
function BlocksTab(props: TabViewProps) {
  const { tab, content, editing, images } = props;
  const blocks = content.blocks[tab.id] ?? [];
  const view: TabView = tab.kind === "profile" ? "list" : "year";

  return (
    <div className="cy-content-box">
      <SectionTitle title={tab.label} />
      <BlockList
        blocks={blocks}
        editing={editing}
        images={images}
        view={view}
        onChange={next => setBlocks(props, next)}
      />
    </div>
  );
}

function BoardTab(props: TabViewProps) {
  const { content, editing, tab, update } = props;
  const posts = content.boardPosts;

  const replace = (id: string, patch: Partial<BoardPost>) =>
    update({ boardPosts: posts.map(p => (p.id === id ? { ...p, ...patch } : p)) });

  const remove = (id: string) => {
    if (!window.confirm("이 글을 지울까요?")) return;
    update({ boardPosts: posts.filter(p => p.id !== id) });
  };

  const move = (id: string, delta: number) => {
    const index = posts.findIndex(p => p.id === id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= posts.length) return;
    const copy = [...posts];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    update({ boardPosts: copy });
  };

  const add = () =>
    update({
      boardPosts: [
        {
          id: newId("post"),
          category: "앱",
          title: "새 글 제목",
          summary: "",
          date: new Date().toISOString().slice(0, 10),
          href: ""
        },
        ...posts
      ]
    });

  return (
    <div className="cy-content-box">
      <SectionTitle title={tab.label} sub={content.profile.boardSubtitle} />

      {posts.length === 0 && !editing ? (
        <div className="cy-empty-box">{content.profile.boardEmptyText}</div>
      ) : (
        <ul className="cy-board-list">
          {posts.map(post => (
            <li key={post.id} className={`cy-board-item${editing ? " is-editing" : ""}`}>
              {editing ? (
                <div className="cy-board-edit">
                  <div className="cy-block-tools">
                    <button type="button" onClick={() => move(post.id, -1)} title="위로">↑</button>
                    <button type="button" onClick={() => move(post.id, 1)} title="아래로">↓</button>
                    <button type="button" onClick={() => remove(post.id)} title="지우기">✕</button>
                  </div>
                  <EditableText
                    className="cy-board-title"
                    value={post.title}
                    editing
                    placeholder="제목"
                    onSave={title => replace(post.id, { title })}
                  />
                  <EditableText
                    className="cy-board-summary"
                    value={post.summary}
                    editing
                    placeholder="한 줄 설명 (없으면 비워 두세요)"
                    onSave={summary => replace(post.id, { summary })}
                  />
                  <EditableText
                    className="cy-block-href"
                    value={post.href}
                    editing
                    placeholder="https://..."
                    onSave={href => replace(post.id, { href })}
                  />
                  <div className="cy-board-meta-edit">
                    <EditableText
                      className="cy-board-category"
                      value={post.category}
                      editing
                      placeholder="분류"
                      onSave={category => replace(post.id, { category })}
                    />
                    <EditableText
                      className="cy-board-date"
                      value={post.date}
                      editing
                      placeholder="2026-01-01"
                      onSave={date => replace(post.id, { date })}
                    />
                  </div>
                </div>
              ) : (
                <a className="cy-board-link" href={post.href} target="_blank" rel="noopener noreferrer">
                  <span className="cy-board-text">
                    <span className="cy-board-head">
                      <span className="cy-board-category">{post.category}</span>
                      <span className="cy-board-title">{post.title}</span>
                    </span>
                    {post.summary ? <span className="cy-board-summary">{post.summary}</span> : null}
                    <span className="cy-board-date">{post.date}</span>
                  </span>
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <div className="cy-block-add">
          <button type="button" onClick={add}>+ 글 추가</button>
        </div>
      ) : null}
    </div>
  );
}
/* 방명록은 구글 로그인을 해야 남길 수 있습니다 (도배 방지용 잠금이고,
   이름은 로그인과 상관없이 직접 적은 값을 그대로 씁니다). */
function GuestbookForm() {
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [secret, setSecret] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    return subscribeAuthState(next => {
      setUser(next);
      setAuthReady(true);
    });
  }, []);

  const login = async () => {
    setLoggingIn(true);
    setMessage(null);
    try {
      await signInWithGoogle();
    } catch {
      setMessage({ kind: "error", text: "로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요." });
    } finally {
      setLoggingIn(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setMessage(null);
    try {
      await addGuestbookEntry(author, text, secret);
      setAuthor("");
      setText("");
      setSecret(false);
      setMessage({
        kind: "ok",
        text: secret ? "비밀 방명록을 남겼어요. 주인장만 볼 수 있어요." : "방명록을 남겼어요. 고맙습니다!"
      });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "남기지 못했어요. 잠시 뒤 다시 시도해 주세요." });
    } finally {
      setSending(false);
    }
  };

  if (!authReady) return null;

  if (!user) {
    return (
      <div className="cy-guestbook-login">
        <button type="button" className="cy-gb-google" onClick={login} disabled={loggingIn}>
          {loggingIn ? "로그인 중…" : "Google로 로그인하고 방명록 작성하기"}
        </button>
        {message ? (
          <span className={`cy-gb-message${message.kind === "error" ? " is-error" : ""}`}>{message.text}</span>
        ) : null}
      </div>
    );
  }

  return (
    <form className="cy-guestbook-form" onSubmit={submit}>
      <div className="cy-gb-account">
        {user.displayName ?? "구글 사용자"}님으로 로그인됨 ·{" "}
        <button type="button" className="cy-gb-logout" onClick={() => signOutOfGoogle()}>
          로그아웃
        </button>
      </div>
      <input
        className="cy-gb-author"
        value={author}
        onChange={e => setAuthor(e.target.value)}
        placeholder="이름"
        maxLength={GUESTBOOK_LIMITS.author}
        aria-label="이름"
      />
      <input
        className="cy-gb-text"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="방명록을 남겨주세요"
        maxLength={GUESTBOOK_LIMITS.text}
        aria-label="방명록"
      />
      <button className="cy-gb-submit" type="submit" disabled={sending}>
        {sending ? "전송중" : "남기기"}
      </button>
      <label className="cy-gb-secret">
        <input type="checkbox" checked={secret} onChange={e => setSecret(e.target.checked)} />
        비밀글 (주인장과 나만 볼 수 있어요)
      </label>
      {message ? (
        <span className={`cy-gb-message${message.kind === "error" ? " is-error" : ""}`}>{message.text}</span>
      ) : null}
    </form>
  );
}

const GUESTBOOK_FETCH_LIMIT = 30;
const GUESTBOOK_PAGE_SIZE = 5;

/* 방명록 글 하나에 달린 댓글 목록 + 댓글 쓰기 칸입니다. */
function ReplyThread({
  entryId,
  myUid,
  isOwner,
  defaultAuthor
}: {
  entryId: string;
  myUid: string | null;
  isOwner: boolean;
  defaultAuthor: string;
}) {
  const [replies, setReplies] = useState<RemoteReply[]>([]);
  const [open, setOpen] = useState(false);
  const [author, setAuthor] = useState(defaultAuthor);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeReplies(entryId, setReplies, () => setReplies([])), [entryId]);
  useEffect(() => setAuthor(defaultAuthor), [defaultAuthor]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await addReply(entryId, author, text);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "댓글을 남기지 못했어요.");
    } finally {
      setSending(false);
    }
  };

  const remove = async (replyId: string) => {
    if (!window.confirm("이 댓글을 지울까요?")) return;
    try {
      await deleteReply(entryId, replyId);
    } catch {
      window.alert("지우지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    }
  };

  return (
    <div className="cy-reply-thread">
      <button type="button" className="cy-reply-toggle" onClick={() => setOpen(v => !v)}>
        {open ? "└ 댓글 닫기" : `└ 댓글 ${replies.length}`}
      </button>

      {open ? (
        <div className="cy-reply-body">
          {replies.map(r => (
            <div key={r.id} className="cy-reply-item">
              <span className="cy-reply-author">{r.author}</span>
              <span className="cy-reply-text">{r.text}</span>
              <span className="cg-date">({r.date})</span>
              {myUid && (r.uid === myUid || isOwner) ? (
                <button type="button" className="cg-delete" onClick={() => remove(r.id)}>삭제</button>
              ) : null}
            </div>
          ))}

          {myUid ? (
            <form className="cy-reply-form" onSubmit={submit}>
              <input
                className="cy-gb-author"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                placeholder="이름"
                maxLength={REPLY_LIMITS.author}
                aria-label="댓글 이름"
              />
              <input
                className="cy-gb-text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="댓글을 남겨주세요"
                maxLength={REPLY_LIMITS.text}
                aria-label="댓글"
              />
              <button className="cy-gb-submit" type="submit" disabled={sending}>
                {sending ? "전송중" : "달기"}
              </button>
              {error ? <span className="cy-gb-message is-error">{error}</span> : null}
            </form>
          ) : (
            <div className="cy-gb-loading">댓글은 구글 로그인 후 남길 수 있어요.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function GuestbookList({ isOwner }: { isOwner: boolean }) {
  /* Firestore 가 설정되어 있으면 실시간 목록을, 아니면 linktree.ts 의 예시를 보여줍니다. */
  const [remote, setRemote] = useState<RemoteEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);
  const [myUid, setMyUid] = useState<string | null>(null);
  const [myName, setMyName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeAuthState(user => {
        setMyUid(user?.uid ?? null);
        setMyName(user?.displayName ?? "");
      }),
    []
  );

  /* 비밀글 때문에 로그인 상태·주인장 여부가 바뀌면 구독을 다시 겁니다. */
  useEffect(() => {
    if (!isGuestbookEnabled) return;
    return subscribeGuestbook(
      GUESTBOOK_FETCH_LIMIT,
      { uid: myUid, isOwner },
      setRemote,
      error => {
        /* 색인이 없으면 여기 뜨는 주소를 눌러 한 번만 만들어 주면 됩니다. */
        console.error("[방명록]", error.message);
        setFailed(true);
      }
    );
  }, [myUid, isOwner]);

  const removeEntry = async (id: string) => {
    if (deletingId) return;
    if (!window.confirm("이 방명록을 지울까요?")) return;
    setDeletingId(id);
    try {
      await deleteGuestbookEntry(id);
    } catch {
      window.alert("지우지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setDeletingId(null);
    }
  };

  const live = isGuestbookEnabled && !failed;
  const entries = live && remote
    ? remote.map(e => ({ key: e.id, ...e }))
    : guestbook.map(e => ({ key: String(e.id), ...e }));

  const pageCount = Math.max(1, Math.ceil(entries.length / GUESTBOOK_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageEntries = entries.slice(
    currentPage * GUESTBOOK_PAGE_SIZE,
    currentPage * GUESTBOOK_PAGE_SIZE + GUESTBOOK_PAGE_SIZE
  );

  return (
    <>
      {live && remote === null ? <div className="cy-gb-loading">방명록을 불러오는 중…</div> : null}

      <div className="cy-guestbook-list">
        {entries.length === 0 ? (
          <div className="cy-gb-loading">아직 방명록이 없어요. 첫 줄을 남겨 주세요!</div>
        ) : (
          pageEntries.map(c => (
            <div key={c.key} className="cy-guestbook-item">
              <span className="cg-author">
                {c.author} <span className="cg-colon">:</span>{" "}
              </span>
              {"secret" in c && c.secret ? <span className="cg-secret">🔒 비밀글</span> : null}
              <span className="cg-text">{c.text}</span>
              <span className="cg-date">({c.date})</span>
              {live && myUid && "uid" in c && (c.uid === myUid || isOwner) ? (
                <button
                  type="button"
                  className="cg-delete"
                  onClick={() => removeEntry(c.id)}
                  disabled={deletingId === c.id}
                >
                  삭제
                </button>
              ) : null}
              {live && "uid" in c ? (
                <ReplyThread entryId={c.id} myUid={myUid} isOwner={isOwner} defaultAuthor={myName} />
              ) : null}
            </div>
          ))
        )}
      </div>

      {pageCount > 1 ? (
        <div className="cy-gb-pagination">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`cy-gb-page${i === currentPage ? " is-active" : ""}`}
              onClick={() => setPage(i)}
              aria-current={i === currentPage ? "page" : undefined}
            >
              {i + 1}
            </button>
          ))}
        </div>
      ) : null}

      {/* 목록을 못 불러왔더라도 글쓰기 칸은 남겨 둡니다.
          (색인이 아직 만들어지는 중이면 목록만 잠깐 비어 보입니다) */}
      {isGuestbookEnabled ? <GuestbookForm /> : null}
      {failed ? (
        <div className="cy-gb-loading">
          방명록 목록을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.
        </div>
      ) : null}
    </>
  );
}

/* 미니홈피 왼쪽 위 방문 수입니다. 들어올 때마다 한 번 기록하고 그 결과를 보여 줍니다.
   Firestore 가 설정되지 않았거나 아직 못 받았으면 숫자 자리를 - 로 둡니다. */
function VisitCounter() {
  const [counts, setCounts] = useState<VisitCounts | null>(null);
  /* 개발 모드에서 효과가 두 번 실행돼 2씩 오르는 것을 막습니다. */
  const sentRef = useRef(false);

  useEffect(() => {
    if (!isCounterEnabled || sentRef.current) return;
    sentRef.current = true;
    recordVisit()
      .then(setCounts)
      .catch(() => setCounts(null));
  }, []);

  const show = (value: number | undefined) =>
    typeof value === "number" ? value.toLocaleString() : "-";

  return (
    <span className="cy-today-count">
      TODAY <span className="text-orange">{show(counts?.today)}</span>
      {" | "}
      TOTAL <span className="text-black">{show(counts?.total)}</span>
    </span>
  );
}

export default function LinkTree() {
  const site = useSiteContent();
  const { content, ready, loadError, connected, isOwner, claimable, signedIn, claimOwnership, update } = site;
  const images = useImages();

  const [activeTabId, setActiveTabId] = useState("home");
  const [introSkipped, setIntroSkipped] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const bgmRef = useRef<BgmHandle>(null);

  const tabs = content.tabs;
  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];
  /* 편집은 주인장만 켤 수 있습니다. 주인이 아니면 편집 상태를 강제로 끕니다. */
  const canEdit = false;

  const setProfile = (patch: Partial<SiteContent["profile"]>) =>
    update({ profile: { ...content.profile, ...patch } });

  /* ?tab=프로필 처럼 탭 딥링크로 들어오면 진입 화면을 건너뜁니다.
     정적 배포에서도 동작하도록 브라우저에서 읽습니다. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "1" || params.get("edit") === "1") {
      setAdminMode(true);
      setIntroSkipped(true);
    }
    const tab = params.get("tab");
    if (!tab) return;
    setActiveTabId(tab);
    setIntroSkipped(true);
  }, []);

  /* 인트로가 떠 있는 동안에는 뒤쪽이 스크롤되지 않게 막습니다. */
  useEffect(() => {
    if (introSkipped) return;
    document.body.classList.add("lt-intro-open");
    return () => document.body.classList.remove("lt-intro-open");
  }, [introSkipped]);

  const waveLinks = content.waveLinks;
  useEffect(() => { if (!isOwner) setEditorOpen(false); }, [isOwner]);

  const openEditor = () => { site.beginEditing(); setEditorOpen(true); };
  const signOut = async () => {
    if (site.dirty && !window.confirm("저장하지 않은 변경을 취소하고 로그아웃할까요?")) return;
    site.discard();
    try { await signOutOfGoogle(); } catch { setAdminError("로그아웃하지 못했어요. 다시 시도해 주세요."); }
  };

  const renderTab = () => {
    if (!activeTab) return null;
    const shared = { tab: activeTab, content, editing: canEdit, images, update };

    switch (activeTab.kind) {
      case "home":
        return (
          <HomeTab
            introSkipped={introSkipped}
            content={content}
            editing={canEdit}
            update={update}
            isOwner={isOwner}
            roomEditable={isOwner && adminMode}
            roomBusy={site.saveStatus === "saving"}
          />
        );
      case "board":
        return <BoardTab {...shared} />;
      case "photo":
        return <BlocksTab {...shared} />;
      case "oekaki":
        return <Oekaki />;
      case "profile":
        /* 프로필은 글 위주라 보기 전환 없이 목록으로만 보여 줍니다. */
        return <BlocksTab {...shared} />;
      default:
        return <BlocksTab {...shared} />;
    }
  };

  if (!ready) return <div className="site-loading garden-loading" role="status" aria-live="polite">
    <div className="site-loading-card"><span className="admin-mark">N</span><h1>{loadError ? "잠시 연결이 끊겼어요" : "최신 내용을 불러오고 있어요"}</h1>
      <p>{loadError ?? "조금만 기다려 주세요."}</p>{loadError ? <button type="button" className="admin-primary" onClick={site.retry}>다시 불러오기</button> : <span className="site-loading-dots" aria-hidden="true">···</span>}
    </div>
  </div>;

  /* 본문을 항상 그려 두고 인트로를 그 위에 덮습니다. (.lt-intro 는 position: fixed 입니다)
     BGM 플레이어가 미리 준비되어 있어야 인트로 클릭 한 번으로 재생이 시작됩니다. */
  return (
    <div
      className={`cy-root${adminMode ? " has-admin-bar" : ""}`}
    >
      <div className="cy-background-pattern" aria-hidden="true">
        <img className="cy-background-image" src={asset("/assets/background-garden.webp")} alt="" />
      </div>
      {adminMode ? <div className="admin-bar">
        <span className="admin-bar-title">미니홈피 관리</span>
        <span className="admin-bar-status" role="status">{isOwner ? site.saveStatus === "saving" ? "저장 중…" : site.dirty ? "미리보기 · 아직 저장하지 않았어요" : "저장된 최신 내용" : "주인장 계정으로 로그인해 주세요"}</span>
        <div className="admin-bar-actions">
          {isOwner ? <><button type="button" onClick={openEditor}>미니홈피 편집</button>{site.dirty ? <button type="button" className="admin-primary" disabled={!connected || site.saveStatus === "saving" || site.conflict} onClick={() => void site.save()}>변경사항 저장</button> : null}<button type="button" className="admin-quiet" disabled={site.saveStatus === "saving"} onClick={() => void signOut()}>로그아웃</button></> : !signedIn ? <button type="button" onClick={async () => { try { setAdminError(null); await signInWithGoogle(); } catch (error) { setAdminError(error instanceof Error ? error.message : "로그인하지 못했어요. 다시 시도해 주세요."); } }}>주인장 로그인</button> : claimable ? <button type="button" onClick={async () => { try { await claimOwnership(); } catch (error) { setAdminError(error instanceof Error ? error.message : "주인 등록에 실패했어요."); } }}>주인장으로 등록</button> : <><span>등록된 주인장 계정이 아니에요</span><button type="button" onClick={() => void signOut()}>로그아웃</button></>}
        </div>
        {adminError || site.saveError ? <p className="admin-bar-error" role="alert">{adminError ?? site.saveError}</p> : null}
      </div> : null}
      {!connected || loadError ? <div className="site-connection-note" role="status">{loadError ?? "연결이 끊겼어요. 마지막으로 확인한 내용을 보여드리고 있어요."}<button type="button" onClick={site.retry}>다시 연결</button></div> : null}
      {editorOpen && isOwner ? <AdminEditor state={site} images={images} initialTabId={activeTabId} onClose={() => setEditorOpen(false)} onPreview={id => { setActiveTabId(id); setEditorOpen(false); }} /> : null}


      <div className="cy-book-wrapper" inert={!introSkipped}>
        <div className="cy-book-outer">

          {/* 바인더 링 */}
          <div className="cy-bindings">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="cy-ring"></div>
            ))}
          </div>

          <div className="cy-book-inner">
            {/* 좌측 패널 */}
            <div className="cy-left-panel">
              <div className="cy-left-header">
                <VisitCounter />
              </div>
              <div className="cy-left-content">
                <div className="cy-today-is">TODAY IS.. <span className="text-orange">맑음 ☀️</span></div>

                <div className="cy-profile-pic">
                  <img src={asset(profile.photo.src)} alt={profile.photo.alt} width={640} height={640} />
                </div>

                <EditableText
                  as="div"
                  className="cy-intro-text"
                  value={content.profile.introDescription}
                  editing={canEdit}
                  multiline
                  placeholder="소개 문구를 적어 주세요"
                  onSave={introDescription => setProfile({ introDescription })}
                />

                <BgmPlayer ref={bgmRef} />

                <div className="cy-profile-name">
                  <EditableText
                    as="div"
                    className="name-bold"
                    value={content.profile.teacherName}
                    editing={canEdit}
                    placeholder="이름"
                    onSave={teacherName => setProfile({ teacherName })}
                  />
                  <EditableText
                    as="div"
                    className="title-sub"
                    value={content.profile.catalogDescription === "Like, Cyber, Punk," ? "일상의 궁금증을 생명과학으로" : content.profile.catalogDescription}
                    editing={canEdit}
                    placeholder="한 줄 설명"
                    onSave={catalogDescription => setProfile({ catalogDescription })}
                  />
                </div>

                <div className="cy-left-dropdown">
                    <select
                      aria-label="파도타기"
                      value=""
                      onChange={event => {
                        const target = waveLinks.find(w => w.id === event.target.value);
                        if (target) {
                          window.open(target.href, "_blank", "noopener,noreferrer");
                        }
                      }}
                    >
                      <option value="" disabled>파도타기</option>
                      {waveLinks.map(wave => (
                        <option key={wave.id} value={wave.id}>{wave.label}</option>
                      ))}
                    </select>
                </div>
              </div>
            </div>

            {/* 우측 패널 */}
            <div className="cy-right-panel">
              <div className="cy-right-header">
                <span className="cy-title">{activeTab?.label}</span>
                <EditableText
                  className="cy-url"
                  value={content.profile.displayUrl}
                  editing={canEdit}
                  placeholder="주소창 문구"
                  onSave={displayUrl => setProfile({ displayUrl })}
                />
              </div>

              <div className="cy-right-content">{renderTab()}</div>
            </div>

            {/* 탭 영역 */}
            <div className="cy-tabs">
              {tabs.map(tab => (
                <div key={tab.id} className="cy-tab-slot">
                  <button
                    type="button"
                    aria-current={activeTab?.id === tab.id ? "page" : undefined}
                    className={"cy-tab-btn " + (activeTab?.id === tab.id ? "active" : "")}
                    onClick={() => setActiveTabId(tab.id)}
                  >
                    <span className="cy-tab-line">{tab.label}</span>
                  </button>

                </div>
              ))}

            </div>

          </div>
        </div>
      </div>

      {!introSkipped ? (
        <IntroOverlay
          title={content.profile.introTitle}
          description={content.profile.introDescription}
          onBrowse={() => {
            /* 클릭 안에서 재생을 걸어야 브라우저가 소리를 허용합니다. */
            bgmRef.current?.start();
            setIntroSkipped(true);
          }}
        />
      ) : null}
    </div>
  );
}
