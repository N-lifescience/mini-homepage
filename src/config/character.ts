/* 미니룸 캐릭터 모드입니다. 클릭할 때마다 다음 모드로 바뀌고,
   해당 모드의 멘트 중 하나가 말풍선으로 뜹니다. */
export type CharacterMode = {
  id: string;
  label: string;
  src: string;
  lines: string[];
};

export const characterModes: CharacterMode[] = [
  {
    id: "standing",
    label: "기본",
    src: "/assets/character/n-standing.png",
    lines: ["안녕하세요! 저는 N이에요.", "오늘도 생명과학 탐구 완료!"]
  },
  {
    id: "waving",
    label: "인사",
    src: "/assets/character/n-waving.png",
    lines: ["반가워요! 잘 왔어요 👋", "방문해줘서 고마워요!"]
  },
  {
    id: "floating1",
    label: "부유",
    src: "/assets/character/n-floating1.png",
    lines: ["둥실~ 잎사귀 충전 중...", "광합성 타임 🌿"]
  },
  {
    id: "floating2",
    label: "이동",
    src: "/assets/character/n-floating2.png",
    lines: ["실험 결과 분석하러 갑니다!", "다음 발견을 향해 출발!"]
  },
  {
    id: "action1",
    label: "분석",
    src: "/assets/character/n-action1.png",
    lines: ["새로운 DNA 데이터 로딩 중...", "홀로그램 분석 완료!"]
  },
  {
    id: "mascot",
    label: "마스코트",
    src: "/assets/character/n-mascot.png",
    lines: ["N-LAB 로고 모드!", "생명과학의 상징이 될게요."]
  }
];
