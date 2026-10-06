#!/usr/bin/env python3
"""녹화(webm) + 자막 시각(caps.json) → 자막 띠가 붙은 mp4 (앞뒤 제목 카드 포함)

python3 build.py <out_dir> <portrait|landscape> <결과.mp4> "<제목>" "<부제>" "<끝 카드 줄1|줄2|...>" [처음 카드 초 · 기본 3.2] [끝 카드 초 · 기본 4.5]
 - 카드 길이를 주면 그대로 씀 (안 주면 예전처럼 3.2 / 4.5) · 쓴 길이는 <out_dir>/cards.json 에 남김 → frames.py 가 읽음
 - caps.json: {video, end, caps:[{t, ch, title, sub}]}  (rec.mjs finish 가 씀)
 - 자막은 다음 자막 시각까지 보임 · 첫 자막 0.4초 전부터 자름
"""
import json, subprocess, sys, os, imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, 'font')
NAVY, NAVY2, PALE = '0F1F5C', '24386B', 'C9D3F2'

LAY = {
    # 출력 크기 · 화면 넣을 폭 · 위 여백 · 자막 띠 위치/글자 크기
    'portrait': dict(W=1080, H=1920, vw=741, top=36, band=1662, chip=30, title=50, sub=36, margin=70, cardT=86, cardS=44),
    'landscape': dict(W=1920, H=1080, vw=1536, top=10, band=884, chip=26, title=44, sub=32, margin=200, cardT=84, cardS=42),
}

def ass_color(hexrgb, alpha='00'):
    r, g, b = hexrgb[0:2], hexrgb[2:4], hexrgb[4:6]
    return f'&H{alpha}{b}{g}{r}'

def ts(x):
    x = max(0, x); h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60
    return f'{h}:{m:02d}:{s:05.2f}'

def esc(s):
    return (s or '').replace('\\', '＼').replace('{', '(').replace('}', ')').replace('\n', '\\N')

def header(L):
    W, H = L['W'], L['H']
    return f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Chip,Pretendard,{L['chip']},{ass_color('0F1F5C')},&H000000FF,{ass_color('FFFFFF')},{ass_color('FFFFFF')},-1,0,0,0,100,100,0,0,3,9,0,7,{L['margin']},{L['margin']},0,1
Style: Title,Pretendard ExtraBold,{L['title']},{ass_color('FFFFFF')},&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,{L['margin']},{L['margin']},0,1
Style: Sub,Pretendard SemiBold,{L['sub']},{ass_color(PALE)},&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,{L['margin']},{L['margin']},0,1
Style: CardT,Pretendard ExtraBold,{L['cardT']},{ass_color('FFFFFF')},&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,{L['margin']},{L['margin']},0,1
Style: CardS,Pretendard SemiBold,{L['cardS']},{ass_color(PALE)},&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,{L['margin']},{L['margin']},0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

def run(args):
    r = subprocess.run([FF, '-y', '-loglevel', 'error'] + args, capture_output=True, text=True)
    if r.returncode: sys.exit('ffmpeg 실패: ' + r.stderr[-2000:])

ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart']

def card(L, lines, dur, path, ass_path):
    W, H = L['W'], L['H']
    a = header(L)
    big, rest = lines[0], lines[1:]
    gap = L['cardS'] * 1.7
    y0 = H / 2 - (len(rest) * gap) / 2 - (L['cardT'] * 0.6 if rest else 0)
    a += f"Dialogue: 0,{ts(0)},{ts(dur)},CardT,,0,0,0,,{{\\pos({W/2},{y0})\\fad(250,250)}}{esc(big)}\n"
    for i, s in enumerate(rest):
        a += f"Dialogue: 0,{ts(0)},{ts(dur)},CardS,,0,0,0,,{{\\pos({W/2},{y0 + L['cardT'] * 0.9 + i * gap})\\fad(250,250)}}{esc(s)}\n"
    open(ass_path, 'w').write(a)
    run(['-f', 'lavfi', '-i', f'color=c=0x{NAVY}:s={W}x{H}:r=30:d={dur}', '-vf', f"subtitles={ass_path}:fontsdir={FONTS}", *ENC, path])

def main():
    out_dir, lay, result, title, subtitle, outro = sys.argv[1:7]
    intro_s = float(sys.argv[7]) if len(sys.argv) > 7 and sys.argv[7] else 3.2
    outro_s = float(sys.argv[8]) if len(sys.argv) > 8 and sys.argv[8] else 4.5
    out_dir = os.path.abspath(out_dir); result = os.path.abspath(result)
    L = LAY[lay]; W, H = L['W'], L['H']
    meta = json.load(open(os.path.join(out_dir, 'caps.json')))
    caps = [c for c in meta['caps']]
    start = max(0, caps[0]['t'] - 0.4); end = meta['end']
    a = header(L)
    for i, c in enumerate(caps):
        if not c.get('title'): continue
        t1 = c['t'] - start; t2 = (caps[i + 1]['t'] if i + 1 < len(caps) else end) - start
        y = L['band'] + 22
        if c.get('ch'):
            a += f"Dialogue: 0,{ts(t1)},{ts(t2)},Chip,,0,0,0,,{{\\pos({L['margin']+8},{y})}}{esc(c['ch'])}\n"
            y += L['chip'] + 30
        a += f"Dialogue: 1,{ts(t1)},{ts(t2)},Title,,0,0,0,,{{\\pos({L['margin']},{y})}}{esc(c['title'])}\n"
        if c.get('sub'):
            a += f"Dialogue: 1,{ts(t1)},{ts(t2)},Sub,,0,0,0,,{{\\pos({L['margin']},{y + L['title'] + 16})}}{esc(c['sub'])}\n"
    ass = os.path.join(out_dir, 'caps.ass'); open(ass, 'w').write(a)
    main_mp4 = os.path.join(out_dir, 'main.mp4')
    vw = L['vw']; x = (W - vw) // 2
    fc = (f"color=c=0x{NAVY}:s={W}x{H}:r=30[bg];"
          f"[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS,fps=30,scale={vw}:-2:flags=lanczos[v];"
          f"[bg][v]overlay=x={x}:y={L['top']}:shortest=1,subtitles={ass}:fontsdir={FONTS}[o]")
    # 프레임(시각 있음) → concat 목록 (프레임마다 다음 프레임까지 보임)
    fr = json.load(open(meta['video']))
    fr = [f for f in fr if f['t'] <= end]
    k = max([i for i, f in enumerate(fr) if f['t'] <= start] or [0])
    fr = fr[k:]
    lines = ['ffconcat version 1.0']
    for i, f in enumerate(fr):
        t1 = max(f['t'], start); t2 = fr[i + 1]['t'] if i + 1 < len(fr) else end
        if t2 - t1 <= 0: continue
        lines += [f"file '{os.path.join(out_dir, f['file'])}'", f'duration {t2 - t1:.3f}']
    lines += [f"file '{os.path.join(out_dir, fr[-1]['file'])}'"]
    fl = os.path.join(out_dir, 'frames.ffconcat'); open(fl, 'w').write('\n'.join(lines) + '\n')
    fc = fc.replace(f"trim=start={start}:end={end},setpts=PTS-STARTPTS,", '')
    run(['-f', 'concat', '-safe', '0', '-i', fl, '-filter_complex', fc, '-map', '[o]', *ENC, main_mp4])
    intro = os.path.join(out_dir, 'intro.mp4'); outro_mp4 = os.path.join(out_dir, 'outro.mp4')
    card(L, [title] + [s for s in subtitle.split('|') if s], intro_s, intro, os.path.join(out_dir, 'intro.ass'))
    card(L, [s for s in outro.split('|') if s], outro_s, outro_mp4, os.path.join(out_dir, 'outro.ass'))
    json.dump({'intro': intro_s, 'outro': outro_s}, open(os.path.join(out_dir, 'cards.json'), 'w'))
    lst = os.path.join(out_dir, 'list.txt')
    open(lst, 'w').write(''.join(f"file '{p}'\n" for p in [intro, main_mp4, outro_mp4]))
    run(['-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', result])
    print(json.dumps({'result': result, 'start': start, 'end': end, 'captions': sum(1 for c in caps if c.get('title'))}, ensure_ascii=False))

if __name__ == '__main__':
    main()
