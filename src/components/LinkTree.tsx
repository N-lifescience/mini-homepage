"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
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
  type RemoteEntry,
  type VisitCounts
} from "@/lib/firebase";
import type { User } from "firebase/auth";
import {
  guestbook,
  profile
} from "@/config/linktree";
import { theme } from "@/config/theme";
import { characterModes } from "@/config/character";
import { furnitureItems } from "@/config/furniture";
import {
  newId,
  useImages,
  useSiteContent,
  type BoardPost,
  type ContentBlock,
  type SiteContent,
  type TabDef,
  type WaveLink
} from "@/lib/site-content";
import { BlockList, EditableText } from "@/components/Editable";

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
        <button type="button" className="lt-intro-cta" onClick={onBrowse}>
          모든 활동 구경하기
          <ChevronDown size={18} />
        </button>
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

/* 방향키로 움직이고 클릭하면 모드(포즈+멘트)가 바뀌는 미니룸 캐릭터입니다.
   배경(miniroom-bg-cyberpunk.jpg)의 바닥은 위쪽 한 점(꼭짓점)에서 벌어지는
   삼각형이라, 벽으로 못 나가게 y값에 따라 x 이동 범위를 좁혀서 바닥 모양대로 막는다. */
const CHARACTER_STEP = 3;
const FLOOR_APEX_Y = 40; // 바닥이 시작되는 꼭짓점의 세로 위치(%)
const FLOOR_MIN_Y = 43;
const FLOOR_MAX_Y = 88;
const FLOOR_SLOPE = 1.07; // 꼭짓점에서 아래로 1% 내려갈 때 바닥이 좌우로 넓어지는 폭(%)
const FLOOR_EDGE_MARGIN = 5;
const BUBBLE_DURATION_MS = 2600;
/* 캐릭터와 가구 사이 이 거리(%) 안에 들어오면 상호작용 문구를 띄웁니다. */
const NEAR_DISTANCE = 14;

function clampToFloor(x: number, y: number) {
  const clampedY = Math.min(FLOOR_MAX_Y, Math.max(FLOOR_MIN_Y, y));
  const halfWidth = FLOOR_SLOPE * (clampedY - FLOOR_APEX_Y);
  const minX = Math.max(FLOOR_EDGE_MARGIN, 50 - halfWidth);
  const maxX = Math.min(100 - FLOOR_EDGE_MARGIN, 50 + halfWidth);
  return { x: Math.min(maxX, Math.max(minX, x)), y: clampedY };
}

type FurnitureLayout = Record<string, { x: number; y: number; flip: boolean }>;

function initialFurnitureLayout(): FurnitureLayout {
  return Object.fromEntries(
    furnitureItems.map(item => [item.id, { x: item.x, y: item.y, flip: !!item.flip }])
  );
}

function MiniRoomCharacter({ introSkipped }: { introSkipped: boolean }) {
  const [pos, setPos] = useState({ x: 65, y: 88 });
  const [facing, setFacing] = useState<"left" | "right">("right");
  const [modeIndex, setModeIndex] = useState(0);
  const [bubble, setBubble] = useState<string | null>(null);
  const [hovering, setHovering] = useState(false);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* 인트로를 막 지나서 미니홈피에 처음 들어온 순간에만 인사 멘트를 자동으로 띄웁니다.
     이 멘트는 타이머로 사라지지 않고, 캐릭터를 클릭해서 모드를 바꾸기 전까지 계속 떠 있습니다. */
  const wasIntroSkipped = useRef(introSkipped);
  useEffect(() => {
    if (introSkipped && !wasIntroSkipped.current) {
      const waveIndex = characterModes.findIndex(m => m.id === "waving");
      if (waveIndex !== -1) {
        const timer = setTimeout(() => {
          setModeIndex(waveIndex);
          setBubble(characterModes[waveIndex].lines[0]);
        }, 400);
        wasIntroSkipped.current = introSkipped;
        return () => clearTimeout(timer);
      }
    }
    wasIntroSkipped.current = introSkipped;
  }, [introSkipped]);

  /* 편집모드: 가구를 드래그로 옮기고 좌우 반전을 미리 볼 수 있습니다.
     여기서 옮긴 값은 화면에서만 바뀌고 저장되지 않으니, 마음에 드는 좌표를
     캡쳐해서 알려주시면 src/config/furniture.ts 에 직접 반영합니다.
     실수로 방문자가 건드리지 않도록, 주소 끝에 ?edit=1 을 붙였을 때만 켜는
     버튼이 보입니다 (배포본에는 항상 있지만 평소엔 숨어 있습니다). */
  const [editMode, setEditMode] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [layout, setLayout] = useState<FurnitureLayout>(initialFurnitureLayout);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    setCanEdit(new URLSearchParams(window.location.search).get("edit") === "1");
  }, []);
  const stageRef = useRef<HTMLDivElement>(null);

  function pointToPercent(clientX: number, clientY: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }

  function startDrag(id: string) {
    return (event: ReactMouseEvent) => {
      if (!editMode) return;
      event.preventDefault();
      event.stopPropagation();
      setDraggingId(id);
    };
  }

  useEffect(() => {
    if (!draggingId) return;
    function onMove(event: MouseEvent) {
      const point = pointToPercent(event.clientX, event.clientY);
      if (!point) return;
      setLayout(prev => ({
        ...prev,
        [draggingId!]: { ...prev[draggingId!], x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 }
      }));
    }
    function onUp() {
      setDraggingId(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingId]);

  function toggleFlip(id: string) {
    setLayout(prev => ({ ...prev, [id]: { ...prev[id], flip: !prev[id].flip } }));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "ArrowLeft") setFacing("left");
      if (event.key === "ArrowRight") setFacing("right");
      setPos(prev => {
        let { x, y } = prev;
        if (event.key === "ArrowUp") y -= CHARACTER_STEP;
        if (event.key === "ArrowDown") y += CHARACTER_STEP;
        if (event.key === "ArrowLeft") x -= CHARACTER_STEP;
        if (event.key === "ArrowRight") x += CHARACTER_STEP;
        return clampToFloor(x, y);
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => () => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
  }, []);

  const mode = characterModes[modeIndex];

  /* 캐릭터와 가장 가까운 가구를 찾습니다. 일정 거리 안이면 그 가구의 상호작용
     문구를 보여 줍니다. 클릭으로 뜬 모드 멘트(bubble)가 떠 있는 동안에는
     그게 먼저입니다. */
  const nearbyItem = useMemo(() => {
    let closest: (typeof furnitureItems)[number] | null = null;
    let closestDist = Infinity;
    for (const item of furnitureItems) {
      const placed = layout[item.id];
      if (!placed) continue;
      const dx = placed.x - pos.x;
      const dy = placed.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < NEAR_DISTANCE && dist < closestDist) {
        closest = item;
        closestDist = dist;
      }
    }
    return closest;
  }, [pos, layout]);

  const displayBubble = bubble ?? nearbyItem?.hint ?? null;

  function cycleMode() {
    const nextIndex = (modeIndex + 1) % characterModes.length;
    const nextMode = characterModes[nextIndex];
    setModeIndex(nextIndex);
    setBubble(nextMode.lines[Math.floor(Math.random() * nextMode.lines.length)]);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), BUBBLE_DURATION_MS);
  }

  return (
    <div
      className="cy-miniroom-stage"
      ref={stageRef}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <img className="cy-miniroom-bg" src={asset(profile.miniroom.src)} alt={profile.miniroom.alt} />

      {furnitureItems.map(item => {
        const placed = layout[item.id];
        return (
          <div
            key={item.id}
            className={"cy-miniroom-furniture-wrap" + (editMode ? " is-editable" : "")}
            style={{ left: `${placed.x}%`, top: `${placed.y}%`, height: `${item.heightPercent}%` }}
            onMouseDown={startDrag(item.id)}
          >
            <img
              className="cy-miniroom-furniture"
              src={asset(item.src)}
              alt={item.alt}
              draggable={false}
              style={{ transform: `scaleX(${placed.flip ? -1 : 1})` }}
            />
            {editMode ? (
              <div className="cy-edit-tag">
                <span>{item.id} · {placed.x.toFixed(1)}, {placed.y.toFixed(1)}</span>
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation();
                    toggleFlip(item.id);
                  }}
                  title="좌우 반전"
                >
                  ⇋
                </button>
              </div>
            ) : null}
          </div>
        );
      })}

      {editMode ? (
        <div
          className="cy-miniroom-character-tag"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        >
          캐릭터 · {pos.x.toFixed(1)}, {pos.y.toFixed(1)}
        </div>
      ) : null}

      {canEdit ? (
        <button
          type="button"
          className="cy-miniroom-edit-toggle"
          onClick={() => setEditMode(v => !v)}
        >
          {editMode ? "편집모드 끄기" : "편집모드"}
        </button>
      ) : null}

      {hovering && !editMode ? (
        <div className="cy-miniroom-hint">방향키로 이동 · 클릭하면 모드가 바뀌어요</div>
      ) : null}

      <button
        type="button"
        className="cy-miniroom-character"
        style={{
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          transform: `translate(-50%, -100%) scaleX(${facing === "right" ? -1 : 1})`
        }}
        onClick={cycleMode}
        aria-label={`캐릭터 모드 바꾸기 (현재: ${mode.label})`}
      >
        {displayBubble ? (
          <span
            className={`cy-character-bubble${!bubble ? " is-hint" : ""}`}
            style={{ transform: `translateX(-50%) scaleX(${facing === "right" ? -1 : 1})` }}
          >
            {displayBubble}
          </span>
        ) : null}
        <img src={asset(mode.src)} alt={`N 캐릭터 - ${mode.label}`} draggable={false} />
      </button>
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
  isOwner
}: {
  introSkipped: boolean;
  content: SiteContent;
  editing: boolean;
  update: (patch: Partial<SiteContent>) => void;
  isOwner: boolean;
}) {
  const setProfile = (patch: Partial<SiteContent["profile"]>) =>
    update({ profile: { ...content.profile, ...patch } });

  return (
    <>
      <div className="cy-content-box cy-miniroom-box">
        <SectionTitle
          title={
            <EditableText
              value={content.profile.miniroomTitle}
              editing={editing}
              placeholder="Mini Room"
              onSave={miniroomTitle => setProfile({ miniroomTitle })}
            />
          }
          sub={
            <EditableText
              value={content.profile.miniroomSub}
              editing={editing}
              placeholder="미니룸"
              onSave={miniroomSub => setProfile({ miniroomSub })}
            />
          }
        />
        <div className="cy-miniroom-inner">
          <MiniRoomCharacter introSkipped={introSkipped} />
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

function BlocksTab(props: TabViewProps & { layout?: "article" | "grid" }) {
  const blocks = props.content.blocks[props.tab.id] ?? [];
  return (
    <div className="cy-content-box">
      <SectionTitle title={props.tab.label} sub={props.editing ? "편집 중" : undefined} />
      <BlockList
        blocks={blocks}
        editing={props.editing}
        images={props.images}
        layout={props.layout ?? "article"}
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

function GuestbookList({ isOwner }: { isOwner: boolean }) {
  /* Firestore 가 설정되어 있으면 실시간 목록을, 아니면 linktree.ts 의 예시를 보여줍니다. */
  const [remote, setRemote] = useState<RemoteEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);
  const [myUid, setMyUid] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => subscribeAuthState(user => setMyUid(user?.uid ?? null)), []);

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
  const { content, isOwner, claimable, signedIn, claimOwnership, update } = useSiteContent();
  const images = useImages();

  const [activeTabId, setActiveTabId] = useState("home");
  const [introSkipped, setIntroSkipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const bgmRef = useRef<BgmHandle>(null);

  const tabs = content.tabs;
  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];
  /* 편집은 주인장만 켤 수 있습니다. 주인이 아니면 편집 상태를 강제로 끕니다. */
  const canEdit = isOwner && editing;

  const setProfile = (patch: Partial<SiteContent["profile"]>) =>
    update({ profile: { ...content.profile, ...patch } });

  /* ?tab=프로필 처럼 탭 딥링크로 들어오면 진입 화면을 건너뜁니다.
     정적 배포에서도 동작하도록 브라우저에서 읽습니다. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "1") {
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

  /* ---------------- 탭 추가 / 삭제 / 이름 변경 ---------------- */

  const addTab = () => {
    const tab: TabDef = { id: newId("tab"), label: "새 탭", kind: "custom" };
    update({ tabs: [...tabs, tab] });
    setActiveTabId(tab.id);
  };

  const renameTab = (id: string, label: string) =>
    update({ tabs: tabs.map(t => (t.id === id ? { ...t, label } : t)) });

  const removeTab = (id: string) => {
    if (id === "home") {
      window.alert("홈 탭은 지울 수 없어요.");
      return;
    }
    if (!window.confirm("이 탭을 지울까요? 안에 쓴 내용도 함께 사라집니다.")) return;
    const nextBlocks = { ...content.blocks };
    delete nextBlocks[id];
    update({ tabs: tabs.filter(t => t.id !== id), blocks: nextBlocks });
    setActiveTabId("home");
  };

  const moveTab = (id: string, delta: number) => {
    const index = tabs.findIndex(t => t.id === id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= tabs.length) return;
    const copy = [...tabs];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    update({ tabs: copy });
  };

  /* ---------------- 파도타기 링크 ---------------- */

  const waveLinks = content.waveLinks;

  const replaceWave = (id: string, patch: Partial<WaveLink>) =>
    update({ waveLinks: waveLinks.map(w => (w.id === id ? { ...w, ...patch } : w)) });

  const removeWave = (id: string) => {
    if (!window.confirm("이 링크를 지울까요?")) return;
    update({ waveLinks: waveLinks.filter(w => w.id !== id) });
  };

  const moveWave = (id: string, delta: number) => {
    const index = waveLinks.findIndex(w => w.id === id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= waveLinks.length) return;
    const copy = [...waveLinks];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    update({ waveLinks: copy });
  };

  const addWave = () =>
    update({ waveLinks: [...waveLinks, { id: newId("wave"), label: "새 링크", href: "" }] });

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
          />
        );
      case "board":
        return <BoardTab {...shared} />;
      case "photo":
        return <BlocksTab {...shared} layout="grid" />;
      case "guestbook":
        return (
          <div className="cy-content-box">
            <SectionTitle
              title={
                <EditableText
                  value={content.profile.guestbookTitle}
                  editing={canEdit}
                  placeholder="방명록"
                  onSave={guestbookTitle => setProfile({ guestbookTitle })}
                />
              }
              sub={
                <EditableText
                  value={content.profile.guestbookSub}
                  editing={canEdit}
                  placeholder="한마디 남겨주세요~"
                  onSave={guestbookSub => setProfile({ guestbookSub })}
                />
              }
            />
            <GuestbookList isOwner={isOwner} />
          </div>
        );
      default:
        return <BlocksTab {...shared} />;
    }
  };

  /* 본문을 항상 그려 두고 인트로를 그 위에 덮습니다. (.lt-intro 는 position: fixed 입니다)
     BGM 플레이어가 미리 준비되어 있어야 인트로 클릭 한 번으로 재생이 시작됩니다. */
  return (
    <div
      className="cy-root"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(10,5,18,0.4), rgba(10,5,18,0.6)), " +
          `url(${asset("/assets/cyberpunk-pixel-bg.jpg")})`
      }}
    >
      <div className="cy-background-pattern"></div>

      {/* 주인장 막대. 주소 끝에 ?admin=1 을 붙였을 때만 보입니다.
          주인장으로 로그인한 상태여도 평소 주소로 들어오면 방문자와 똑같이 보입니다. */}
      {!adminMode ? null : isOwner ? (
        <div className="cy-owner-bar">
          <span className="cy-owner-tag">주인장</span>
          <button
            type="button"
            className={`cy-owner-btn${editing ? " is-on" : ""}`}
            onClick={() => setEditing(v => !v)}
          >
            {editing ? "편집 끝내기" : "내용 편집하기"}
          </button>
          {editing ? <span className="cy-owner-hint">고칠 글자를 눌러 보세요. 바뀐 내용은 바로 저장됩니다.</span> : null}
          <button type="button" className="cy-owner-btn" onClick={() => signOutOfGoogle()}>
            로그아웃
          </button>
        </div>
      ) : (
        <div className="cy-owner-bar">
          {!signedIn ? (
            <>
              <span className="cy-owner-hint">주인장이라면 로그인해 주세요.</span>
              <button
                type="button"
                className="cy-owner-btn"
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                  } catch {
                    window.alert("로그인하지 못했어요. 팝업 차단을 풀고 다시 시도해 주세요.");
                  }
                }}
              >
                Google로 로그인
              </button>
            </>
          ) : claimable ? (
            <>
              <span className="cy-owner-hint">아직 이 미니홈피의 주인이 정해지지 않았어요.</span>
              <button
                type="button"
                className="cy-owner-btn"
                onClick={async () => {
                  try {
                    await claimOwnership();
                  } catch (error) {
                    window.alert(
                      error instanceof Error
                        ? `주인 등록에 실패했어요: ${error.message}`
                        : "주인 등록에 실패했어요."
                    );
                  }
                }}
              >
                내가 주인입니다
              </button>
            </>
          ) : (
            <>
              <span className="cy-owner-hint">이미 다른 계정이 주인으로 등록돼 있어요.</span>
              <button type="button" className="cy-owner-btn" onClick={() => signOutOfGoogle()}>
                로그아웃
              </button>
            </>
          )}
        </div>
      )}

      <div className="cy-book-wrapper">
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
                  <img src={asset(profile.photo.src)} alt={profile.photo.alt} />
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
                    value={content.profile.catalogDescription}
                    editing={canEdit}
                    placeholder="한 줄 설명"
                    onSave={catalogDescription => setProfile({ catalogDescription })}
                  />
                </div>

                <div className="cy-left-dropdown">
                  {canEdit ? (
                    <div className="cy-wave-edit">
                      {waveLinks.map(wave => (
                        <div key={wave.id} className="cy-wave-edit-row">
                          <EditableText
                            className="cy-wave-label"
                            value={wave.label}
                            editing
                            placeholder="이름"
                            onSave={label => replaceWave(wave.id, { label })}
                          />
                          <EditableText
                            className="cy-block-href"
                            value={wave.href}
                            editing
                            placeholder="https://..."
                            onSave={href => replaceWave(wave.id, { href })}
                          />
                          <div className="cy-block-tools cy-wave-tools">
                            <button type="button" onClick={() => moveWave(wave.id, -1)} title="위로">↑</button>
                            <button type="button" onClick={() => moveWave(wave.id, 1)} title="아래로">↓</button>
                            <button type="button" onClick={() => removeWave(wave.id)} title="지우기">✕</button>
                          </div>
                        </div>
                      ))}
                      <button type="button" className="cy-wave-add" onClick={addWave}>+ 링크 추가</button>
                    </div>
                  ) : (
                    <select
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
                  )}
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
                    className={"cy-tab-btn " + (activeTabId === tab.id ? "active" : "")}
                    onClick={() => setActiveTabId(tab.id)}
                  >
                    <span className="cy-tab-line">{tab.label}</span>
                  </button>
                  {canEdit ? (
                    <div className="cy-tab-tools">
                      <button
                        type="button"
                        title="탭 이름 바꾸기"
                        onClick={() => {
                          const label = window.prompt("탭 이름", tab.label);
                          if (label && label.trim()) renameTab(tab.id, label.trim());
                        }}
                      >
                        ✎
                      </button>
                      <button type="button" title="위로" onClick={() => moveTab(tab.id, -1)}>↑</button>
                      <button type="button" title="아래로" onClick={() => moveTab(tab.id, 1)}>↓</button>
                      {tab.id === "home" ? null : (
                        <button type="button" title="탭 지우기" onClick={() => removeTab(tab.id)}>✕</button>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
              {canEdit ? (
                <button type="button" className="cy-tab-add" onClick={addTab}>+ 탭</button>
              ) : null}
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