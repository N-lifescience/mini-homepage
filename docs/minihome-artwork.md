# 미니홈피 정원 테마 이미지

2026-10-11 리뉴얼에 사용한 이미지입니다. 쇼룸 이미지와 스타일은 유지합니다.

| 파일 | 용도 | 제작 방식 |
| --- | --- | --- |
| `public/assets/background-garden.webp` | 미니홈피 바깥 배경 | 첨부 배너에서 가운데 글자와 캐릭터만 제거 |
| `public/assets/miniroom-garden.webp` | 스타일 참조용 원본 | 사용자가 제공한 세로 그림, 미니룸 배경으로는 사용하지 않음 |
| `public/assets/profile-garden.webp` | 프로필 | 사용자가 제공한 단독 캐릭터 그림을 사용 |
| `public/assets/brand-garden.jpg` | 미니홈피 공유 미리보기 | 사용자가 제공한 가로 배너를 사용 |

배경 편집은 Codex 내장 `imagegen` 도구를 사용했습니다. 나머지 그림은 다시 생성하지 않았으며, 웹용으로 크기와 파일 형식만 최적화했습니다. 원본 파일은 수정하지 않았습니다.

## 배경 편집 프롬프트

> Use case: precise-object-edit. Edit target: the supplied landscape illustration. Asset type: full-screen website wallpaper behind an opaque notebook UI. Remove ONLY all central Korean lettering, the underline, and the four central cartoon mascots together with their laptop, open book and flask. Fill their former area seamlessly with the same pale cream meadow, small grass shoots and soft mint botanical atmosphere. Keep the original wide 16:9 framing, soft hand-painted style, mint and spring-green palette, DNA strand, floating cells, neuron, microscope at left, books, test tubes at right, leafy borders, daisies and stream. Center should remain quiet and pale. No text, no characters, no logos, no new objects.

## 확인

- 모바일 320/375px, 태블릿 768/1024px, PC 1440px에서 화면과 가로 넘침 확인.
- 진입 버튼, 인사 말풍선, 게시판·활동 탭·낙서장, 파도타기 첫 항목 확인.
- 한국어 문구: humanize-korean light, 변경률 0%, 등급 B, 자체검증 6/6, 공통 게이트 통과. 짧은 UI 문구가 자연스러워 원문을 유지했습니다.

## 상호작용 미니룸 애셋

사용자의 정정에 따라 미니룸을 하나의 그림으로 표시하던 구현을 제거했습니다. 기존 방향키 이동, 여섯 캐릭터 모드, 가까운 소품 말풍선, `?edit=1`의 소품 드래그·좌우 반전 기능을 유지합니다.

Codex 내장 `imagegen` 도구로 빈 배경과 투명 소품/캐릭터 atlas를 각각 생성했습니다. atlas를 개별 WebP로 잘라 사용하며 생성된 alpha를 보존했습니다. 원본 캐릭터의 큰 잎 모양 귀, 갈색 무늬, 흰 가운과 N 표시는 참조 이미지에 맞췄습니다.

| 저장 경로 | 구성 |
| --- | --- |
| `public/assets/miniroom-garden/background.webp` | 가구·캐릭터가 없는 정원 연구실 배경 |
| `public/assets/miniroom-garden/furniture/` | 실험대, 현미경 책상, 의자, 학습 보드, 칠판, 표본 병, 책장, 화분 |
| `public/assets/miniroom-garden/character/` | standing, waving, floating, walking, observing, mascot 여섯 모드 |
| `artwork/miniroom-garden/props-atlas.png` | 소품 생성 원본 |
| `artwork/miniroom-garden/character-atlas.png` | 캐릭터 생성 원본 |
| `artwork/miniroom-garden/prompts.json` | 도구 종류·참조 파일·최종 프롬프트 세트 |

원래 일곱 소품 ID와 여섯 모드 ID를 그대로 사용했습니다. 추가 화분 애셋은 예비 소품으로 보관합니다. 배치 좌표는 `src/config/furniture.ts`에 있으며 기존 연구실의 실험대·책상·의자·보드·칠판·표본·수납 구성을 따릅니다. 캐릭터와 소품의 y 좌표로 가림 순서를 정했습니다. 모바일 이동 버튼은 기존 방향키와 같은 이동 함수를 사용합니다. 관리 화면(`?admin=1`)의 미니룸 메뉴에서 소품과 바다토끼를 옮깁니다. 바다토끼를 놓은 곳이 방문자의 시작 위치가 돼요. 수정한 배치는 변경사항 저장을 누르면 공개돼요. 저장한 배치가 없으면 `src/config/furniture.ts`와 기본 시작 위치를 사용합니다. 로그인하지 않은 `?edit=1`은 배치 미리보기만 제공합니다.

검증: 실제 브라우저에서 여섯 모드 순환, 방향키와 모바일 버튼 이동, 바닥 경계 제한, 소품 접근 말풍선, 드래그·좌우 반전 확인. 320/375/768/1024/1440px 화면과 가로 넘침 확인. 한국어 문구와 이미지 대체 문구는 humanize-korean light 게이트를 각각 통과했습니다(변경률 0%, B, 자체검증 6/6, exit 0). 빌드·테스트 검증 결과는 세션 체크포인트에 기록합니다.
