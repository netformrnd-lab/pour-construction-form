# 원리 설명 모션그래픽 (실제 제품 이미지를 그대로 사용 — 트랩 형상은 절대 AI로 다시 그리지 않음)
# build_v6.py 에서 import 해서 사용. 배경·낙엽·콘크리트 질감만 AI 이미지.
import math, random, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 30
FONT = 'fonts/NotoSansCJKkr-Bold.otf'


def font(sz):
    return ImageFont.truetype(FONT, sz)


def rgba(p):
    return Image.open(p).convert('RGBA')


def trim(im):
    bb = im.getchannel('A').getbbox()
    return im.crop(bb) if bb else im


def scale_w(im, w):
    return im.resize((w, max(1, int(im.height * w / im.width))), Image.LANCZOS)


def cover(im):
    im = im.convert('RGB')
    r = max(W / im.width, H / im.height)
    im = im.resize((int(im.width * r) + 1, int(im.height * r) + 1), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))


def encode(frame_fn, d, out):
    n = max(1, int(round(d * FPS)))
    p = subprocess.Popen(f'ffmpeg -y -v error -f rawvideo -pix_fmt rgb24 -s {W}x{H} -r {FPS} -i - '
                         f'-c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -an {out}',
                         shell=True, stdin=subprocess.PIPE)
    for i in range(n):
        p.stdin.write(frame_fn(i / FPS).convert('RGB').tobytes())
    p.stdin.close(); p.wait()


def chip(d, text, x0=60, y0=170, fill=(60, 60, 60, 220), color='white', sz=52):
    f = font(sz); tw = d.textlength(text, font=f)
    d.rounded_rectangle((x0, y0, x0 + tw + 56, y0 + sz + 40), 14, fill=fill)
    d.text((x0 + 28, y0 + 14), text, font=f, fill=color)


def tag(d):
    f = font(34); t = '원리 설명 화면'; tw = d.textlength(t, font=f)
    d.rectangle((W - 50 - tw - 28, 90, W - 50, 90 + 34 + 28), fill=(0, 0, 0, 90))
    d.text((W - 50 - tw - 14, 100), t, font=f, fill=(255, 255, 255, 220))


def pointer(d, text, tx, ty, lx, ly, sz=40, fill=(15, 31, 92, 235)):
    """라벨(lx,ly 좌상단) → 대상점(tx,ty) 지시선"""
    f = font(sz); tw = d.textlength(text, font=f)
    bx1, by1 = lx + tw + 40, ly + sz + 26
    d.line((tx, ty, (lx if tx < lx else bx1), ly + (by1 - ly) // 2), fill=(255, 255, 255, 230), width=4)
    d.ellipse((tx - 9, ty - 9, tx + 9, ty + 9), fill=(255, 255, 255, 240))
    d.rounded_rectangle((lx, ly, bx1, by1), 12, fill=fill)
    d.text((lx + 20, ly + 10), text, font=f, fill='white')


def ease(t):
    t = max(0.0, min(1.0, t)); return 1 - (1 - t) ** 3


def rain(d, t, n=70, seed=7, ymax=H, alpha=70):
    rnd = random.Random(seed)
    for _ in range(n):
        x = rnd.uniform(0, W); sp = rnd.uniform(1400, 2000); off = rnd.uniform(0, ymax)
        y = (off + sp * t) % ymax
        d.line((x, y, x - 6, y + 34), fill=(255, 255, 255, alpha), width=2)


def leaf_sprites(path, k=6):
    """흰 배경 위 낙엽 사진 → 낱장 스프라이트"""
    im = rgba(path)
    small = im.convert('L').resize((200, 200))
    px = small.load()
    seen = [[False] * 200 for _ in range(200)]
    boxes = []
    for y in range(200):
        for x in range(200):
            if seen[y][x] or px[x, y] > 215:
                continue
            st = [(x, y)]; seen[y][x] = True; x0 = x1 = x; y0 = y1 = y; cnt = 0
            while st:
                cx, cy = st.pop(); cnt += 1
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < 200 and 0 <= ny < 200 and not seen[ny][nx] and px[nx, ny] <= 215:
                        seen[ny][nx] = True; st.append((nx, ny))
            if cnt > 40:
                boxes.append((cnt, x0, y0, x1, y1))
    boxes.sort(reverse=True)
    sx, sy = im.width / 200, im.height / 200
    out = []
    for _, x0, y0, x1, y1 in boxes[:k]:
        c = im.crop((int(x0 * sx) - 4, int(y0 * sy) - 4, int((x1 + 1) * sx) + 4, int((y1 + 1) * sy) + 4))
        a = c.convert('L').point(lambda v: 0 if v > 225 else 255).filter(ImageFilter.GaussianBlur(1))
        c.putalpha(a); out.append(trim(c))
    print('leaves', len(out), flush=True)
    return out


# ① 밖에서 큰 이물질: 실제 제품 사진 + 떨어져 걸리는 낙엽 + 옆으로 빠지는 물길
def mg_outside(bg_path, prod_path, leaves_path, d, out, label='① 밖에서 큰 이물질'):
    bg = cover(rgba(bg_path)).convert('RGBA')
    prod = scale_w(trim(rgba(prod_path)), 860)
    px, py = (W - prod.width) // 2, 1080 - prod.height // 2
    leaves = leaf_sprites(leaves_path)
    rnd = random.Random(3)
    plan = []
    for j, lf in enumerate(leaves[:5]):
        lf = scale_w(lf, rnd.randint(150, 220))
        tx = px + int(prod.width * rnd.uniform(0.2, 0.75)); ty = py + int(prod.height * rnd.uniform(0.02, 0.3))
        plan.append((lf, 0.25 + j * 0.35, tx, ty, rnd.uniform(-40, 40)))
    base_y = py + int(prod.height * 0.5)

    def frame(t):
        im = bg.copy(); im.alpha_composite(prod, (px, py))
        lay = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(lay)
        # 물길: 양옆에서 덮개 아래쪽 틈으로
        if t > 0.6:
            k = min(1, (t - 0.6) / 0.5)
            for side in (-1, 1):
                for m in range(5):
                    ph = ((t * 1.2 + m / 5) % 1)
                    x = W // 2 + side * int(520 - 300 * ph); y = base_y + 40 + int(30 * math.sin(ph * 3))
                    d.ellipse((x - 16, y - 7, x + 16, y + 7), fill=(120, 190, 255, int(170 * k)))
        rain(d, t)
        im.alpha_composite(lay)
        for lf, t0, tx, ty, rot in plan:
            if t < t0: continue
            p = ease((t - t0) / 0.9)
            x = tx - lf.width // 2; y = int(-260 + (ty + 260) * p) - lf.height // 2
            r = lf.rotate(rot * (1 - p) + rot * 0.2, expand=True, resample=Image.BICUBIC)
            im.alpha_composite(r, (x, y))
        d2 = ImageDraw.Draw(im); chip(d2, label); tag(d2)
        if t > 1.2:
            pointer(d2, '큰 낙엽은 밖에서 걸림', px + int(prod.width * 0.5), py + int(prod.height * 0.12), 520, 330)
            pointer(d2, '물은 옆 틈으로', W // 2 + 360, base_y + 40, 600, base_y + 160)
        return im
    encode(frame, d, out)


# ② 안에서 작은 이물질: 위에서 본 배수구 — 거름망 덮개가 사라지고 배기통 지지대에 찌꺼기가 걸림
def mg_inside(bg_path, support_path, dome_path, d, out, label='② 안에서 작은 이물질'):
    bg = cover(rgba(bg_path)).convert('RGBA')
    cx, cy = W // 2, 980
    sup = scale_w(trim(rgba(support_path)), 760)
    dome = scale_w(trim(rgba(dome_path)), 760)
    sx, sy = cx - sup.width // 2, cy - sup.height // 2
    dx, dy = cx - dome.width // 2, cy - dome.height // 2
    # 지지대의 짙은(날개) 부분 좌표 → 찌꺼기 착지점
    a = sup.getchannel('A'); g = sup.convert('L')
    pts = [(x, y) for y in range(0, sup.height, 6) for x in range(0, sup.width, 6)
           if a.getpixel((x, y)) > 200 and g.getpixel((x, y)) < 90]
    rnd = random.Random(11)
    grit = []
    for j in range(46):
        x, y = rnd.choice(pts)
        grit.append((0.9 + rnd.uniform(0, max(0.2, d - 1.6)), sx + x, sy + y, rnd.randint(5, 11),
                     rnd.choice([(120, 92, 60), (150, 120, 80), (110, 105, 98), (170, 140, 90)])))

    def frame(t):
        im = bg.copy(); d0 = ImageDraw.Draw(im)
        d0.ellipse((cx - 330, cy - 330, cx + 330, cy + 330), fill=(205, 205, 205, 255))
        d0.ellipse((cx - 300, cy - 300, cx + 300, cy + 300), fill=(28, 30, 34, 255))
        # 가운데로 빠지는 물 (파문)
        for m in range(3):
            ph = (t * 0.9 + m / 3) % 1
            r = int(40 + 200 * ph)
            d0.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(110, 180, 255, int(160 * (1 - ph))), width=6)
        im.alpha_composite(sup, (sx, sy))
        lay = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(lay)
        for t0, x, y, r, col in grit:
            if t < t0: continue
            p = ease((t - t0) / 0.5)
            rr = int(r * (2.4 - 1.4 * p)); yy = int(y - 140 * (1 - p))
            d.ellipse((x - rr, yy - rr, x + rr, yy + rr * 0.8), fill=col + (int(110 + 145 * p),))
        im.alpha_composite(lay)
        if t < 1.3:
            k = 1 - max(0, (t - 0.7) / 0.6)
            dm = dome.copy(); dm.putalpha(dm.getchannel('A').point(lambda v: int(v * k)))
            im.alpha_composite(dm, (dx, dy))
        d2 = ImageDraw.Draw(im); chip(d2, label); tag(d2)
        if t < 1.2:
            pointer(d2, '거름망 덮개 아래', cx, cy - 250, 560, 330)
        else:
            pointer(d2, '배기통 지지대에서 한 번 더', cx + 230, cy + 60, 300, 1330)
        return im
    encode(frame, d, out)


# ③ 배관 속까지: 단면 — 배기통에 연장시트를 이어 콘크리트 속 PVC 배관까지 → 물은 그 안으로만
def mg_deep(conc_path, prod_path, d, split, out, label='③ 배관 속까지 깊게'):
    yr = 700  # 옥상 바닥면
    sky = Image.new('RGBA', (W, yr))
    ds = ImageDraw.Draw(sky)
    for y in range(yr):
        c = int(206 - 30 * y / yr); ds.line((0, y, W, y), fill=(c, c + 4, c + 10, 255))
    conc = cover(rgba(conc_path)).convert('RGBA').crop((0, 0, W, H - yr))
    prod = trim(rgba(prod_path))
    # 제품 사진에서 플랜지(가장 넓은 행)와 하부 관 폭을 측정
    A = prod.getchannel('A')
    widths = []
    for y in range(prod.height):
        row = A.crop((0, y, prod.width, y + 1)).getbbox()
        widths.append((row[2] - row[0]) if row else 0)
    fy = max(range(prod.height), key=lambda y: widths[y])
    tube_w = sorted(widths[int(prod.height * 0.85):])[len(widths[int(prod.height * 0.85):]) // 2] or prod.width // 3
    s = 760 / max(widths)
    prod = prod.resize((int(prod.width * s), int(prod.height * s)), Image.LANCZOS)
    fy = int(fy * s); tw = int(tube_w * s)
    px, py = (W - prod.width) // 2, yr - fy
    tube_bottom = py + prod.height
    iw = tw // 2 + 14; ow = iw + 30
    cx = W // 2
    print('deep geom', fy, tw, tube_bottom, flush=True)

    def frame(t):
        im = Image.new('RGBA', (W, H)); im.alpha_composite(sky, (0, 0)); im.alpha_composite(conc, (0, yr))
        d0 = ImageDraw.Draw(im)
        d0.rectangle((0, yr - 16, W, yr), fill=(242, 242, 240, 255))               # 방수 코팅면
        d0.rectangle((cx - ow, yr, cx + ow, H), fill=(150, 156, 164, 255))       # PVC 배관 벽(단면)
        d0.rectangle((cx - iw, yr, cx + iw, H), fill=(58, 62, 68, 255))          # 배관 속
        d0.line((cx - ow + 6, yr, cx - ow + 6, H), fill=(190, 196, 204, 255), width=4)
        d0.line((cx + iw + 6, yr, cx + iw + 6, H), fill=(190, 196, 204, 255), width=4)
        # 연장시트: 1문장 동안 아래로 쭉 이어짐
        p = ease(t / max(0.5, split * 0.85))
        y_end = int(tube_bottom - 6 + (H + 40 - tube_bottom) * p)
        lay = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(lay)
        d.rectangle((cx - tw // 2 + 4, tube_bottom - 10, cx + tw // 2 - 4, y_end), fill=(248, 248, 248, 200))
        for fx in (-0.3, 0.05, 0.32):
            d.line((cx + int(tw * fx), tube_bottom, cx + int(tw * fx), y_end), fill=(215, 215, 215, 200), width=3)
        d.line((cx - tw // 2 + 4, tube_bottom, cx - tw // 2 + 4, y_end), fill=(200, 200, 200, 230), width=4)
        d.line((cx + tw // 2 - 4, tube_bottom, cx + tw // 2 - 4, y_end), fill=(200, 200, 200, 230), width=4)
        # 물: 2문장부터 시트 안으로만 흐름
        if t > split * 0.7:
            k = min(1, (t - split * 0.7) / 0.4)
            for m in range(10):
                ph = (t * 1.1 + m / 10) % 1
                y = int(yr - 140 + (H - yr + 140) * ph)
                if y > y_end: continue
                d.rounded_rectangle((cx - 10, y, cx + 10, y + 70), 8, fill=(110, 180, 255, int(190 * k)))
            for side in (-1, 1):
                for m in range(4):
                    ph = (t * 1.3 + m / 4) % 1
                    x = cx + side * int(470 - 330 * ph)
                    d.ellipse((x - 18, yr - 30, x + 18, yr - 16), fill=(110, 180, 255, int(170 * k)))
        rain(d, t, ymax=yr - 20)
        im.alpha_composite(lay)
        im.alpha_composite(prod, (px, py))
        d2 = ImageDraw.Draw(im); chip(d2, label); tag(d2)
        pointer(d2, '배기통', cx + tw // 2, py + fy + 60, 760, 390)
        if p > 0.5:
            pointer(d2, '연장시트 (위아래 뚫림)', cx + tw // 2 - 6, min(y_end - 60, 1250), 560, 1040)
        pointer(d2, 'PVC 배관', cx - ow + 8, 1330, 60, 1250)
        if t > split:
            d2.rounded_rectangle((60, 860, 520, 940), 14, fill=(3, 150, 90, 235))
            d2.text((84, 872), '콘크리트엔 물 안 닿음', font=font(40), fill='white')
        return im
    encode(frame, d, out)
