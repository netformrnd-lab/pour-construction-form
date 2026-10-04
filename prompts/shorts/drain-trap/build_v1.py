# 옥상배관방수트랩 숏폼 v1 조립 스크립트 (Higgsfield sandbox에서 실행)
# 사용: UP_MP4='<put url>' UP_ZIP='<put url>' python3 build_v1.py
import os, subprocess, json, zipfile
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
GAP = 0.5      # 묶음 사이 쉼
TAIL = 1.2     # 마지막 컷 여유
CF = 'https://d8j0ntlcm91z4.cloudfront.net/user_39sUpHbwBquNe1iB2u0CUyyHgzC/'
GH = 'https://raw.githubusercontent.com/netformrnd-lab/pour-construction-form/claude/eloquent-turing-r4703j/prompts/shorts/drain-trap/'
FONT_URL = 'https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansCJKkr-Bold.otf'

AUDIO = [
    'hf_20261002_113323_0f626f64-7dc4-4bb4-8a4b-9dfe3913b11b.wav',
    'hf_20261002_113323_98ce3814-a85e-469c-8bed-4df2311c3524.wav',
    'hf_20261002_113323_501d4078-da4d-4fe2-9e11-08b6a6316b5f.wav',
    'hf_20261002_113327_c683bbf9-6a09-4135-9ad5-33b76b6891dd.wav',
    'hf_20261002_113328_f41546e3-37d7-4aff-98dd-b6678be18091.wav',
    'hf_20261002_113327_7fec0191-ff24-4084-ae4a-a854bfa41d77.wav',
    'hf_20261002_113305_b80f473f-fce2-412e-8511-38b215e8660c.wav',
]
VIDEO = {
    1: 'hf_20261002_114638_85510f05-b6e3-4222-8369-31e0d5566817.mp4',
    2: 'hf_20261002_124316_a87e3126-a55b-4664-928e-786f3682cf6f.mp4',
    3: 'hf_20261002_124300_9b652bc8-d15e-4c91-b445-20df455a77a8.mp4',
}
IMGS = ['ref-01-thumbnail.png', 'ref-02-after-rooftop.png', 'ref-03-exploded.png', 'ref-04-white-bg.png',
        'step-02-glue-attach.jpg', 'step-04-coat1.jpg', 'step-05-sheet.jpg', 'step-07-support.jpg', 'step-08-done.jpg']

# 자막: 【강조어】는 하늘색 110%
SUBS = {
    1: ['비 온 뒤, 옥상 배수구에\\N【물 고여】 있죠?'],
    2: ['물은 배관 옆,\\N【틈새】로 새거든요.', '그 물이 아랫집\\N천장까지 가요.'],
    3: ['실리콘 덧바르면요?', '금방, 【다시 벌어져요】.'],
    4: ['POUR 옥상배관방수트랩은\\N배수구에 붙이고,', '시트로 바닥과 이어요.', '틈새가, 【한 몸】이 되죠.'],
    5: ['위 거름망은,\\N【낙엽까지】 걸러 줘요.'],
    6: ['붙이고, 바르고, 덮고, 꽂으면,\\N【끝이에요】.'],
    7: ['코트재, 시트, 트랩까지,\\N【한 세트】.', '프로필 링크에서 확인하세요.'],
}

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
    sh(f'curl -sfL -o v{k}.mp4 "{CF}{v}"')
for n in IMGS:
    sh(f'curl -sfL -o "{n}" "{GH}{n}"')

# 1) 나레이션: 앞뒤 무음 0.1초만 남기고 정리 → 길이 측정
ad, cd = [], []
for i in range(1, 8):
    sh(f'ffmpeg -y -v error -i a{i}.wav -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,'
       f'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse" -ar 48000 -ac 1 n{i}.wav')
    d = dur(f'n{i}.wav'); ad.append(d)
    cd.append(round(d + (TAIL if i == 7 else GAP), 3))
print('narration', ad, 'cuts', cd, 'total', sum(cd), flush=True)
for i in range(1, 8):
    sh(f'ffmpeg -y -v error -i n{i}.wav -af "apad=whole_dur={cd[i-1]}" -ar 48000 -ac 1 p{i}.wav')
with open('alist.txt', 'w') as f:
    f.writelines(f"file 'p{i}.wav'\n" for i in range(1, 8))
sh('ffmpeg -y -v error -f concat -safe 0 -i alist.txt -c:a pcm_s16le narration.wav')

# 2) 화면 구성용 이미지 (PIL)
def font(sz): return ImageFont.truetype(FONT, sz)

def compose(src, out, bg='blur', box=(1000, 1250), cy=820, chip=None, cta=False):
    im = Image.open(src).convert('RGB')
    if bg == 'blur':
        r = max(W / im.width, H / im.height)
        b = im.resize((int(im.width * r) + 1, int(im.height * r) + 1)).crop((0, 0, W, H))
        b = b.filter(ImageFilter.GaussianBlur(40)).point(lambda p: int(p * 0.55))
    else:
        b = Image.new('RGB', (W, H), bg)
    r = min(box[0] / im.width, box[1] / im.height)
    fg = im.resize((int(im.width * r), int(im.height * r)), Image.LANCZOS)
    b.paste(fg, ((W - fg.width) // 2, cy - fg.height // 2))
    d = ImageDraw.Draw(b)
    if chip:
        f = font(54); tw = d.textlength(chip, font=f)
        x0, y0 = 60, 170
        d.rounded_rectangle((x0, y0, x0 + tw + 60, y0 + 92), 46, fill=(255, 255, 255))
        d.text((x0 + 30, y0 + 12), chip, font=f, fill=(15, 31, 92))
    if cta:
        d.rounded_rectangle((60, 120, W - 60, 420), 36, fill=(15, 31, 92))
        d.text((W // 2, 200), 'POUR 옥상배관방수트랩', font=font(66), fill='white', anchor='mm')
        d.text((W // 2, 300), '보강시트 설치 세트 · 무료배송', font=font(48), fill=(255, 210, 122), anchor='mm')
        d.text((W // 2, 375), '코트재 + 시트 + 트랩', font=font(40), fill=(220, 228, 245), anchor='mm')
    b.save(out)

def still(png, d, out, z=0.08):
    n = max(1, int(round(d * FPS)))
    sh(f'ffmpeg -y -v error -loop 1 -framerate {FPS} -t {d} -i {png} -vf "scale=2160:3840,'
       f"zoompan=z='1+{z}*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},setsar=1\" "
       f'-frames:v {n} -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -an {out}')

def ai(k, d, out):
    src = f'v{k}.mp4'; avail = dur(src) - 0.5
    f = d / avail
    pts = f'setpts={f:.4f}*PTS,' if f > 1 else ''
    if f > 1.1: print(f'WARN cut{k} slow factor {f:.2f}', flush=True)
    sh(f'ffmpeg -y -v error -ss 0.3 -i {src} -vf "{pts}scale={W}:{H}:flags=lanczos,fps={FPS},setsar=1,'
       f'tpad=stop_mode=clone:stop_duration=2" -t {d} -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -an {out}')

def concat(parts, out):
    with open(out + '.txt', 'w') as f:
        f.writelines(f"file '{p}'\n" for p in parts)
    sh(f'ffmpeg -y -v error -f concat -safe 0 -i {out}.txt -c copy {out}')

CREAM = (247, 243, 234)
ai(1, cd[0], 's1.mp4'); ai(2, cd[1], 's2.mp4'); ai(3, cd[2], 's3.mp4')
compose('ref-03-exploded.png', 'c4.png', bg=CREAM, box=(900, 1300), cy=840)
still('c4.png', cd[3], 's4.mp4')
compose('ref-04-white-bg.png', 'c5.png', bg=(242, 242, 242), box=(1040, 1300), cy=840)
still('c5.png', cd[4], 's5.mp4', z=0.10)
steps = [('step-02-glue-attach.jpg', '① 붙이고'), ('step-04-coat1.jpg', '② 바르고'),
         ('step-05-sheet.jpg', '③ 덮고'), ('step-07-support.jpg', '④ 꽂으면 끝')]
parts = []
for j, (src, chip) in enumerate(steps):
    compose(src, f'c6_{j}.png', chip=chip); still(f'c6_{j}.png', round(cd[5] / 4, 3), f's6_{j}.mp4', z=0.05)
    parts.append(f's6_{j}.mp4')
concat(parts, 's6.mp4')
seq7 = [('step-08-done.jpg', {}), ('ref-02-after-rooftop.png', {}), ('ref-01-thumbnail.png', {'cta': True})]
lens7 = [round(cd[6] * 0.25, 3), round(cd[6] * 0.25, 3)]; lens7.append(round(cd[6] - sum(lens7), 3))
parts = []
for j, (src, kw) in enumerate(seq7):
    compose(src, f'c7_{j}.png', cy=1000 if kw.get('cta') else 820, **kw)
    still(f'c7_{j}.png', lens7[j], f's7_{j}.mp4', z=0.05); parts.append(f's7_{j}.mp4')
concat(parts, 's7.mp4')
concat([f's{i}.mp4' for i in range(1, 8)], 'video.mp4')

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
for i in range(1, 8):
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
    for i in range(1, 8):
        z.write(f's{i}.mp4', f'video/cut{i}.mp4'); z.write(f'n{i}.wav', f'narration/cut{i}.wav')
    for p in ['narration.wav', 'subs.srt', 'subs.ass', 'c4.png', 'c5.png', 'c7_2.png']:
        z.write(p, p)
    z.writestr('README.txt', 'cut별 영상(video/), 묶음별 나레이션(narration/), 전체 나레이션, 자막(SRT/ASS), 그래픽 PNG\n'
               f'컷 길이(초): {cd}\n')
if os.environ.get('UP_MP4'):
    sh(f'curl -sf -X PUT -H "Content-Type: video/mp4" -H "If-None-Match: *" --upload-file final.mp4 "{os.environ["UP_MP4"]}"')
if os.environ.get('UP_ZIP'):
    sh(f'curl -sf -X PUT -H "Content-Type: application/octet-stream" -H "If-None-Match: *" --upload-file capcut.zip "{os.environ["UP_ZIP"]}"')
print('DONE', flush=True)
