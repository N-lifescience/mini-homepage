# 미니홈피 정원 테마 이미지

2026-10-11 리뉴얼에 사용한 이미지입니다. 쇼룸 이미지와 스타일은 유지합니다.

| 파일 | 용도 | 제작 방식 |
| --- | --- | --- |
| `public/assets/background-garden.webp` | 미니홈피 바깥 배경 | 첨부 배너에서 가운데 글자와 캐릭터만 제거 |
| `public/assets/miniroom-garden.webp` | 미니룸 | 사용자가 제공한 세로 그림을 그대로 사용 |
| `public/assets/profile-garden.webp` | 프로필 | 사용자가 제공한 단독 캐릭터 그림을 사용 |
| `public/assets/brand-garden.jpg` | 미니홈피 공유 미리보기 | 사용자가 제공한 가로 배너를 사용 |

배경 편집은 Codex 내장 `imagegen` 도구를 사용했습니다. 나머지 그림은 다시 생성하지 않았으며, 웹용으로 크기와 파일 형식만 최적화했습니다. 원본 파일은 수정하지 않았습니다.

## 배경 편집 프롬프트

> Use case: precise-object-edit. Edit target: the supplied landscape illustration. Asset type: full-screen website wallpaper behind an opaque notebook UI. Remove ONLY all central Korean lettering, the underline, and the four central cartoon mascots together with their laptop, open book and flask. Fill their former area seamlessly with the same pale cream meadow, small grass shoots and soft mint botanical atmosphere. Keep the original wide 16:9 framing, soft hand-painted style, mint and spring-green palette, DNA strand, floating cells, neuron, microscope at left, books, test tubes at right, leafy borders, daisies and stream. Center should remain quiet and pale. No text, no characters, no logos, no new objects.

## 확인

- 모바일 320/375px, 태블릿 768/1024px, PC 1440px에서 화면과 가로 넘침 확인.
- 진입 버튼, 인사 말풍선, 게시판·활동 탭·낙서장, 파도타기 첫 항목 확인.
- 한국어 문구: humanize-korean light, 변경률 0%, 등급 B, 자체검증 6/6, 공통 게이트 통과. 짧은 UI 문구가 자연스러워 원문을 유지했습니다.
