# 범용 숏폼 조립 스크립트 — 숏폼 스튜디오(대시보드) "빌드 설정 JSON" 하나로 완성 mp4 + 캡컷 소스를 만든다 (Higgsfield sandbox에서 실행)
# 기준: prompts/shorts/drain-trap/build_v12.py (옥상배관방수트랩 v12) 를 컷 설정만 바꿔 재사용할 수 있게 일반화
# 사용: UP_MP4='<put url>' UP_ZIP='<put url>' [UP_CUTS=<컷별 PUT URL 목록 파일>] python3 build_short.py <short.json 경로 또는 URL>
#
# 설정 형식 (prompts/shorts/drain-trap/short.json 참고)
# {
#   "name": "옥상배관방수트랩", "gap": 0.42, "tail": 0.8, "tempo": 1.0,
#   "cta": {"title": "POUR 옥상배관방수트랩", "subtitle": "보강시트 설치 세트", "badge": "타임세일 · 무료배송", "button": "▶ 프로필 링크에서 확인"},
#   "cuts": [
#     {"subs": ["자막 한 장", "【강조】는 하늘색"], "audio": "hf_...wav",
#      "visual": {"type": "ai",    "clips": [{"src": "hf_...mp4", "ss": 0.3, "w": 1, "label": "① 밖에서"}]}},
#     {"visual": {"type": "real",  "clips": [{"src": "https://...mp4"}]}},          실제 촬영 영상 (AI 표기 없음)
#     {"visual": {"type": "photo", "image": "https://...png", "chip": "설치 후", "temp": true}},   실사 사진 ("(임시)" 표기)
#     {"visual": {"type": "diy",   "steps": [{"image": "...", "word": "쓱"}], "video": ""}},       쓱싹쓱 시공 (video 있으면 실제 영상)
#     {"visual": {"type": "cta",   "image": "https://...png"}}                     상품 추천
#   ]
# }
# src/audio/image 는 Higgsfield 파일명(hf_...) 또는 전체 URL
import os, sys, subprocess, json, zipfile, re, urllib.request
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
CF = 'https://d8j0ntlcm91z4.cloudfront.net/user_39sUpHbwBquNe1iB2u0CUyyHgzC/'
FONT_URL = 'https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansCJKkr-Bold.otf'
GRADE = 'eq=saturation=0.86:contrast=1.05:brightness=-0.01:gamma_b=1.04:gamma_r=0.98'  # 전 AI 컷 톤 통일
OK_WORDS = '누구나 OK'

if len(sys.argv) < 2:
    sys.exit('사용: python3 build_short.py <short.json 경로 또는 URL>')
SRC = sys.argv[1]
if SRC.startswith('http'):
    CFG = json.loads(urllib.request.urlopen(SRC).read().decode('utf-8'))
else:
    CFG = json.load(open(SRC, encoding='utf-8'))
CUTS = CFG['cuts']
N = len(CUTS)
GAP = float(CFG.get('gap', 0.42))     # 컷 사이 쉼 (나레이션 지침 0.4~0.6초)
TAIL = float(CFG.get('tail', 0.8))    # 마지막 컷 여유
TEMPO = float(CFG.get('tempo', 1.0))  # 편집 가속 금지 — 1.0 유지
CTA = CFG.get('cta', {})
BASE = CFG.get('cdn_base', CF)

# 설정 검사 — 빠진 값은 렌더 전에 한 번에 알려준다
miss = []
for i, c in enumerate(CUTS, 1):
    v = c.get('visual', {})
    if not c.get('audio'): miss.append(f'컷{i}: 나레이션(audio) 없음')
    if not c.get('subs'): miss.append(f'컷{i}: 자막(subs) 없음')
    t = v.get('type')
    if t in ('ai', 'real') and not [x for x in v.get('clips', []) if x.get('src')]: miss.append(f'컷{i}: 영상 클립 없음')
    if t == 'photo' and not v.get('image'): miss.append(f'컷{i}: 사진 없음')
    if t == 'diy' and not v.get('video') and not v.get('steps'): miss.append(f'컷{i}: 시공 사진/영상 없음')
    if t == 'cta' and not v.get('image'): miss.append(f'컷{i}: 상품 이미지 없음')
    if t not in ('ai', 'real', 'photo', 'diy', 'cta'): miss.append(f'컷{i}: 화면 유형 "{t}" 알 수 없음')
if miss:
    sys.exit('설정 확인 필요:\n' + '\n'.join(miss))

def url(s): return s if s.startswith('http') else BASE + s

def sh(cmd):
    print('$', cmd[:200], flush=True)
    subprocess.run(cmd, shell=True, check=True)

def dur(p):
    out = subprocess.check_output(f'ffprobe -v error -show_entries format=duration -of json "{p}"', shell=True)
    return float(json.loads(out)['format']['duration'])

_dl = {}
def fetch(s, ext):
    if s not in _dl:
        p = f'in{len(_dl)}.{ext}'
        sh(f'curl -sfL -o {p} "{url(s)}"')
        _dl[s] = p
    return _dl[s]

os.makedirs('w', exist_ok=True); os.chdir('w')
os.makedirs('fonts', exist_ok=True)
if not os.path.exists('fonts/NotoSansCJKkr-Bold.otf'):
    sh(f'curl -sfL -o fonts/NotoSansCJKkr-Bold.otf "{FONT_URL}"')
FONT = 'fonts/NotoSansCJKkr-Bold.otf'
def font(sz): return ImageFont.truetype(FONT, sz)

# 1) 나레이션: 앞뒤 무음 정리 → 컷 길이 = 나레이션 + 쉼 → 30ms 페이드
ad, cd = [], []
for i, c in enumerate(CUTS, 1):
    a = fetch(c['audio'], 'wav')
    sh(f'ffmpeg -y -v error -i {a} -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,'
       f'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,atempo={TEMPO:.4f}" -ar 48000 -ac 1 n{i}.wav')
    d = dur(f'n{i}.wav'); ad.append(d)
    cd.append(round(d + (TAIL if i == N else GAP), 3))
print('narration', ad, 'cuts', cd, 'total', round(sum(cd), 2), flush=True)
for i in range(1, N + 1):
    sh(f'ffmpeg -y -v error -i n{i}.wav -af "afade=t=in:d=0.03,areverse,afade=t=in:d=0.03,areverse,apad=whole_dur={cd[i-1]}" -ar 48000 -ac 1 p{i}.wav')
with open('alist.txt', 'w') as f:
    f.writelines(f"file 'p{i}.wav'\n" for i in range(1, N + 1))
sh('ffmpeg -y -v error -f concat -safe 0 -i alist.txt -c:a pcm_s16le narration.wav')

# 2) 화면
def esc(t): return t.replace('\\', '\\\\').replace(':', '\\:').replace("'", '’')

def chip_draw(d, text, x0=60, y0=170, fill=(255, 255, 255), color=(15, 31, 92), sz=54):
    f = font(sz); tw = d.textlength(text, font=f)
    d.rounded_rectangle((x0, y0, x0 + tw + 60, y0 + sz + 38), (sz + 38) // 2, fill=fill)
    d.text((x0 + 30, y0 + 12), text, font=f, fill=color)

def compose(src, out, box=(1000, 1250), cy=820, chip=None, cta=False, temp=False):
    im = Image.open(src).convert('RGB')
    r = max(W / im.width, H / im.height)
    b = im.resize((int(im.width * r) + 1, int(im.height * r) + 1)).crop((0, 0, W, H))
    b = b.filter(ImageFilter.GaussianBlur(40)).point(lambda p: int(p * 0.55))
    r = min(box[0] / im.width, box[1] / im.height)
    fg = im.resize((int(im.width * r), int(im.height * r)), Image.LANCZOS)
    b.paste(fg, ((W - fg.width) // 2, cy - fg.height // 2))
    d = ImageDraw.Draw(b)
    if chip: chip_draw(d, chip)
    if temp:
        f = font(30); t = '실사 사진 (임시)'; tw = d.textlength(t, font=f)
        d.rounded_rectangle((W - tw - 70, 80, W - 40, 130), 12, fill=(0, 0, 0))
        d.text((W - tw - 55, 87), t, font=f, fill='white')
    if cta:
        d.rounded_rectangle((60, 120, W - 60, 440), 36, fill=(15, 31, 92))
        d.text((W // 2, 200), CTA.get('title', ''), font=font(66), fill='white', anchor='mm')
        d.text((W // 2, 295), CTA.get('subtitle', ''), font=font(46), fill=(220, 228, 245), anchor='mm')
        if CTA.get('badge'):
            bw = d.textlength(CTA['badge'], font=font(44)) / 2 + 50
            d.rounded_rectangle((W // 2 - bw, 340, W // 2 + bw, 412), 36, fill=(232, 120, 15))
            d.text((W // 2, 376), CTA['badge'], font=font(44), fill='white', anchor='mm')
        btn = CTA.get('button', '▶ 프로필 링크에서 확인')
        bw = d.textlength(btn, font=font(50)) / 2 + 60
        d.rounded_rectangle((W // 2 - bw, 465, W // 2 + bw, 560), 48, fill=(3, 199, 90))
        d.text((W // 2, 512), btn, font=font(50), fill='white', anchor='mm')
    b.save(out)

def still(png, d, out, z=0.08):
    n = max(1, int(round(d * FPS)))
    sh(f'ffmpeg -y -v error -loop 1 -framerate {FPS} -t {d} -i {png} -vf "scale=2160:3840,'
       f"zoompan=z='1+{z}*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},setsar=1\" "
       f'-frames:v {n} -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -an {out}')

def clip(src, d, out, ss=0.3, label=None, ai=True):
    avail = max(0.5, dur(src) - ss - 0.2)
    f = d / avail
    pts = f'setpts={f:.4f}*PTS,' if f > 1 else ''
    if f > 1.1: print(f'WARN {src} 느리게 늘림 x{f:.2f} — 클립이 짧음', flush=True)
    lab = (f",drawtext=fontfile={FONT}:text='{esc(label)}':fontsize=52:fontcolor=white:box=1:boxcolor=0x505050@0.85:boxborderw=22:x=60:y=170") if label else ''
    look = f',{GRADE}' if ai else ''  # 'AI 연출 화면' 표기는 넣지 않음 (사용자 지시 10.06)
    sh(f'ffmpeg -y -v error -ss {ss} -i {src} -vf "{pts}scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},setsar=1,'
       f'tpad=stop_mode=clone:stop_duration=3{look}{lab}" -t {d} -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -an {out}')

def concat(parts, out):
    with open(out + '.txt', 'w') as f:
        f.writelines(f"file '{p}'\n" for p in parts)
    sh(f'ffmpeg -y -v error -f concat -safe 0 -i {out}.txt -c copy {out}')

def split(total, weights):
    s = sum(weights); ds = [round(total * w / s, 3) for w in weights[:-1]]
    return ds + [round(total - sum(ds), 3)]

def snappy(png, d, word, out, ok=False):
    # ★ 시공 쓱싹쓱: 줌 펀치 + 흰 플래시 + 큰 의성어, 마지막 컷에 "누구나 OK"
    n = max(1, int(round(d * FPS)))
    okchip = (f",drawtext=fontfile={FONT}:text='{OK_WORDS}':fontsize=64:fontcolor=white:box=1:boxcolor=0x03C75A@0.95:boxborderw=26:"
              f"x=(w-tw)/2:y=1500:enable='gte(t,0.25)'") if ok else ''
    sh(f'ffmpeg -y -v error -loop 1 -framerate {FPS} -t {d} -i {png} -vf "scale=2160:3840,'
       f"zoompan=z='if(lt(on,6),1.24-0.04*on,1.0+0.002*(on-6))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},setsar=1,"
       f"fade=t=in:st=0:d=0.08:color=white,"
       f"drawtext=fontfile={FONT}:text='{esc(word)}':fontsize=230:fontcolor=white:borderw=14:bordercolor=0xE8780F:x=(w-tw)/2:y=250{okchip},"
       f"drawtext=fontfile={FONT}:text='실제 시공 영상 교체 예정':fontsize=30:fontcolor=white@0.8:box=1:boxcolor=black@0.35:boxborderw=10:x=w-tw-40:y=90\" "
       f'-frames:v {n} -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -an {out}')

stills = []
for i, c in enumerate(CUTS, 1):
    v = c['visual']; t = v['type']; d = cd[i - 1]; out = f's{i}.mp4'
    if t in ('ai', 'real'):
        cl = [x for x in v['clips'] if x.get('src')]
        ds = split(d, [float(x.get('w', 1)) for x in cl])
        parts = []
        for j, (x, dj) in enumerate(zip(cl, ds)):
            clip(fetch(x['src'], 'mp4'), dj, f's{i}_{j}.mp4', ss=float(x.get('ss', 0.3 if t == 'ai' else 0)),
                 label=x.get('label'), ai=(t == 'ai'))
            parts.append(f's{i}_{j}.mp4')
        concat(parts, out)
    elif t == 'photo':
        compose(fetch(v['image'], 'img'), f'c{i}.png', chip=v.get('chip'), temp=v.get('temp', True))
        still(f'c{i}.png', d, out); stills.append(f'c{i}.png')
    elif t == 'diy':
        if v.get('video'):
            src = fetch(v['video'], 'mp4'); f = dur(src) / d
            sh(f'ffmpeg -y -v error -i {src} -vf "setpts=PTS/{f:.4f},scale={W}:{H}:force_original_aspect_ratio=increase,'
               f'crop={W}:{H},fps={FPS},setsar=1" -t {d} -an -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p {out}')
        else:
            st = v['steps']; k = len(st)
            t_act = round(d * 0.62 / max(1, k - 1), 3) if k > 1 else d
            parts = []
            for j, s in enumerate(st):
                compose(fetch(s['image'], 'img'), f'c{i}_{j}.png')
                dj = round(d - t_act * (k - 1), 3) if j == k - 1 else t_act
                snappy(f'c{i}_{j}.png', dj, s.get('word', ''), f's{i}_{j}.mp4', ok=(j == k - 1))
                parts.append(f's{i}_{j}.mp4')
            concat(parts, out)
    elif t == 'cta':
        compose(fetch(v['image'], 'img'), f'c{i}.png', cy=1070, box=(940, 940), cta=True)
        still(f'c{i}.png', d, out, z=0.04); stills.append(f'c{i}.png')
concat([f's{i}.mp4' for i in range(1, N + 1)], 'video.mp4')

# 3) 자막 (ASS + SRT) — 【강조】 하늘색 110%, 긴 줄은 가운데 띄어쓰기에서 자동 줄바꿈
def wrap(x):
    if '\\N' in x: return x
    plain = x.replace('【', '').replace('】', '')
    if len(plain) <= 15: return x
    sp = [m.start() for m in re.finditer(' ', x)]
    if not sp: return x
    mid = len(x) / 2; k = min(sp, key=lambda p: abs(p - mid))
    return x[:k] + '\\N' + x[k + 1:]

def ts(t, srt=False):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h:02d}:{m:02d}:{s:06.3f}'.replace('.', ',') if srt else f'{h}:{m:02d}:{s:05.2f}'
ass = ['[Script Info]', 'ScriptType: v4.00+', f'PlayResX: {W}', f'PlayResY: {H}', '',
       '[V4+ Styles]',
       'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
       'Style: Main,Noto Sans CJK KR,64,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,5,1,2,60,60,300,1',
       '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
srt, n, t0 = [], 1, 0.0
for i, c in enumerate(CUTS, 1):
    lines = [wrap(x) for x in c['subs']]
    w = [max(1, len(x.replace('\\N', '').replace('【', '').replace('】', ''))) for x in lines]
    s = t0 + 0.08; span = ad[i - 1]
    for x, wi in zip(lines, w):
        e = s + span * wi / sum(w)
        txt = x.replace('【', '{\\c&H00FFD27A&\\fscx110\\fscy110}').replace('】', '{\\r}')
        ass.append(f'Dialogue: 0,{ts(s)},{ts(min(e + 0.15, t0 + cd[i-1]))},Main,,0,0,0,,{txt}')
        plain = x.replace('【', '').replace('】', '').replace('\\N', '\n')
        srt += [str(n), f'{ts(s, True)} --> {ts(e, True)}', plain, '']; n += 1
        s = e
    t0 += cd[i - 1]
open('subs.ass', 'w').write('\n'.join(ass) + '\n')
open('subs.srt', 'w').write('\n'.join(srt))

# 4) 최종 합성 (자막 번인 + 나레이션)
sh('ffmpeg -y -v error -i video.mp4 -i narration.wav -vf "subtitles=subs.ass:fontsdir=fonts" '
   '-c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -ar 48000 '
   '-shortest -movflags +faststart final.mp4')
print('FINAL', dur('final.mp4'), flush=True)

# 5) 캡컷 소스 묶음
with zipfile.ZipFile('capcut.zip', 'w') as z:
    for i in range(1, N + 1):
        z.write(f's{i}.mp4', f'video/cut{i}.mp4'); z.write(f'n{i}.wav', f'narration/cut{i}.wav')
    for p in ['narration.wav', 'subs.srt', 'subs.ass'] + stills:
        z.write(p, p)
    z.writestr('README.txt', 'cut별 영상(video/), 컷별 나레이션(narration/), 전체 나레이션, 자막(SRT/ASS), 그래픽 PNG\n'
               f'컷 길이(초): {cd}\n')
if os.environ.get('UP_MP4'):
    sh(f'curl -sf -X PUT -H "Content-Type: video/mp4" -H "If-None-Match: *" --upload-file final.mp4 "{os.environ["UP_MP4"]}"')
if os.environ.get('UP_ZIP'):
    sh(f'curl -sf -X PUT -H "Content-Type: application/octet-stream" -H "If-None-Match: *" --upload-file capcut.zip "{os.environ["UP_ZIP"]}"')
# 컷별 재활용용 업로드: UP_CUTS 파일(한 줄에 PUT URL 하나, 컷 순서) → s{i}.mp4 (자막 없는 컷 영상)
if os.environ.get('UP_CUTS') and os.path.exists(os.environ['UP_CUTS']):
    for i, u in enumerate([l.strip() for l in open(os.environ['UP_CUTS']) if l.strip()], 1):
        if i <= N:
            sh(f'curl -sf -X PUT -H "Content-Type: video/mp4" -H "If-None-Match: *" --upload-file s{i}.mp4 "{u}"')
print('CUTS', json.dumps(cd), flush=True)
print('DONE', flush=True)
