#!/usr/bin/env python3
"""
지도 핀 에셋 생성기.

왜 숫자를 PNG에 구워넣는가:
  안드로이드의 react-native-maps는 Marker에 자식 뷰가 있으면 그 뷰를
  "레이아웃으로 측정된 크기"의 비트맵에 draw()해서 지도에 올린다
  (MapMarker.createDrawable). 측정값은 shadow node가 비동기로 넘기므로
  아직 0이면 100x100 물리픽셀로 떨어지고, 그 밖은 직각으로 잘린다.
  자식 뷰가 없으면 getIcon()이 비트맵을 그대로 반환해서(MapMarker:466)
  캡처 경로를 아예 타지 않는다. 그래서 숫자까지 이미지에 넣는다.

입력:  design/pin-bodies/pin_<color>_<state>.png  (256x320 RGBA, 몸통만)
출력:  assets/map-pins/*.png (+@2x,@3x)  및  components/pinAssets.ts

재생성:  python3 scripts/generate-pin-assets.py
"""

import os
import re
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'design', 'pin-bodies')
OUT = os.path.join(ROOT, 'assets', 'map-pins')
FONT = os.path.join(ROOT, 'design', 'fonts', 'Inter-SemiBold.ttf')
ICONS = os.path.join(ROOT, 'assets', 'icons')
TABLE = os.path.join(ROOT, 'components', 'pinAssets.ts')

COLORS = ['pink', 'mint', 'yellow', 'lavender', 'blue']
STATES = ['default', 'selected']

# 선택 시 커지는 것도 이미지 크기로 표현한다 — 뷰를 안 쓰므로 크기가
# 바뀌어도 잘릴 일이 없다.
#
# 시안(§5)은 36x45 / 44x55dp지만 그대로 쓰면 개요 화면의 260dp 지도에서
# 핀이 지도 높이의 17%를 먹어 너무 크다. 시안의 가로 치수(36/44)를 높이로
# 쓰고 선택 시 비율(55/45)은 유지했다.
HEIGHT_DP = {'default': 36, 'selected': 44}
DENSITIES = [1, 2, 3]

# 일정 순서 숫자를 구워둘 범위. 하루 일정이 이보다 많으면 숫자 없는 몸통으로
# 떨어진다(MapPin.tsx 참고). 하루 30곳은 현실적으로 넘지 않는다.
MAX_ORDER = 30

NUMBER_FILL = (0x29, 0x29, 0x29, 255)   # COLORS.text
GLYPH_RATIO = 0.41                      # 전구 지름 대비 숫자 크기
ICON_RATIO = 0.42                       # 전구 지름 대비 아이콘 크기

# 카테고리 아이콘. 시안 세트에 식기·커피·카메라·쇼핑백이 없어서 숙소만 대응된다.
CATEGORY_ICON = {'lavender': 'home'}

ALPHA_MIN = 16    # 이보다 옅은 픽셀은 눈에 안 보이므로 윤곽에서 제외한다


def content_box(im):
    """보이는 픽셀만 감싸는 상자. 좌우는 꼬리 끝 x를 기준으로 대칭을 맞추고,
    아래는 꼬리의 마지막 픽셀에 딱 붙인다 — anchor y=1이 좌표를 가리키도록."""
    w, h = im.size
    a = im.split()[3].load()
    rows = {}
    for y in range(h):
        xs = [x for x in range(w) if a[x, y] >= ALPHA_MIN]
        if xs:
            rows[y] = (xs[0], xs[-1])

    top, bottom = min(rows), max(rows)
    tip_l, tip_r = rows[bottom]
    cx = (tip_l + tip_r) / 2.0           # 꼬리 끝 = 핀의 수평 중심

    left = min(l for l, _ in rows.values())
    right = max(r for _, r in rows.values())
    half = max(cx - left, right - cx)
    return (
        int(round(cx - half)), top,
        int(round(cx + half)) + 1, bottom + 1,
    )


def bulb_radius(im, box):
    """전구(원형부)의 색칠된 반지름. 선택형의 흰 테두리는 제외하려고
    가장 흔한 몸통 색으로만 측정한다."""
    w, h = im.size
    px = im.load()
    cy = 119                                  # 두 상태 공통 전구 중심 y
    body = px[w // 2, cy][:3]
    xs = [x for x in range(w) if px[x, cy][:3] == body and px[x, cy][3] >= 200]
    return (xs[-1] - xs[0] + 1) / 2.0


def tint(path, size, color):
    """단색 PNG를 color로 칠한다. Icon.tsx의 tintColor와 같은 결과."""
    ic = Image.open(path).convert('RGBA')
    ic = ic.crop(ic.split()[3].getbbox()).resize((size, size), Image.LANCZOS)
    flat = Image.new('RGBA', ic.size, color)
    flat.putalpha(ic.split()[3])
    return flat


def render(color, state, order=None):
    """핀 하나를 원본 해상도로 합성해서 돌려준다."""
    im = Image.open(os.path.join(SRC, f'pin_{color}_{state}.png')).convert('RGBA')
    r = bulb_radius(im, None)
    box = content_box(im)
    cx_full, cy_full = (box[0] + box[2]) / 2.0, 119

    if order is not None:
        d = ImageDraw.Draw(im)
        f = ImageFont.truetype(FONT, int(round(2 * r * GLYPH_RATIO)))
        s = str(order)
        l, t, rr, b = d.textbbox((0, 0), s, font=f)
        # 잉크 기준으로 전구 중심에 맞춘다 (폰트 여백 기준이 아니라)
        d.text((cx_full - (l + rr) / 2.0, cy_full - (t + b) / 2.0),
               s, font=f, fill=NUMBER_FILL)
        if rr - l > 2 * r * 0.84:
            sys.exit(f'숫자 {s}가 전구를 넘어간다 — GLYPH_RATIO를 줄여라')
    else:
        name = CATEGORY_ICON.get(color)
        if name:
            size = int(round(2 * r * ICON_RATIO))
            ic = tint(os.path.join(ICONS, f'{name}.png'), size, NUMBER_FILL)
            im.alpha_composite(
                ic, (int(round(cx_full - size / 2)), int(round(cy_full - size / 2))))

    return im.crop(box)


def write(im, stem, state):
    """밀도별로 내려서 저장한다. 안드로이드는 image 마커를 비트맵의
    픽셀 크기 그대로 그리므로, 밀도에 맞는 크기를 미리 만들어야 한다.
    원본 256x320을 그대로 쓰면 핀이 화면을 덮는다."""
    cw, ch = im.size
    for d in DENSITIES:
        ph = HEIGHT_DP[state] * d
        pw = int(round(ph * cw / ch))
        suffix = '' if d == 1 else f'@{d}x'
        im.resize((pw, ph), Image.LANCZOS).save(
            os.path.join(OUT, f'{stem}{suffix}.png'), optimize=True)
    return HEIGHT_DP[state], int(round(HEIGHT_DP[state] * cw / ch))


def main():
    if not os.path.isfile(FONT):
        sys.exit(f'폰트가 없다: {FONT}')
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    bodies, numbered, dims = {}, {}, {}

    for color in COLORS:
        for state in STATES:
            stem = f'pin_{color}_{state}'
            dims[stem] = write(render(color, state), stem, state)
            bodies.setdefault(color, {})[state] = stem

    # 저장된 장소에는 카테고리 정보가 없어서 순서 핀은 항상 핑크다.
    # 색깔별로 1..30을 다 만들면 에셋이 900장이 되므로 핑크만 만든다.
    for state in STATES:
        for n in range(1, MAX_ORDER + 1):
            stem = f'pin_pink_{n:02d}_{state}'
            dims[stem] = write(render('pink', state, n), stem, state)
            numbered.setdefault(state, {})[n] = stem

    def req(stem):
        return f"require('../assets/map-pins/{stem}.png')"

    L = []
    L.append('// 이 파일은 scripts/generate-pin-assets.py가 만든다. 직접 고치지 마라.')
    L.append('// 숫자가 이미지에 구워져 있는 이유는 생성기 주석을 참고.')
    L.append('')
    L.append("export type PinColor = 'pink' | 'mint' | 'yellow' | 'lavender' | 'blue'")
    L.append("export type PinState = 'default' | 'selected'")
    L.append('')
    L.append(f'/** 순서 숫자를 구워둔 최대 번호. 넘으면 숫자 없는 몸통으로 떨어진다. */')
    L.append(f'export const MAX_ORDER = {MAX_ORDER}')
    L.append('')
    L.append('/** 카테고리 색 몸통. 숙소만 아이콘이 들어가 있다. */')
    L.append('export const BODY: Record<PinColor, Record<PinState, number>> = {')
    for color in COLORS:
        L.append(f'  {color}: {{')
        for state in STATES:
            L.append(f'    {state}: {req(bodies[color][state])},')
        L.append('  },')
    L.append('}')
    L.append('')
    L.append('/** 순서 숫자 핀 (핑크 전용) */')
    L.append('export const NUMBERED: Record<PinState, Record<number, number>> = {')
    for state in STATES:
        L.append(f'  {state}: {{')
        for n in range(1, MAX_ORDER + 1):
            L.append(f'    {n}: {req(numbered[state][n])},')
        L.append('  },')
    L.append('}')
    L.append('')
    with open(TABLE, 'w') as fh:
        fh.write('\n'.join(L))

    n = len(os.listdir(OUT))
    size = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f'{n} files, {size/1024:.0f} KB')
    for stem in ('pin_pink_default', 'pin_pink_selected',
                 'pin_pink_02_default', 'pin_pink_18_selected'):
        print(f'  {stem}: {dims[stem][1]}x{dims[stem][0]} dp')


if __name__ == '__main__':
    main()
