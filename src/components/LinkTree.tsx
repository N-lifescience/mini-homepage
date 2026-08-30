"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
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
  boardPosts,
  episodes,
  guestbook,
  photos,
  profile,
  profileSections,
  waveLinks
} from "@/config/linktree";
import { theme } from "@/config/theme";
import { characterModes } from "@/config/character";
import { furnitureItems } from "@/config/furniture";

const ALL_TABS = ["home", "profile", "story", "board", "photo"] as const;
type TabName = (typeof ALL_TABS)[number];

/* 연재물이 하나도 없으면 탭 자체를 숨깁니다. */
const TABS: TabName[] = ALL_TABS.filter(tab => tab !== "story" || episodes.length > 0);

/* 탭 버튼과 오른쪽 위 제목에 쓰는 이름표입니다. profile.ts 값을 따릅니다. */
const NAV_LABELS: Record<TabName, string> = {
  home: "홈",
  profile: "프로필",
  story: profile.storyLabel,
  board: profile.boardLabel,
  photo: profile.photoLabel
};

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

function IntroOverlay({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="lt-intro" style={introStyle}>
      <Spiral className="lt-intro-spiral" {...spiralProps} />
      <div className="lt-intro-card">
        <span className="lt-intro-title">{profile.introTitle}</span>
        <p className="lt-intro-copy">{profile.introDescription}</p>
        <button type="button" className="lt-intro-cta" onClick={onBrowse}>
          모든 활동 구경하기
          <ChevronDown size={18} />
        </button>
      </div>
    </div>
  );
}

const TAB_TITLES: Record<TabName, string> = {
  home: profile.catalogTitle,
  profile: "프로필",
  story: profile.storyLabel,
  board: profile.boardLabel,
  photo: profile.photoLabel
};

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
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

  /* 인트로를 막 지나서 미니홈피에 처음 들어온 순간에만 인사 멘트를 자동으로 띄웁니다. */
  const wasIntroSkipped = useRef(introSkipped);
  useEffect(() => {
    if (introSkipped && !wasIntroSkipped.current) {
      const waveIndex = characterModes.findIndex(m => m.id === "waving");
      if (waveIndex !== -1) {
        const timer = setTimeout(() => {
          setModeIndex(waveIndex);
          setBubble(characterModes[waveIndex].lines[0]);
          bubbleTimer.current = setTimeout(() => setBubble(null), BUBBLE_DURATION_MS);
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
          transform: `translate(-50%, -100%) scaleX(${facing === "left" ? -1 : 1})`
        }}
        onClick={cycleMode}
        aria-label={`캐릭터 모드 바꾸기 (현재: ${mode.label})`}
      >
        {bubble ? (
          <span
            className="cy-character-bubble"
            style={{ transform: `translateX(-50%) scaleX(${facing === "left" ? -1 : 1})` }}
          >
            {bubble}
          </span>
        ) : null}
        <img src={asset(mode.src)} alt={`N 캐릭터 - ${mode.label}`} draggable={false} />
      </button>
    </div>
  );
}

function HomeTab({ introSkipped }: { introSkipped: boolean }) {
  return (
    <>
      <div className="cy-content-box cy-miniroom-box">
        <SectionTitle title="Mini Room" sub="미니룸" />
        <div className="cy-miniroom-inner">
          <MiniRoomCharacter introSkipped={introSkipped} />
        </div>
      </div>

      <div className="cy-content-box">
        <SectionTitle title="What friends say" sub="한마디로 표현한다면~" />
        <GuestbookList />
      </div>
    </>
  );
}

function ProfileTab() {
  return (
    <>
      {profileSections.map(section => (
        <div key={section.id} className="cy-content-box">
          <SectionTitle title={section.title} sub={section.subtitle} />
          {section.blocks.map((block, bi) => {
            if (block.kind === "text") {
              return (
                <div key={bi} className="cy-text-block">
                  {block.lines.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              );
            }
            if (block.kind === "list") {
              return (
                <div key={bi} className="cy-profile-list-box">
                  <div className="cy-profile-list-heading">{block.heading}</div>
                  <ul className="cy-profile-list">
                    {block.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              );
            }
            return (
              <ul key={bi} className="cy-contact-list">
                {block.items.map(item => (
                  <li key={item.href}>
                    <span className="cy-contact-label">{item.label}</span>
                    <a
                      href={item.href}
                      target={item.href.startsWith("mailto:") ? undefined : "_blank"}
                      rel="noopener noreferrer"
                    >
                      {item.value}
                    </a>
                  </li>
                ))}
              </ul>
            );
          })}
        </div>
      ))}
    </>
  );
}

function StoryTab() {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = episodes.find(e => e.id === openId);

  if (open) {
    return (
      <div className="cy-content-box">
        <SectionTitle
          title={open.title ? `${open.label} ${open.title}` : open.label}
          sub={`${open.cuts.length}컷`}
        />
        <button className="cy-back-btn" onClick={() => setOpenId(null)}>
          목록으로
        </button>
        <div className="cy-cut-list">
          {open.cuts.map((cut, i) => (
            <img key={cut} src={asset(cut)} alt={`${open.label} ${i + 1}컷`} loading="lazy" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="cy-content-box">
      <SectionTitle title={profile.storyLabel} sub={`전체 ${episodes.length}화`} />
      <ul className="cy-episode-grid">
        {episodes.map(episode => (
          <li key={episode.id}>
            <button className="cy-episode-card" onClick={() => setOpenId(episode.id)}>
              <span className="cy-episode-thumb">
                <img src={asset(episode.thumb)} alt={episode.label} loading="lazy" />
              </span>
              <span className="cy-episode-label">{episode.label}</span>
              {episode.title ? (
                <span className="cy-episode-title">{episode.title}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BoardTab() {
  return (
    <div className="cy-content-box">
      <SectionTitle title={profile.boardLabel} sub={profile.boardSubtitle} />
      {boardPosts.length === 0 ? (
        <div className="cy-empty-box">
          {profile.boardEmptyText}
        </div>
      ) : (
        <ul className="cy-board-list">
          {boardPosts.map(post => (
            <li key={post.id} className="cy-board-item">
              <a className="cy-board-link" href={post.href} target="_blank" rel="noopener noreferrer">
                {post.preview ? (
                  <span className="cy-board-preview">
                    <img src={asset(post.preview.src)} alt={post.preview.alt} loading="lazy" />
                  </span>
                ) : null}
                <span className="cy-board-text">
                  <span className="cy-board-head">
                    <span className="cy-board-category">{post.category}</span>
                    <span className="cy-board-title">{post.title}</span>
                  </span>
                  {post.summary ? <span className="cy-board-summary">{post.summary}</span> : null}
                  <span className="cy-board-date">{post.date}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* 방명록은 구글 로그인을 해야 남길 수 있습니다 (도배 방지용 잠금이고,
   이름은 로그인과 상관없이 직접 적은 값을 그대로 씁니다). */
function GuestbookForm() {
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
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
      await addGuestbookEntry(author, text);
      setAuthor("");
      setText("");
      setMessage({ kind: "ok", text: "한줄평을 남겼어요. 고맙습니다!" });
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
          {loggingIn ? "로그인 중…" : "Google로 로그인하고 한줄평 남기기"}
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
        placeholder="한줄평을 남겨주세요"
        maxLength={GUESTBOOK_LIMITS.text}
        aria-label="한줄평"
      />
      <button className="cy-gb-submit" type="submit" disabled={sending}>
        {sending ? "전송중" : "남기기"}
      </button>
      {message ? (
        <span className={`cy-gb-message${message.kind === "error" ? " is-error" : ""}`}>{message.text}</span>
      ) : null}
    </form>
  );
}

const GUESTBOOK_FETCH_LIMIT = 30;
const GUESTBOOK_PAGE_SIZE = 5;

function GuestbookList() {
  /* Firestore 가 설정되어 있으면 실시간 목록을, 아니면 linktree.ts 의 예시를 보여줍니다. */
  const [remote, setRemote] = useState<RemoteEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);
  const [myUid, setMyUid] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isGuestbookEnabled) return;
    return subscribeGuestbook(GUESTBOOK_FETCH_LIMIT, setRemote, () => setFailed(true));
  }, []);

  useEffect(() => subscribeAuthState(user => setMyUid(user?.uid ?? null)), []);

  const removeEntry = async (id: string) => {
    if (deletingId) return;
    if (!window.confirm("이 한줄평을 지울까요?")) return;
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
      {live && remote === null ? <div className="cy-gb-loading">한줄평을 불러오는 중…</div> : null}

      <div className="cy-guestbook-list">
        {entries.length === 0 ? (
          <div className="cy-gb-loading">아직 한줄평이 없어요. 첫 줄을 남겨 주세요!</div>
        ) : (
          pageEntries.map(c => (
            <div key={c.key} className="cy-guestbook-item">
              <span className="cg-author">
                {c.author} <span className="cg-colon">:</span>{" "}
              </span>
              <span className="cg-text">{c.text}</span>
              <span className="cg-date">({c.date})</span>
              {live && myUid && "uid" in c && c.uid === myUid ? (
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

      {live ? <GuestbookForm /> : null}
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

function PhotoTab() {
  return (
    <div className="cy-content-box">
      <SectionTitle title={profile.photoLabel} sub={`${profile.photoSubtitlePrefix} ${photos.length}컷`} />
      <ul className="cy-photo-grid">
        {photos.map(photo => (
          <li key={photo.id} className="cy-photo-item">
            <div className="cy-photo-frame">
              <img src={asset(photo.src)} alt={photo.name} loading="lazy" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LinkTree() {
  const [activeTab, setActiveTab] = useState<TabName>("home");
  const [introSkipped, setIntroSkipped] = useState(false);
  const bgmRef = useRef<BgmHandle>(null);

  /* ?tab=프로필 처럼 탭 딥링크로 들어오면 진입 화면을 건너뜁니다.
     정적 배포에서도 동작하도록 브라우저에서 읽습니다. */
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    const found = TABS.find(t => t === tab);
    if (found) {
      setActiveTab(found);
      setIntroSkipped(true);
    }
  }, []);

  /* 인트로가 떠 있는 동안에는 뒤쪽이 스크롤되지 않게 막습니다. */
  useEffect(() => {
    if (introSkipped) return;
    document.body.classList.add("lt-intro-open");
    return () => document.body.classList.remove("lt-intro-open");
  }, [introSkipped]);

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

                <div className="cy-intro-text">
                  {profile.introDescription}
                </div>

                <BgmPlayer ref={bgmRef} />

                <div className="cy-profile-name">
                  <div className="name-bold">{profile.teacherName}</div>
                  <div className="title-sub">{profile.catalogDescription}</div>
                </div>

                <div className="cy-left-dropdown">
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
                </div>
              </div>
            </div>

            {/* 우측 패널 */}
            <div className="cy-right-panel">
              <div className="cy-right-header">
                <span className="cy-title">{TAB_TITLES[activeTab]}</span>
                <span className="cy-url">{profile.displayUrl}</span>
              </div>

              <div className="cy-right-content">
                {activeTab === "home" && <HomeTab introSkipped={introSkipped} />}
                {activeTab === "profile" && <ProfileTab />}
                {activeTab === "story" && <StoryTab />}
                {activeTab === "board" && <BoardTab />}
                {activeTab === "photo" && <PhotoTab />}
              </div>
            </div>

            {/* 탭 영역 */}
            <div className="cy-tabs">
              {TABS.map(tab => (
                <button
                  key={tab}
                  className={"cy-tab-btn " + (activeTab === tab ? "active" : "")}
                  onClick={() => setActiveTab(tab)}
                >
                  <span className="cy-tab-line">{NAV_LABELS[tab]}</span>
                </button>
              ))}
            </div>

          </div>
        </div>
      </div>

      {!introSkipped ? (
        <IntroOverlay
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
