# 옥상배관방수트랩 숏폼 v3 조립 스크립트 (Higgsfield sandbox에서 실행)
# 사용: UP_MP4='<put url>' UP_ZIP='<put url>' python3 build_v3.py
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
    'hf_20261002_133929_c4e7f83a-103c-4862-8139-d995c9359ef9.wav',
    os.environ.get('A7', ''),
    'hf_20261002_132932_c12a5eb0-768d-4d56-9ec8-d84d378a8468.wav',
    'hf_20261002_133051_13fa4462-5e54-4a2f-b818-c34fe9bd8d43.wav',
]
VIDEO = {
    'mold': os.environ.get('V_MOLD', ''),
    'drain': 'hf_20261002_114638_85510f05-b6e3-4222-8369-31e0d5566817.mp4',
    'ure': os.environ.get('V_URE', ''),
    'rebar': os.environ.get('V_REBAR', ''),
    'ceil': 'hf_20261002_133016_d6eef20a-dad0-4a81-bc9c-0e64d0168c35.mp4',
    'after': 'hf_20261002_133016_02d751c1-837f-48cb-9366-689a757162f8.mp4',
}
RUSTY = 'hf_20261002_114615_81ef8dad-a40e-41b4-8a1a-401f5f59d285.png'
IMGS = ['ref-01-thumbnail.png', 'ref-02-after-rooftop.png', 'ref-04-white-bg.png',
        'step-02-glue-attach.jpg', 'step-04-coat1.jpg', 'step-05-sheet.jpg', 'step-07-support.jpg', 'step-08-done.jpg']

# 자막: 【강조어】는 하늘색 110%
SUBS = {
    1: ['천장 곰팡이,\\N【시작은 옥상】이에요.'],
    2: ['배수구가 막히면,\\N물이 【고이죠】.'],
    3: ['물에 오래 잠긴 우레탄은,\\N약해져서 【찢어져요】.'],
    4: ['그 틈으로 스민 물이,\\N【철근까지】 녹슬게 해요.'],
    5: ['결국 천장이 젖고,\\N【곰팡이】가 피는 거죠.'],
    6: ['그래서,\\N【배수구부터】 막아야 해요.'],
    7: ['거름망이 막힘을 막고,\\N시트가 【틈새】를 덮어요.'],
    8: ['붙이고, 바르고, 덮고,\\N꽂으면 【끝】.'],
    9: ['코트재, 시트, 트랩\\N【한 세트】.', '프로필 링크에서 확인하세요.'],
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
    b.save(out)

def still(png, d, out, z=0.08):
    n = max(1, int(round(d * FPS)))
    sh(f'ffmpeg -y -v error -loop 1 -framerate {FPS} -t {d} -i {png} -vf "scale=2160:3840,'
       f"zoompan=z='1+{z}*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},setsar=1\" "
       f'-frames:v {n} -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -an {out}')

AITAG = (f"drawtext=fontfile={FONT}:text='AI 연출 화면':fontsize=34:fontcolor=white@0.85:"
         f"box=1:boxcolor=black@0.35:boxborderw=14:x=w-tw-50:y=90")

def ai(k, d, out, ss=0.3):
    src = f'v_{k}.mp4'; avail = dur(src) - ss - 0.2
    f = d / avail
    pts = f'setpts={f:.4f}*PTS,' if f > 1 else ''
    if f > 1.1: print(f'WARN {k} slow factor {f:.2f}', flush=True)
    sh(f'ffmpeg -y -v error -ss {ss} -i {src} -vf "{pts}scale={W}:{H}:flags=lanczos,fps={FPS},setsar=1,'
       f'tpad=stop_mode=clone:stop_duration=3,{AITAG}" -t {d} -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -an {out}')

def concat(parts, out):
    with open(out + '.txt', 'w') as f:
        f.writelines(f"file '{p}'\n" for p in parts)
    sh(f'ffmpeg -y -v error -f concat -safe 0 -i {out}.txt -c copy {out}')

ai('mold', cd[0], 's1.mp4')
ai('drain', cd[1], 's2.mp4')
ai('ure', cd[2], 's3.mp4')
ai('rebar', cd[3], 's4.mp4')
ai('ceil', cd[4], 's5.mp4')
# 6) 비포 → 애프터 (녹슨 배수구 → 실사 시공완료)
compose('rusty.png', 'c6a.png', bg='full', tag=('BEFORE', (120, 120, 120)))
compose('step-08-done.jpg', 'c6b.png', tag=('AFTER · 실제 시공', (3, 150, 90)))
a_len = 1.2; b_len = round(cd[5] - a_len + 0.5, 3)
still('c6a.png', a_len, 's6a.mp4', z=0.03); still('c6b.png', b_len, 's6b.mp4', z=0.05)
sh(f'ffmpeg -y -v error -i s6a.mp4 -i s6b.mp4 -filter_complex "[0][1]xfade=transition=wipedown:duration=0.5:offset={a_len-0.5}" '
   f'-t {cd[5]} -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -an s6.mp4')
ai('after', cd[6], 's7.mp4')
steps = [('step-02-glue-attach.jpg', '① 붙이고'), ('step-04-coat1.jpg', '② 바르고'),
         ('step-05-sheet.jpg', '③ 덮고'), ('step-07-support.jpg', '④ 꽂으면 끝')]
parts = []
for j, (src, chip) in enumerate(steps):
    compose(src, f'c8_{j}.png', chip=chip); still(f'c8_{j}.png', round(cd[7] / 4, 3), f's8_{j}.mp4', z=0.05)
    parts.append(f's8_{j}.mp4')
concat(parts, 's8.mp4')
compose('ref-01-thumbnail.png', 'c9.png', cy=1010, cta=True)
still('c9.png', cd[8], 's9.mp4', z=0.04)
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
    for p in ['narration.wav', 'subs.srt', 'subs.ass', 'c6a.png', 'c6b.png', 'c9.png']:
        z.write(p, p)
    z.writestr('README.txt', 'cut별 영상(video/), 묶음별 나레이션(narration/), 전체 나레이션, 자막(SRT/ASS), 그래픽 PNG\n'
               f'컷 길이(초): {cd}\n')
if os.environ.get('UP_MP4'):
    sh(f'curl -sf -X PUT -H "Content-Type: video/mp4" -H "If-None-Match: *" --upload-file final.mp4 "{os.environ["UP_MP4"]}"')
if os.environ.get('UP_ZIP'):
    sh(f'curl -sf -X PUT -H "Content-Type: application/octet-stream" -H "If-None-Match: *" --upload-file capcut.zip "{os.environ["UP_ZIP"]}"')
print('DONE', flush=True)
