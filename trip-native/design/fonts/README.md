# design/fonts

`Inter-SemiBold.ttf` — 핀 이미지에 순서 숫자를 그려 넣는 데만 쓴다
(`scripts/generate-pin-assets.py`). 앱 번들에는 들어가지 않는다.

출처: `node_modules/expo-dev-menu/android/src/main/res/font/inter_semibold.ttf`
(Inter, SIL Open Font License 1.1 — https://github.com/rsms/inter)

생성기가 재현 가능해야 해서 node_modules에 의존하지 않고 복사해 두었다.
