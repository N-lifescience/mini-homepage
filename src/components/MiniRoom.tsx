"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { asset } from "@/lib/asset";
import { profile } from "@/config/linktree";
import { characterModes } from "@/config/character";
import { furnitureItems } from "@/config/furniture";

/* 배경, 소품, 캐릭터는 독립 레이어입니다. 기존 미니룸 이동·배치 기능을 유지합니다. */
const CHARACTER_STEP = 3;
const FLOOR_APEX_Y = 40; // 바닥이 시작되는 꼭짓점의 세로 위치(%)
const FLOOR_MIN_Y = 43;
const FLOOR_MAX_Y = 88;
const FLOOR_SLOPE = 1.07; // 꼭짓점에서 아래로 1% 내려갈 때 바닥이 좌우로 넓어지는 폭(%)
const FLOOR_EDGE_MARGIN = 5;
const BUBBLE_DURATION_MS = 2600;
/* 캐릭터와 가구 사이 이 거리(%) 안에 들어오면 상호작용 문구를 띄웁니다. */
const NEAR_DISTANCE = 14;
const BUBBLE_EDGE = 8;
const BUBBLE_GAP = 10;

function clampToFloor(x: number, y: number, edgeMargin = FLOOR_EDGE_MARGIN) {
  const clampedY = Math.min(FLOOR_MAX_Y, Math.max(FLOOR_MIN_Y, y));
  const halfWidth = FLOOR_SLOPE * (clampedY - FLOOR_APEX_Y);
  const minX = Math.max(edgeMargin, 50 - halfWidth);
  const maxX = Math.min(100 - edgeMargin, 50 + halfWidth);
  return { x: Math.min(maxX, Math.max(minX, x)), y: clampedY };
}

type FurnitureLayout = Record<string, { x: number; y: number; flip: boolean }>;

function initialFurnitureLayout(): FurnitureLayout {
  return Object.fromEntries(
    furnitureItems.map(item => [item.id, { x: item.x, y: item.y, flip: !!item.flip }])
  );
}

export default function MiniRoom({ introSkipped }: { introSkipped: boolean }) {
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
  const characterRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubbleSize, setBubbleSize] = useState<{
    stageWidth: number; stageHeight: number; characterHeight: number; width: number; height: number;
  } | null>(null);

  useEffect(() => {
    // Cache all poses so the existing click-to-cycle interaction does not flash.
    characterModes.forEach(mode => { const image = new Image(); image.src = asset(mode.src); });
  }, []);

  function pointToPercent(clientX: number, clientY: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }

  function startDrag(id: string) {
    return (event: ReactPointerEvent) => {
      if (!editMode) return;
      event.preventDefault();
      event.stopPropagation();
      if ((event.target as HTMLElement).closest("button")) return;
      setDraggingId(id);
    };
  }

  useEffect(() => {
    if (!draggingId) return;
    function onMove(event: PointerEvent) {
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
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [draggingId]);

  function toggleFlip(id: string) {
    setLayout(prev => ({ ...prev, [id]: { ...prev[id], flip: !prev[id].flip } }));
  }

  function moveCharacter(key: string) {
    const stageWidth = stageRef.current?.clientWidth ?? 1;
    const characterWidth = characterRef.current?.offsetWidth ?? 44;
    const edgeMargin = Math.max(FLOOR_EDGE_MARGIN, ((characterWidth / 2 + 4) / stageWidth) * 100);
    if (key === "ArrowLeft") setFacing("left");
    if (key === "ArrowRight") setFacing("right");
    setPos(prev => {
      let { x, y } = prev;
      if (key === "ArrowUp") y -= CHARACTER_STEP;
      if (key === "ArrowDown") y += CHARACTER_STEP;
      if (key === "ArrowLeft") x -= CHARACTER_STEP;
      if (key === "ArrowRight") x += CHARACTER_STEP;
      return clampToFloor(x, y, edgeMargin);
    });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!introSkipped || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      moveCharacter(event.key);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [introSkipped]);

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

  // Measure the rendered lines so the balloon fits at every room size and zoom level.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const character = characterRef.current;
    const balloon = bubbleRef.current;
    if (!displayBubble || !stage || !character || !balloon) return;
    function measure() {
      const next = {
        stageWidth: stage!.clientWidth, stageHeight: stage!.clientHeight,
        characterHeight: character!.offsetHeight, width: balloon!.offsetWidth, height: balloon!.offsetHeight
      };
      setBubbleSize(prev => prev && Object.keys(next).every(key => prev[key as keyof typeof next] === next[key as keyof typeof next]) ? prev : next);
    }
    measure();
    const observer = new ResizeObserver(measure);
    [stage, character, balloon].forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [displayBubble, modeIndex]);

  let bubbleStyle: CSSProperties = { left: "50%", top: BUBBLE_EDGE, visibility: "hidden" };
  let bubblePlacement = "above";
  if (bubbleSize) {
    const anchorX = pos.x / 100 * bubbleSize.stageWidth;
    const halfWidth = bubbleSize.width / 2;
    const left = Math.max(BUBBLE_EDGE + halfWidth, Math.min(bubbleSize.stageWidth - BUBBLE_EDGE - halfWidth, anchorX));
    const feetY = pos.y / 100 * bubbleSize.stageHeight;
    const aboveTop = feetY - bubbleSize.characterHeight - BUBBLE_GAP - bubbleSize.height;
    // At the back wall, put the balloon below the character rather than over its face.
    bubblePlacement = aboveTop < BUBBLE_EDGE ? "below" : "above";
    const top = Math.max(BUBBLE_EDGE, Math.min(
      bubbleSize.stageHeight - bubbleSize.height - BUBBLE_EDGE - 5,
      bubblePlacement === "below" ? feetY + BUBBLE_GAP : aboveTop
    ));
    bubbleStyle = {
      left, top,
      "--bubble-tail": `${Math.max(12, Math.min(bubbleSize.width - 12, anchorX - left + halfWidth))}px`
    } as CSSProperties;
  }

  function cycleMode() {
    const nextIndex = (modeIndex + 1) % characterModes.length;
    const nextMode = characterModes[nextIndex];
    setModeIndex(nextIndex);
    setBubble(nextMode.lines[Math.floor(Math.random() * nextMode.lines.length)]);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), BUBBLE_DURATION_MS);
  }

  return (
    <div className="cy-interactive-room">
    <div
      className="cy-miniroom-stage"
      ref={stageRef}
      role="group"
      aria-label="생명과학 미니룸"
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
            style={{ left: `${placed.x}%`, top: `${placed.y}%`, height: `${item.heightPercent}%`, zIndex: Math.round(placed.y * 10) }}
            onPointerDown={startDrag(item.id)}
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

      {hovering && !editMode && !displayBubble ? (
        <div className="cy-miniroom-hint">방향키로 이동 · 클릭하면 모드가 바뀌어요</div>
      ) : null}

      <button
        type="button"
        className="cy-miniroom-character"
        ref={characterRef}
        style={{
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          zIndex: Math.round(pos.y * 10) + 1,
          transform: `translate(-50%, -100%) scaleX(${facing === "right" ? -1 : 1})`
        }}
        onClick={cycleMode}
        aria-label={`캐릭터 모드 바꾸기 (현재: ${mode.label})`}
      >
        <img src={asset(mode.src)} alt={`N 캐릭터 - ${mode.label}`} draggable={false} />
      </button>
      {displayBubble ? (
        <div
          className={`cy-character-bubble is-positioned${!bubble ? " is-hint" : ""}`}
          ref={bubbleRef}
          data-placement={bubblePlacement}
          role="status"
          aria-live="polite"
          style={bubbleStyle}
        >
          {displayBubble}
        </div>
      ) : null}
    </div>
    <div className="cy-room-toolbar">
      <span>방향키로 이동 · 캐릭터를 누르면 모드가 바뀌어요</span>
      <div className="cy-room-controls" role="group" aria-label="캐릭터 이동">
        {[
          ["ArrowUp", "위로 이동", "↑"],
          ["ArrowLeft", "왼쪽으로 이동", "←"],
          ["ArrowDown", "아래로 이동", "↓"],
          ["ArrowRight", "오른쪽으로 이동", "→"]
        ].map(([key, label, symbol]) => (
          <button key={key} type="button" aria-label={label} onClick={() => moveCharacter(key)}>{symbol}</button>
        ))}
      </div>
    </div>
    </div>
  );
}
