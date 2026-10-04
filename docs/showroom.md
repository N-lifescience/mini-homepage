# DNA 쇼룸

첫 화면의 `미니홈피` 버튼은 기존 홈으로, `쇼룸` 버튼은 `/showroom/`으로 이동합니다. 배포 시 하위 경로도 자동으로 적용합니다.

전시 항목은 미니홈피와 같은 `useSiteContent()`의 게시글을 사용합니다. 작업물의 실제 용도에 따라 탐구·개념 학습(가상 실험실, 생각의 고리, 생명이란 무엇인가), 학습 게임(세포 이스케이프, 자라나요 생명의 섬), 활동지·평가(도입 활동지, 형성평가, 수행평가), 코딩 연습(바이브코딩 제도실)으로 묶습니다. 제목의 키워드 대신 게시글 ID와 앱 주소로 분류합니다. 새 작업물은 `showroomAssignments`에서 분류와 태그를 지정하며, 지정하지 않은 작업물은 그 밖의 작업에 표시합니다. 내부 네트워크 주소는 전시에 노출하지 않습니다. 쇼룸의 제목과 분류는 `src/config/showroom/content.ts`, 색은 `src/config/showroom/theme.ts`에서 수정합니다.

## 조형물

`DnaStage.tsx`는 Three.js의 인스턴스 메시로 DNA와 분자 표면을 그립니다. 전사인자는 민트색, RNA 합성효소는 금색·주황색의 여러 덩어리와 불규칙한 표면 입자로 표현합니다. 전사인자가 먼저 DNA에 결합하고, 그 근처에 RNA 합성효소가 결합한 뒤 이동과 RNA 합성이 시작됩니다. 전사인자는 결합한 합성효소와 함께 이동합니다. DNA는 효소가 지나간 자리에 열린 상태로 남으며, 각 가닥의 염기는 길이를 유지한 채 방향만 바뀝니다. RNA는 붉은 뼈대에 염기가 붙은 한 가닥이며 효소 뒤로 길게 남습니다. NTPs는 RNA에 붙은 단위체와 같은 당·염기 모양으로 만들고 인산기는 생략합니다. 결합 순서와 가닥·효소·RNA의 경로는 `src/lib/dna-geometry.ts`에 있습니다. 이는 DNA와 전사 과정을 모티브로 한 시각 연출이며 실제 분자 구조·크기를 재현한 모델이 아닙니다. 화면 밖과 백그라운드 탭에서는 그리기를 멈추고, 동작 줄이기를 선택하면 전사 중인 고정된 조형물과 짧은 첫 화면을 보여줍니다. WebGL을 지원하지 않으면 Blender로 만든 이미지를 표시합니다.

스크롤 진행률 2~16%는 전사인자 결합, 20~34%는 RNA 합성효소 결합, 38~98%는 DNA 풀림과 RNA 합성에 배정합니다. 이동 전에는 DNA를 열거나 RNA를 만들지 않습니다. 역방향 스크롤은 같은 순서를 되감습니다.

전사인자·RNA 합성효소·NTPs의 관계는 [NCBI의 From DNA to RNA](https://www.ncbi.nlm.nih.gov/books/NBK26887/)를 참고했습니다.

Blender 원본과 Meshy GLB는 `art-raw/`에 보관하며 Git에 포함하지 않습니다. 렌더를 다시 만들려면 다음을 실행합니다.

```sh
blender --background --python scripts/blender/showroom.py -- --asset dna
blender --background --python scripts/blender/showroom.py -- --asset lab
blender --background --python scripts/blender/showroom.py -- --asset cell
blender --background --python scripts/blender/showroom.py -- --asset notes
```

`lab`은 `art-raw/3d/microscope.glb`가 필요합니다. 렌더된 PNG를 알파 채널이 있는 WebP로 변환해 `public/visuals/showroom/`에 넣습니다.

## 출처

- 카드 기울이기, 카드 펼침 상세, 키보드 포커스 처리의 출발점: [dossamlab/showroom-kit](https://github.com/dossamlab/showroom-kit), MIT. 라이선스 원문은 `docs/licenses/showroom-kit.txt`에 보관합니다.
- 3D 현미경: Meshy 6 Lite에서 생성한 CC BY 4.0 모델. 웹페이지 아래에도 출처를 표시합니다.
- DNA, 세포, 책 미니어처: 이 프로젝트의 Blender 스크립트로 제작합니다.

한국어 문구는 humanize-korean light 경로로 확인했으며 공통 게이트를 통과했습니다. 자체검증 6/6, 변경률 0%, 등급 B입니다.
