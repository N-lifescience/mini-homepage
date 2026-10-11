"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { asset } from "@/lib/asset";
import { profile } from "@/config/linktree";
import { characterModes } from "@/config/character";
import { furnitureItems } from "@/config/furniture";
import { clampCharacterPosition, defaultMiniRoomLayout, roomItemLabels, type MiniRoomLayout } from "@/lib/miniroom-layout";

/* 배경, 소품, 캐릭터는 독립 레이어입니다. 기존 미니룸 이동·배치 기능을 유지합니다. */
const CHARACTER_STEP = 3;
const FLOOR_EDGE_MARGIN = 5;
const BUBBLE_DURATION_MS = 2600;
/* 캐릭터와 가구 사이 이 거리(%) 안에 들어오면 상호작용 문구를 띄웁니다. */
const NEAR_DISTANCE = 14;
const BUBBLE_EDGE = 8;
const BUBBLE_GAP = 10;

const DEFAULT_LAYOUT = defaultMiniRoomLayout();

function CoordinateField({ label, value, disabled, onChange }: {
  label: string; value: number; disabled: boolean; onChange: (value: number) => number;
}) {
  const format = (n: number) => String(Math.round(n * 10) / 10);
  const [text, setText] = useState(format(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(format(value)); }, [value]);
  return <label>{label} (%)<input type="number" inputMode="decimal" min="0" max="100" step="0.1" disabled={disabled} value={text}
    onFocus={() => { focused.current = true; }}
    onChange={event => {
      setText(event.target.value);
      if (Number.isFinite(event.target.valueAsNumber)) onChange(event.target.valueAsNumber);
    }}
    onBlur={event => {
      focused.current = false;
      setText(format(Number.isFinite(event.target.valueAsNumber) ? onChange(event.target.valueAsNumber) : value));
    }} />
  </label>;
}

export default function MiniRoom({ introSkipped, roomLayout = DEFAULT_LAYOUT, onLayoutChange, editing = false, disabled = false }: {
  introSkipped: boolean; roomLayout?: MiniRoomLayout; onLayoutChange?: (layout: MiniRoomLayout) => void;
  editing?: boolean; disabled?: boolean;
}) {
  const [pos, setPos] = useState(roomLayout.characterStart);
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

  // Anonymous ?edit=1 remains a preview. Only the owner's content editor can publish.
  const [localEditMode, setEditMode] = useState(false);
  const editMode = editing || localEditMode;
  const [canEdit, setCanEdit] = useState(false);
  const [layout, setLayout] = useState(roomLayout);
  const layoutRef = useRef(layout);
  const [selectedId, setSelectedId] = useState("character");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    layoutRef.current = roomLayout;
    setLayout(roomLayout);
    setPos(roomLayout.characterStart);
  }, [roomLayout]);

  useEffect(() => {
    if (editMode) setPos(layoutRef.current.characterStart);
  }, [editMode]);

  function applyLayout(next: MiniRoomLayout, publish = true) {
    layoutRef.current = next;
    setLayout(next);
    setPos(next.characterStart);
    if (publish) onLayoutChange?.(next);
  }

  function placeItem(id: string, x: number, y: number, publish = true) {
    const previous = layoutRef.current;
    if (id === "character") {
      const point = clampCharacterPosition(x, y);
      applyLayout({ ...previous, characterStart: point }, publish);
      return point;
    } else {
      const point = { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
      applyLayout({ ...previous, furniture: { ...previous.furniture, [id]: { ...previous.furniture[id], ...point } } }, publish);
      return point;
    }
  }

  function nudgeItem(id: string, key: string) {
    if (disabled || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) return false;
    const point = id === "character" ? layoutRef.current.characterStart : layoutRef.current.furniture[id];
    placeItem(id, point.x + (key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0), point.y + (key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0));
    return true;
  }

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
      if (!editMode || disabled) return;
      if (id !== "character" && (event.target as HTMLElement).closest("button")) return;
      event.preventDefault();
      event.stopPropagation();
      (event.currentTarget as HTMLElement).focus();
      setSelectedId(id);
      const pointer = pointToPercent(event.clientX, event.clientY);
      const anchor = id === "character" ? layoutRef.current.characterStart : layoutRef.current.furniture[id];
      if (pointer) dragOffset.current = { x: pointer.x - anchor.x, y: pointer.y - anchor.y };
      setDraggingId(id);
    };
  }

  useEffect(() => {
    if (!draggingId) return;
    function onMove(event: PointerEvent) {
      const point = pointToPercent(event.clientX, event.clientY);
      if (!point) return;
      placeItem(draggingId!, Math.round((point.x - dragOffset.current.x) * 10) / 10, Math.round((point.y - dragOffset.current.y) * 10) / 10, false);
    }
    function onUp() {
      onLayoutChange?.(layoutRef.current);
      setDraggingId(null);
    }
    function onCancel() {
      layoutRef.current = roomLayout;
      setLayout(roomLayout);
      setPos(roomLayout.characterStart);
      setDraggingId(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [draggingId, onLayoutChange, roomLayout]);

  function toggleFlip(id: string) {
    const previous = layoutRef.current;
    applyLayout({ ...previous, furniture: { ...previous.furniture, [id]: { ...previous.furniture[id], flip: !previous.furniture[id].flip } } });
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
      return clampCharacterPosition(x, y, edgeMargin);
    });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (editMode || !introSkipped || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      moveCharacter(event.key);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [introSkipped, editMode]);

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
      const placed = layout.furniture[item.id];
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

  const displayBubble = editMode ? null : bubble ?? nearbyItem?.hint ?? null;
  const selected = selectedId === "character" ? layout.characterStart : layout.furniture[selectedId];

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
      className={`cy-miniroom-stage${editMode ? " is-arranging" : ""}`}
      ref={stageRef}
      role="group"
      aria-label="생명과학 미니룸"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <img className="cy-miniroom-bg" src={asset(profile.miniroom.src)} alt={profile.miniroom.alt} />

      {furnitureItems.map(item => {
        const placed = layout.furniture[item.id];
        return (
          <div
            key={item.id}
            className={"cy-miniroom-furniture-wrap" + (editMode ? " is-editable" : "") + (editMode && selectedId === item.id ? " is-selected" : "")}
            style={{ left: `${placed.x}%`, top: `${placed.y}%`, height: `${item.heightPercent}%`, zIndex: Math.round(placed.y * 10) }}
            onPointerDown={startDrag(item.id)}
            role={editMode ? "button" : undefined}
            tabIndex={editMode ? 0 : undefined}
            aria-label={editMode ? roomItemLabels[item.id] : undefined}
            aria-pressed={editMode ? selectedId === item.id : undefined}
            onFocus={() => { if (editMode) setSelectedId(item.id); }}
            onKeyDown={event => {
              if (!editMode) return;
              if (nudgeItem(item.id, event.key)) event.preventDefault();
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(item.id); }
            }}
          >
            <img
              className="cy-miniroom-furniture"
              src={asset(item.src)}
              alt={item.alt}
              draggable={false}
              style={{ transform: `scaleX(${placed.flip ? -1 : 1})` }}
            />
          </div>
        );
      })}

      {!editing && (canEdit || onLayoutChange) ? (
        <button
          type="button"
          className="cy-miniroom-edit-toggle"
          disabled={disabled}
          onClick={() => setEditMode(v => !v)}
        >
          {editMode ? "배치 편집 끝내기" : "배치 편집"}
        </button>
      ) : null}

      {hovering && !editMode && !displayBubble ? (
        <div className="cy-miniroom-hint">방향키로 이동 · 클릭하면 모드가 바뀌어요</div>
      ) : null}

      <button
        type="button"
        className={`cy-miniroom-character${editMode && selectedId === "character" ? " is-selected" : ""}`}
        ref={characterRef}
        style={{
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          zIndex: Math.round(pos.y * 10) + 1,
          transform: `translate(-50%, -100%) scaleX(${facing === "right" ? -1 : 1})`
        }}
        onPointerDown={startDrag("character")}
        onClick={() => { if (editMode) setSelectedId("character"); else cycleMode(); }}
        onFocus={() => { if (editMode) setSelectedId("character"); }}
        onKeyDown={event => { if (editMode && nudgeItem("character", event.key)) event.preventDefault(); }}
        aria-label={editMode ? "바다토끼" : `캐릭터 모드 바꾸기 (현재: ${mode.label})`}
        aria-pressed={editMode ? selectedId === "character" : undefined}
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
    {editMode ? <div className="cy-room-editor">
      <p>소품이나 바다토끼를 끌어서 옮겨 보세요. 바다토끼를 놓은 곳이 방문자의 시작 위치가 돼요.</p>
      <div className="cy-room-fields">
        <label>선택한 대상<select disabled={disabled} value={selectedId} onChange={event => setSelectedId(event.target.value)}>
          {Object.entries(roomItemLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        {(["x", "y"] as const).map(axis => <CoordinateField key={`${selectedId}-${axis}`} label={axis === "x" ? "가로 위치" : "세로 위치"} value={selected[axis]} disabled={disabled}
          onChange={value => placeItem(selectedId, axis === "x" ? value : selected.x, axis === "y" ? value : selected.y)[axis]} />)}
      </div>
      <div className="cy-room-editor-actions">
        {selectedId !== "character" ? <button type="button" disabled={disabled} aria-pressed={layout.furniture[selectedId].flip} onClick={() => toggleFlip(selectedId)}>좌우 반전</button> : null}
        <button type="button" disabled={disabled} onClick={() => applyLayout(defaultMiniRoomLayout())}>기본 배치로 되돌리기</button>
      </div>
      <p className="cy-room-editor-note">선택한 대상을 방향키로 옮길 수 있어요.</p>
      <p className="cy-room-editor-note">{onLayoutChange ? "수정한 배치는 변경사항 저장을 누르면 공개돼요." : <>이 화면에서는 배치만 미리 볼 수 있어요. 저장하려면 주인장 계정으로 로그인해 주세요. <a href={asset("/?admin=1")}>로그인하고 배치 저장</a></>}</p>
    </div> : null}
    {!editMode ? <>
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
    </> : null}
    </div>
  );
}
