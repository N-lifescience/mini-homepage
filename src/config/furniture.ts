/* 미니룸에 고정 배치하는 가구/소품입니다. 방 바닥(꼭짓점에서 벌어지는 삼각형) 모양에
   맞춰 x(가로 %)·y(세로 %)를 잡았습니다 — y가 클수록(화면 아래, 보는 사람과 가까움)
   바닥 폭이 넓어지니 x를 중앙(50)에서 더 멀리 둬도 됩니다. */
export type FurnitureItem = {
  id: string;
  src: string;
  alt: string;
  x: number;
  y: number;
  heightPercent: number;
  /* 좌우로 뒤집어서 놓고 싶으면 true 로 둡니다. */
  flip?: boolean;
};

export const furnitureItems: FurnitureItem[] = [
  {
    id: "lab-counter",
    src: "/assets/furniture/lab-counter.png",
    alt: "DNA 홀로그램이 있는 실험대",
    x: 49.9,
    y: 59.6,
    heightPercent: 34
  },
  {
    id: "desk-hologram",
    src: "/assets/furniture/desk-hologram.png",
    alt: "홀로그램 모니터가 있는 책상",
    x: 28.5,
    y: 71.1,
    heightPercent: 26
  },
  {
    id: "office-chair",
    src: "/assets/furniture/office-chair.png",
    alt: "사무용 의자",
    x: 50.6,
    y: 69.7,
    heightPercent: 20
  },
  {
    id: "whiteboard",
    src: "/assets/furniture/whiteboard.png",
    alt: "CYBER-BIO 101 화이트보드",
    x: 78.1,
    y: 59.1,
    heightPercent: 24,
    flip: true
  },
  {
    id: "blackboard",
    src: "/assets/furniture/blackboard.png",
    alt: "CYBER-BIO 101 칠판",
    x: 10.7,
    y: 83.7,
    heightPercent: 22
  },
  {
    id: "specimen-tube",
    src: "/assets/furniture/specimen-tube.png",
    alt: "표본 튜브",
    x: 34.4,
    y: 91.7,
    heightPercent: 22
  },
  {
    id: "server-lockers",
    src: "/assets/furniture/server-lockers.png",
    alt: "서버랙 겸 사물함",
    x: 89.9,
    y: 84.9,
    heightPercent: 26,
    flip: true
  }
];
