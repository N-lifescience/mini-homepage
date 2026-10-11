import { furnitureItems } from "@/config/furniture";

export type RoomPosition = { x: number; y: number };
export type MiniRoomLayout = {
  furniture: Record<string, RoomPosition & { flip: boolean }>;
  characterStart: RoomPosition;
};

export const roomItemLabels: Record<string, string> = {
  character: "바다토끼",
  "lab-counter": "실험대",
  "desk-hologram": "현미경 책상",
  "office-chair": "의자",
  whiteboard: "학습 보드",
  blackboard: "칠판",
  "specimen-tube": "표본 병",
  "server-lockers": "책장"
};

export function clampCharacterPosition(x: number, y: number, edgeMargin = 5): RoomPosition {
  const clampedY = Math.min(88, Math.max(43, y));
  const halfWidth = 1.07 * (clampedY - 40);
  return {
    x: Math.min(Math.min(100 - edgeMargin, 50 + halfWidth), Math.max(Math.max(edgeMargin, 50 - halfWidth), x)),
    y: clampedY
  };
}

export function defaultMiniRoomLayout(): MiniRoomLayout {
  return {
    furniture: Object.fromEntries(furnitureItems.map(item => [item.id, { x: item.x, y: item.y, flip: !!item.flip }])),
    characterStart: { x: 65, y: 88 }
  };
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function coordinate(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : fallback;
}

export function normalizeMiniRoomLayout(value: unknown): MiniRoomLayout {
  const base = defaultMiniRoomLayout();
  const raw = object(value), furniture = object(raw.furniture), start = object(raw.characterStart);
  return {
    furniture: Object.fromEntries(furnitureItems.map(item => {
      const placed = object(furniture[item.id]), fallback = base.furniture[item.id];
      return [item.id, {
        x: coordinate(placed.x, fallback.x), y: coordinate(placed.y, fallback.y),
        flip: typeof placed.flip === "boolean" ? placed.flip : fallback.flip
      }];
    })),
    characterStart: clampCharacterPosition(coordinate(start.x, base.characterStart.x), coordinate(start.y, base.characterStart.y))
  };
}

export function isMiniRoomLayoutValid(layout: MiniRoomLayout): boolean {
  const finite = (n: number) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;
  if (!layout?.characterStart || !layout.furniture) return false;
  const { x, y } = layout.characterStart;
  if (!finite(x) || !finite(y)) return false;
  const clamped = clampCharacterPosition(x, y);
  return clamped.x === x && clamped.y === y && furnitureItems.every(item => {
    const position = layout.furniture[item.id];
    return position && finite(position.x) && finite(position.y) && typeof position.flip === "boolean";
  });
}
