/* 각 소품은 투명 이미지로 배경 위에 배치됩니다. 바닥 좌표와 상호작용은 기존 방식을 따릅니다. */
export type FurnitureItem = {
  id: string;
  src: string;
  alt: string;
  x: number;
  y: number;
  heightPercent: number;
  /* 좌우로 뒤집어서 놓고 싶으면 true 로 둡니다. */
  flip?: boolean;
  /* 캐릭터가 방향키로 가까이 다가가면 뜨는 상호작용 문구입니다. */
  hint: string;
};

export const furnitureItems: FurnitureItem[] = [
  {
    "id": "lab-counter",
    "src": "/assets/miniroom-garden/furniture/lab-counter.webp",
    "alt": "나무 실험대와 유리 실험 도구",
    "x": 50,
    "y": 60,
    "heightPercent": 30,
    "hint": "실험대에서 오늘의 발견을 정리하고 있어요!"
  },
  {
    "id": "desk-hologram",
    "src": "/assets/miniroom-garden/furniture/microscope-desk.webp",
    "alt": "현미경과 식물 관찰 노트가 있는 책상",
    "x": 29,
    "y": 72,
    "heightPercent": 27,
    "hint": "현미경으로 잎을 자세히 살펴볼까요?"
  },
  {
    "id": "office-chair",
    "src": "/assets/miniroom-garden/furniture/leaf-stool.webp",
    "alt": "초록 잎 무늬 방석이 있는 나무 의자",
    "x": 47,
    "y": 75,
    "heightPercent": 16,
    "hint": "잠깐 앉아서 쉬어갈까요?"
  },
  {
    "id": "whiteboard",
    "src": "/assets/miniroom-garden/furniture/botany-board.webp",
    "alt": "새싹과 세포 그림이 있는 학습 보드",
    "x": 75,
    "y": 62,
    "heightPercent": 27,
    "hint": "새싹과 세포를 함께 살펴봐요."
  },
  {
    "id": "blackboard",
    "src": "/assets/miniroom-garden/furniture/chalkboard.webp",
    "alt": "DNA와 잎 그림이 있는 초록 칠판",
    "x": 14,
    "y": 86,
    "heightPercent": 26,
    "hint": "오늘의 수업 내용을 적어볼까요?"
  },
  {
    "id": "specimen-tube",
    "src": "/assets/miniroom-garden/furniture/seedling-jar.webp",
    "alt": "작은 새싹이 자라는 유리 표본 병",
    "x": 36,
    "y": 93,
    "heightPercent": 20,
    "hint": "작은 새싹이 자라고 있어요."
  },
  {
    "id": "server-lockers",
    "src": "/assets/miniroom-garden/furniture/bookcase.webp",
    "alt": "책과 식물 표본을 보관하는 나무 책장",
    "x": 86,
    "y": 86,
    "heightPercent": 32,
    "hint": "다음 탐구에 쓸 책을 골라볼까요?"
  }
];
