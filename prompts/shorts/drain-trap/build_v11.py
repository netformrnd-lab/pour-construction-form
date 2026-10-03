# 옥상배관방수트랩 숏폼 v11 조립 스크립트 (한국어 원어민 음성) — 원리 ①②③ = 사용자 승인 AI 이미지(제품 포함) → AI 영상(Kling) (Higgsfield sandbox에서 실행)
# 사용: UP_MP4='<put url>' UP_ZIP='<put url>' python3 build_v11.py
import os, subprocess, json, zipfile
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
GAP = float(os.environ.get('GAP', 0.3))      # 묶음 사이 쉼
TAIL = float(os.environ.get('TAIL', 1.2))     # 마지막 컷 여유
TEMPO = float(os.environ.get('TEMPO', 1.0))   # 나레이션 속도 (음높이 유지)
CF = 'https://d8j0ntlcm91z4.cloudfront.net/user_39sUpHbwBquNe1iB2u0CUyyHgzC/'
GH = 'https://raw.githubusercontent.com/netformrnd-lab/pour-construction-form/claude/eloquent-turing-r4703j/prompts/shorts/drain-trap/'
FONT_URL = 'https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansCJKkr-Bold.otf'

# 나레이션: 한국어 원어민 남성 음성 레퍼런스(dc6489ab, 박포어 육성) · pitch -3 · 컷 묶음 단위 생성 · 편집 가속 없음
AUDIO = [os.environ.get(f'A{i}', '') for i in range(1, 14)]
VIDEO = {
    'mold': 'hf_20261002_133958_b46c150d-705a-4812-9e4f-0c48a23b20df.mp4',
    'drain': 'hf_20261002_114638_85510f05-b6e3-4222-8369-31e0d5566817.mp4',
    'ure': 'hf_20261002_133958_7eac76be-fdbc-47a5-ab93-a1f11aa47d66.mp4',
    'rebar': 'hf_20261002_133958_053949a3-c4e6-4af3-93d8-3221235f4d57.mp4',
    'ceil': 'hf_20261002_133016_d6eef20a-dad0-4a81-bc9c-0e64d0168c35.mp4',
    'g_ring': os.environ.get('V_GRING', ''),
    'g_cut': os.environ.get('V_GCUT', ''),
    'safe': os.environ.get('V_SAFE', ''), 'open': os.environ.get('V_OPEN', ''), 'g_short': os.environ.get('V_SHORT', ''), 'g_rebar': os.environ.get('V_REBAR', ''),
    'u_seep': os.environ.get('V_SEEP', ''), 'u_blister': os.environ.get('V_BLISTER', ''), 'u_tear': os.environ.get('V_TEAR', ''),
    'p_out': os.environ.get('V_OUT', ''), 'p_in': os.environ.get('V_IN', ''),
    'p_sheet': os.environ.get('V_SHEET', ''), 'p_cut': os.environ.get('V_CUT', ''), 'p_xray': os.environ.get('V_XRAY', ''),
}
CONSTRUCT = os.environ.get('CONSTRUCT_URL', '')  # 실제 시공 영상(직접 URL). 없으면 사진으로 임시 구성
RUSTY = 'hf_20261002_114615_81ef8dad-a40e-41b4-8a1a-401f5f59d285.png'
IMGS = ['ref-01-thumbnail.png', 'ref-04-white-bg.png', 'ref-06-drain-gap.png', 'ref-08-structure.png', 'ref-09-extension-sheet.png',
        'step-02-glue-attach.jpg', 'step-04-coat1.jpg', 'step-05-sheet.jpg', 'step-07-support.jpg', 'step-08-done.jpg']

# 자막: 【강조어】는 하늘색 110%
SUBS = {
    1: ['폭우가 오면, 빗물은\\N【전부 이 구멍】으로 모여요.'],
    2: ['배수구가 막히면,\\N물이 【고이죠】.'],
    3: ['고인 물은 【도막 밑으로】 스며들고,', '햇볕에 【부풀었다가】,\\N결국 【찢어져요】.'],
    4: ['결국 【천장까지】 새고,', '【곰팡이】가 피죠.'],
    5: ['그럼,\\N【어떻게】 해결해야 할까요?'],
    6: ['일반 드레인은\\N둘레가 쉽게 막히고,', '【삽입부도 짧아서】\\N틈이 생기죠.'],
    7: ['【철근】이 녹슬어 부풀면,', '누수는 【더 심해져요】.'],
    8: ['POUR 트랩은 큰 낙엽을,\\N【밖에서】 걸러요.'],
    9: ['작은 찌꺼기는,\\N【안에서】 한 번 더.'],
    10: ['연장시트를 이으면,\\NPVC 배관까지 이어져서,', '【콘크리트엔 물이 안 닿죠】.'],
    11: ['【콘크리트도, 철근도】,\\N그대로죠.'],
    12: ['쓱 붙이고, 싹 바르고,\\N덮고, 쏙 꽂으면 【끝】!', '【누구나】 할 수 있어요.'],
    13: ['코트재, 시트, 트랩까지\\N【한 세트】.'],
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
CUT_TEMPO = {}  # 말 속도는 편집으로 올리지 않는다 (나레이션 지침)
ad, cd = [], []
for i in range(1, N + 1):
    sh(f'ffmpeg -y -v error -i a{i}.wav -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,'
       f'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,atempo={TEMPO * CUT_TEMPO.get(i, 1.0):.4f}" -ar 48000 -ac 1 n{i}.wav')
    d = dur(f'n{i}.wav'); ad.append(d)
    cd.append(round(d + (TAIL if i == N else GAP), 3))
print('narration', ad, 'cuts', cd, 'total', sum(cd), flush=True)
for i in range(1, N + 1):
    sh(f'ffmpeg -y -v error -i n{i}.wav -af "afade=t=in:d=0.03,areverse,afade=t=in:d=0.03,areverse,apad=whole_dur={cd[i-1]}" -ar 48000 -ac 1 p{i}.wav')
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

GRADE = 'eq=saturation=0.86:contrast=1.05:brightness=-0.01:gamma_b=1.04:gamma_r=0.98'  # 전 AI 컷 톤 통일

def ai(k, d, out, ss=0.3, label=None):
    src = f'v_{k}.mp4'; avail = dur(src) - ss - 0.2
    f = d / avail
    pts = f'setpts={f:.4f}*PTS,' if f > 1 else ''
    lab = (f",drawtext=fontfile={FONT}:text='{label}':fontsize=52:fontcolor=white:box=1:boxcolor=0x505050@0.85:boxborderw=22:x=60:y=170") if label else ''
    if f > 1.1: print(f'WARN {k} slow factor {f:.2f}', flush=True)
    sh(f'ffmpeg -y -v error -ss {ss} -i {src} -vf "{pts}scale={W}:{H}:flags=lanczos,fps={FPS},setsar=1,'
       f'tpad=stop_mode=clone:stop_duration=3,{GRADE},{AITAG}{lab}" -t {d} -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -an {out}')

def concat(parts, out):
    with open(out + '.txt', 'w') as f:
        f.writelines(f"file '{p}'\n" for p in parts)
    sh(f'ffmpeg -y -v error -f concat -safe 0 -i {out}.txt -c copy {out}')

def split2(k1, k2, i, out, label=None):
    w = [len(x) for x in SUBS[i]]; da = round(cd[i-1] * w[0] / sum(w), 3)
    ai(k1, da, out + 'a.mp4', label=label); ai(k2, round(cd[i-1] - da, 3), out + 'b.mp4', label=label)
    concat([out + 'a.mp4', out + 'b.mp4'], out + '.mp4')

ai('open', cd[0], 's1.mp4', ss=0.1)
ai('drain', cd[1], 's2.mp4')
# 우레탄이 찢어지는 이유: 스며듦 → 부풀음 → 찢어짐
d3 = [round(cd[2] * 0.36, 3), round(cd[2] * 0.32, 3)]; d3.append(round(cd[2] - sum(d3), 3))
ai('u_seep', d3[0], 's3a.mp4'); ai('u_blister', d3[1], 's3b.mp4'); ai('u_tear', d3[2], 's3c.mp4')
concat(['s3a.mp4', 's3b.mp4', 's3c.mp4'], 's3.mp4')
split2('ceil', 'mold', 4, 's4')
ai('drain', cd[4], 's5.mp4', ss=2.5)
# ⑥ 일반 드레인: 둘레 막힘(2컷) → 짧은 삽입부 틈
d6 = [round(cd[5] * 0.3, 3), round(cd[5] * 0.25, 3)]; d6.append(round(cd[5] - sum(d6), 3))
ai('g_ring', d6[0], 's6a.mp4', label='일반 드레인 (예시)'); ai('g_cut', d6[1], 's6b.mp4', label='일반 드레인 (예시)')
ai('g_short', d6[2], 's6c.mp4', label='일반 드레인 (예시)')
concat(['s6a.mp4', 's6b.mp4', 's6c.mp4'], 's6.mp4')
ai('g_rebar', cd[6], 's7.mp4')
ai('p_out', cd[7], 's8.mp4', label='① 밖에서 큰 이물질')
ai('p_in', cd[8], 's9.mp4', label='② 안에서 작은 이물질')
w9 = [len(x) for x in SUBS[10]]; t1 = round(cd[9] * w9[0] / sum(w9), 3)
d9 = [round(t1 * 0.45, 3), round(t1 * 0.55, 3)]; d9.append(round(cd[9] - sum(d9), 3))
ai('p_sheet', d9[0], 's10a.mp4', label='③ 연장시트')
ai('p_cut', d9[1], 's10b.mp4', label='③ PVC 배관 속까지')
ai('p_xray', d9[2], 's10c.mp4', label='③ 콘크리트엔 물 안 닿음')
concat(['s10a.mp4', 's10b.mp4', 's10c.mp4'], 's10.mp4')
ai('safe', cd[10], 's11.mp4', label='콘크리트·철근 그대로')
# ★ 시공: 쓱싹쓱 — 동작당 1초 안팎, 줌 펀치 + 흰 플래시 + 큰 의성어, 마지막에 "누구나 OK"
DIY = [('step-02-glue-attach.jpg', '쓱'), ('step-04-coat1.jpg', '싹'), ('step-05-sheet.jpg', '착'),
       ('step-07-support.jpg', '쏙'), ('step-08-done.jpg', '끝!')]
def snappy(png, d, word, out, ok=False):
    n = max(1, int(round(d * FPS)))
    okchip = (f",drawtext=fontfile={FONT}:text='누구나 OK':fontsize=64:fontcolor=white:box=1:boxcolor=0x03C75A@0.95:boxborderw=26:"
              f"x=(w-tw)/2:y=1500:enable='gte(t,0.25)'") if ok else ''
    sh(f'ffmpeg -y -v error -loop 1 -framerate {FPS} -t {d} -i {png} -vf "scale=2160:3840,'
       f"zoompan=z='if(lt(on,6),1.24-0.04*on,1.0+0.002*(on-6))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},setsar=1,"
       f"fade=t=in:st=0:d=0.08:color=white,"
       f"drawtext=fontfile={FONT}:text='{word}':fontsize=230:fontcolor=white:borderw=14:bordercolor=0xE8780F:x=(w-tw)/2:y=250{okchip},"
       f"drawtext=fontfile={FONT}:text='실제 시공 영상 교체 예정':fontsize=30:fontcolor=white@0.8:box=1:boxcolor=black@0.35:boxborderw=10:x=w-tw-40:y=90\" "
       f'-frames:v {n} -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -an {out}')
if CONSTRUCT:
    sh(f'curl -sfL -o construct.mp4 "{CONSTRUCT}"')
    cl = dur('construct.mp4'); f = cl / cd[11]
    sh(f'ffmpeg -y -v error -i construct.mp4 -vf "setpts=PTS/{f:.4f},scale={W}:{H}:force_original_aspect_ratio=increase,'
       f'crop={W}:{H},fps={FPS},setsar=1" -t {cd[11]} -an -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p s12.mp4')
else:
    t_act = round(cd[11] * 0.62 / 4, 3); t_end = round(cd[11] - 4 * t_act, 3)
    parts = []
    for j, (src, word) in enumerate(DIY):
        compose(src, f'c12_{j}.png')
        snappy(f'c12_{j}.png', t_end if j == 4 else t_act, word, f's12_{j}.mp4', ok=(j == 4))
        parts.append(f's12_{j}.mp4')
    concat(parts, 's12.mp4')
compose('ref-01-thumbnail.png', 'c13.png', cy=1070, box=(940, 940), cta=True)
still('c13.png', cd[12], 's13.mp4', z=0.04)
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
    for p in ['narration.wav', 'subs.srt', 'subs.ass', 'c13.png']:
        z.write(p, p)
    z.writestr('README.txt', 'cut별 영상(video/), 묶음별 나레이션(narration/), 전체 나레이션, 자막(SRT/ASS), 그래픽 PNG\n'
               f'컷 길이(초): {cd}\n')
if os.environ.get('UP_MP4'):
    sh(f'curl -sf -X PUT -H "Content-Type: video/mp4" -H "If-None-Match: *" --upload-file final.mp4 "{os.environ["UP_MP4"]}"')
if os.environ.get('UP_ZIP'):
    sh(f'curl -sf -X PUT -H "Content-Type: application/octet-stream" -H "If-None-Match: *" --upload-file capcut.zip "{os.environ["UP_ZIP"]}"')
print('DONE', flush=True)
