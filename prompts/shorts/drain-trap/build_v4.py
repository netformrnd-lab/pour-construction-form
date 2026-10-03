# 옥상배관방수트랩 숏폼 v4 조립 스크립트 (Higgsfield sandbox에서 실행)
# 사용: UP_MP4='<put url>' UP_ZIP='<put url>' python3 build_v4.py
import os, subprocess, json, zipfile
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
GAP = float(os.environ.get('GAP', 0.3))      # 묶음 사이 쉼
TAIL = float(os.environ.get('TAIL', 1.2))     # 마지막 컷 여유
TEMPO = float(os.environ.get('TEMPO', 1.0))   # 나레이션 속도 (음높이 유지)
CF = 'https://d8j0ntlcm91z4.cloudfront.net/user_39sUpHbwBquNe1iB2u0CUyyHgzC/'
GH = 'https://raw.githubusercontent.com/netformrnd-lab/pour-construction-form/claude/eloquent-turing-r4703j/prompts/shorts/drain-trap/'
FONT_URL = 'https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansCJKkr-Bold.otf'

AUDIO = [
    'hf_20261002_133917_0995c2d7-fe53-4bc6-b57e-3899a2a52cc8.wav',
    'hf_20261002_133917_0220fc14-019c-45ee-855e-8715ab8e60e4.wav',
    'hf_20261002_133917_9e6e226e-f46e-4891-babb-b55fd406ffa6.wav',
    'hf_20261002_133929_bb926d8f-7437-48ef-ad80-dd4d95494274.wav',
    'hf_20261002_133930_8948d2cb-adde-4cec-9afb-5e0a899acd68.wav',
    'hf_20261003_000514_f82f9328-7d31-4459-ac5e-467745b91705.wav',
    'hf_20261003_000514_832c12f4-4238-46de-8a04-28d1f37136f8.wav',
    'hf_20261003_000514_8b29aa4d-eb3d-48d2-a9ac-62e1db29d324.wav',
    'hf_20261003_001120_f8ba4ae9-6183-4a8f-94a5-d5586c06d6c4.wav',
    'hf_20261002_132932_c12a5eb0-768d-4d56-9ec8-d84d378a8468.wav',
    'hf_20261003_001120_bfc2a287-d432-4629-b6cf-08ec24c18475.wav',
]
VIDEO = {
    'mold': 'hf_20261002_133958_b46c150d-705a-4812-9e4f-0c48a23b20df.mp4',
    'drain': 'hf_20261002_114638_85510f05-b6e3-4222-8369-31e0d5566817.mp4',
    'ure': 'hf_20261002_133958_7eac76be-fdbc-47a5-ab93-a1f11aa47d66.mp4',
    'rebar': 'hf_20261002_133958_053949a3-c4e6-4af3-93d8-3221235f4d57.mp4',
    'ceil': 'hf_20261002_133016_d6eef20a-dad0-4a81-bc9c-0e64d0168c35.mp4',
    'generic': os.environ.get('V_GENERIC', ''),
}
RUSTY = 'hf_20261002_114615_81ef8dad-a40e-41b4-8a1a-401f5f59d285.png'
IMGS = ['ref-01-thumbnail.png', 'ref-04-white-bg.png', 'ref-06-drain-gap.png', 'ref-08-structure.png', 'ref-09-extension-sheet.png',
        'step-02-glue-attach.jpg', 'step-04-coat1.jpg', 'step-05-sheet.jpg', 'step-07-support.jpg', 'step-08-done.jpg']

# 자막: 【강조어】는 하늘색 110%
SUBS = {
    1: ['천장 곰팡이,\\N【시작은 옥상】이에요.'],
    2: ['배수구가 막히면,\\N물이 【고이죠】.'],
    3: ['물에 오래 잠긴 우레탄은,\\N약해져서 【찢어져요】.'],
    4: ['그 틈으로 스민 물이,\\N【철근까지】 녹슬게 해요.'],
    5: ['결국 천장이 젖고,\\N【곰팡이】가 피는 거죠.'],
    6: ['그럼,\\N【어떻게】 해결해야 할까요?'],
    7: ['일반 드레인은,\\N위쪽 【좁은 구멍】이 전부예요.'],
    8: ['POUR 트랩은 넓은 덮개, 옆면,', '안쪽 지지대까지,\\N【세 번】 걸러요.'],
    9: ['삽입부도 길고,\\N연장시트로 【더 깊게】 막아요.'],
    10: ['붙이고, 바르고, 덮고,\\N꽂으면 【끝】.'],
    11: ['코트재, 시트, 트랩까지\\N【한 세트】.'],
}
N = len(SUBS)
def sh(cmd):
    print('$', cmd[:200], flush=True)
    subprocess.run(cmd, shell=True, check=True)

def dur(p):
    out = subprocess.check_output(f'ffprobe -v error -show_entries format=duration -of json "{p}"', shell=True)
    return float(json.loads(out)['format']['duration'])

os.makedirs('w', exist_ok=True); os.chdir('w')
os.makedirs('fonts', exist_ok=True)
if not os.path.exists('fonts/NotoSansCJKkr-Bold.otf'):
    sh(f'curl -sfL -o fonts/NotoSansCJKkr-Bold.otf "{FONT_URL}"')
FONT = 'fonts/NotoSansCJKkr-Bold.otf'
for i, a in enumerate(AUDIO, 1):
    sh(f'curl -sfL -o a{i}.wav "{CF}{a}"')
for k, v in VIDEO.items():
    sh(f'curl -sfL -o v_{k}.mp4 "{CF}{v}"')
sh(f'curl -sfL -o rusty.png "{CF}{RUSTY}"')
for n in IMGS:
    sh(f'curl -sfL -o "{n}" "{GH}{n}"')

# 1) 나레이션
ad, cd = [], []
for i in range(1, N + 1):
    sh(f'ffmpeg -y -v error -i a{i}.wav -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,'
       f'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,atempo={TEMPO}" -ar 48000 -ac 1 n{i}.wav')
    d = dur(f'n{i}.wav'); ad.append(d)
    cd.append(round(d + (TAIL if i == N else GAP), 3))
print('narration', ad, 'cuts', cd, 'total', sum(cd), flush=True)
for i in range(1, N + 1):
    sh(f'ffmpeg -y -v error -i n{i}.wav -af "apad=whole_dur={cd[i-1]}" -ar 48000 -ac 1 p{i}.wav')
with open('alist.txt', 'w') as f:
    f.writelines(f"file 'p{i}.wav'\n" for i in range(1, N + 1))
sh('ffmpeg -y -v error -f concat -safe 0 -i alist.txt -c:a pcm_s16le narration.wav')

def font(sz): return ImageFont.truetype(FONT, sz)

def chip_draw(d, text, x0=60, y0=170, fill=(255, 255, 255), color=(15, 31, 92), sz=54):
    f = font(sz); tw = d.textlength(text, font=f)
    d.rounded_rectangle((x0, y0, x0 + tw + 60, y0 + sz + 38), (sz + 38) // 2, fill=fill)
    d.text((x0 + 30, y0 + 12), text, font=f, fill=color)

def compose(src, out, bg='blur', box=(1000, 1250), cy=820, chip=None, cta=False, tag=None):
    im = Image.open(src).convert('RGB')
    if bg == 'blur':
        r = max(W / im.width, H / im.height)
        b = im.resize((int(im.width * r) + 1, int(im.height * r) + 1)).crop((0, 0, W, H))
        b = b.filter(ImageFilter.GaussianBlur(40)).point(lambda p: int(p * 0.55))
    elif bg == 'full':
        r = max(W / im.width, H / im.height)
        b = im.resize((int(im.width * r) + 1, int(im.height * r) + 1), Image.LANCZOS)
        b = b.crop(((b.width - W) // 2, (b.height - H) // 2, (b.width - W) // 2 + W, (b.height - H) // 2 + H))
        im = None
    else:
        b = Image.new('RGB', (W, H), bg)
    if im is not None:
        r = min(box[0] / im.width, box[1] / im.height)
        fg = im.resize((int(im.width * r), int(im.height * r)), Image.LANCZOS)
        b.paste(fg, ((W - fg.width) // 2, cy - fg.height // 2))
    d = ImageDraw.Draw(b)
    if chip: chip_draw(d, chip)
    if tag: chip_draw(d, tag[0], fill=tag[1], color='white')
    if cta:
        d.rounded_rectangle((60, 120, W - 60, 440), 36, fill=(15, 31, 92))
        d.text((W // 2, 200), 'POUR 옥상배관방수트랩', font=font(66), fill='white', anchor='mm')
        d.text((W // 2, 295), '보강시트 설치 세트', font=font(46), fill=(220, 228, 245), anchor='mm')
        d.rounded_rectangle((W // 2 - 300, 340, W // 2 + 300, 412), 36, fill=(232, 120, 15))
        d.text((W // 2, 376), '타임세일 · 무료배송', font=font(44), fill='white', anchor='mm')
        d.rounded_rectangle((W // 2 - 330, 465, W // 2 + 330, 560), 48, fill=(3, 199, 90))
        d.text((W // 2, 512), '▶ 프로필 링크에서 확인', font=font(50), fill='white', anchor='mm')
    b.save(out)

def still(png, d, out, z=0.08):
    n = max(1, int(round(d * FPS)))
    sh(f'ffmpeg -y -v error -loop 1 -framerate {FPS} -t {d} -i {png} -vf "scale=2160:3840,'
       f"zoompan=z='1+{z}*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},setsar=1\" "
       f'-frames:v {n} -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -an {out}')

AITAG = (f"drawtext=fontfile={FONT}:text='AI 연출 화면':fontsize=34:fontcolor=white@0.85:"
         f"box=1:boxcolor=black@0.35:boxborderw=14:x=w-tw-50:y=90")

def ai(k, d, out, ss=0.3, label=None):
    src = f'v_{k}.mp4'; avail = dur(src) - ss - 0.2
    f = d / avail
    pts = f'setpts={f:.4f}*PTS,' if f > 1 else ''
    lab = (f",drawtext=fontfile={FONT}:text='{label}':fontsize=52:fontcolor=white:box=1:boxcolor=0x505050@0.85:boxborderw=22:x=60:y=170") if label else ''
    if f > 1.1: print(f'WARN {k} slow factor {f:.2f}', flush=True)
    sh(f'ffmpeg -y -v error -ss {ss} -i {src} -vf "{pts}scale={W}:{H}:flags=lanczos,fps={FPS},setsar=1,'
       f'tpad=stop_mode=clone:stop_duration=3,{AITAG}{lab}" -t {d} -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -an {out}')

def concat(parts, out):
    with open(out + '.txt', 'w') as f:
        f.writelines(f"file '{p}'\n" for p in parts)
    sh(f'ffmpeg -y -v error -f concat -safe 0 -i {out}.txt -c copy {out}')

ai('mold', cd[0], 's1.mp4')
ai('drain', cd[1], 's2.mp4')
ai('ure', cd[2], 's3.mp4')
ai('rebar', cd[3], 's4.mp4')
ai('ceil', cd[4], 's5.mp4')
ai('drain', cd[5], 's6.mp4', ss=2.5)
ai('generic', cd[6], 's7.mp4', label='일반 드레인 (예시)')
# 8) 실사: 제품(넓은 덮개·옆면) → 구조도(지지대)
compose('ref-04-white-bg.png', 'c8a.png', bg=(242, 242, 242), box=(1040, 1300), cy=860, chip='① 넓은 덮개  ② 옆면')
compose('ref-08-structure.png', 'c8b.png', bg=(242, 242, 242), box=(1040, 1300), cy=860, chip='③ 지지대에서 한 번 더')
# 물빠짐 공간을 8번 끝에 붙임
compose('ref-06-drain-gap.png', 'c8c.png', chip='물빠짐 공간까지')
h8 = round(cd[7] / 3, 3)
still('c8a.png', h8, 's8a.mp4', z=0.08); still('c8b.png', h8, 's8b.mp4', z=0.05)
still('c8c.png', round(cd[7] - 2 * h8, 3), 's8c.mp4', z=0.08)
concat(['s8a.mp4', 's8b.mp4', 's8c.mp4'], 's8.mp4')
# 9) 실사: 긴 삽입부 + 연장시트(위아래 뚫림)
compose('ref-09-extension-sheet.png', 'c9.png', chip='연장시트로 더 길게 시공')
still('c9.png', cd[8], 's9.mp4', z=0.08)
steps = [('step-02-glue-attach.jpg', '① 붙이고'), ('step-04-coat1.jpg', '② 바르고'),
         ('step-05-sheet.jpg', '③ 덮고'), ('step-07-support.jpg', '④ 꽂으면 끝')]
parts = []
for j, (src, chip) in enumerate(steps):
    compose(src, f'c10_{j}.png', chip=chip); still(f'c10_{j}.png', round(cd[9] / 4, 3), f's10_{j}.mp4', z=0.05)
    parts.append(f's10_{j}.mp4')
concat(parts, 's10.mp4')
compose('ref-01-thumbnail.png', 'c11.png', cy=1070, box=(940, 940), cta=True)
still('c11.png', cd[10], 's11.mp4', z=0.04)
concat([f's{i}.mp4' for i in range(1, N + 1)], 'video.mp4')
# 3) 자막 (ASS + SRT)
def ts(t, srt=False):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h:02d}:{m:02d}:{s:06.3f}'.replace('.', ',') if srt else f'{h}:{m:02d}:{s:05.2f}'
ass = ['[Script Info]', 'ScriptType: v4.00+', f'PlayResX: {W}', f'PlayResY: {H}', '',
       '[V4+ Styles]',
       'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
       'Style: Main,Noto Sans CJK KR,64,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,5,1,2,60,60,300,1',
       '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
srt, n, t0 = [], 1, 0.0
for i in range(1, N + 1):
    lines = SUBS[i]; w = [len(x.replace('\\N', '').replace('【', '').replace('】', '')) for x in lines]
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
    for p in ['narration.wav', 'subs.srt', 'subs.ass', 'c8a.png', 'c8b.png', 'c8c.png', 'c9.png', 'c11.png']:
        z.write(p, p)
    z.writestr('README.txt', 'cut별 영상(video/), 묶음별 나레이션(narration/), 전체 나레이션, 자막(SRT/ASS), 그래픽 PNG\n'
               f'컷 길이(초): {cd}\n')
if os.environ.get('UP_MP4'):
    sh(f'curl -sf -X PUT -H "Content-Type: video/mp4" -H "If-None-Match: *" --upload-file final.mp4 "{os.environ["UP_MP4"]}"')
if os.environ.get('UP_ZIP'):
    sh(f'curl -sf -X PUT -H "Content-Type: application/octet-stream" -H "If-None-Match: *" --upload-file capcut.zip "{os.environ["UP_ZIP"]}"')
print('DONE', flush=True)
