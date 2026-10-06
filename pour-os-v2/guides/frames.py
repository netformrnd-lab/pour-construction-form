#!/usr/bin/env python3
"""완성 mp4 에서 자막마다 가운데 순간 1장씩 뽑기 + 6장씩 묶은 한눈 보기
python3 frames.py <out_dir> <결과.mp4>  →  <out_dir>/check/NN.png · sheet-K.png · check.json(자막·시각·보인 시간·읽을 시간)
"""
import json, os, subprocess, sys, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
INTRO = 3.2

def main():
    out_dir, mp4 = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    meta = json.load(open(os.path.join(out_dir, 'caps.json')))
    cj = os.path.join(out_dir, 'cards.json')   # build.py 가 쓴 처음 카드 길이 (없으면 예전 3.2)
    INTRO = json.load(open(cj)).get('intro', 3.2) if os.path.exists(cj) else 3.2
    caps = meta['caps']; start = max(0, caps[0]['t'] - 0.4); end = meta['end']
    ck = os.path.join(out_dir, 'check'); os.makedirs(ck, exist_ok=True)
    for f in os.listdir(ck): os.remove(os.path.join(ck, f))
    rows = []
    for i, c in enumerate(caps):
        if not c.get('title'): continue
        t2 = caps[i + 1]['t'] if i + 1 < len(caps) else end
        shown = t2 - c['t']; text = (c.get('title') or '') + (c.get('sub') or '')
        need = max(2.5, len(text.replace(' ', '')) / 7.0)   # 한글 1초 7글자 정도
        at = INTRO + (c['t'] + t2) / 2 - start
        p = os.path.join(ck, f'{len(rows)+1:02d}.png')
        subprocess.run([FF, '-y', '-loglevel', 'error', '-ss', f'{at:.2f}', '-i', mp4, '-frames:v', '1', '-vf', 'scale=iw/2:-2', p], check=True)
        rows.append({'n': len(rows) + 1, 'ch': c.get('ch'), 'title': c['title'], 'sub': c.get('sub', ''), 'at': round(at, 1), 'shown': round(shown, 1), 'need': round(need, 1), 'short': shown < need, 'png': p})
    pngs = [r['png'] for r in rows]
    for k in range(0, len(pngs), 6):
        grp = pngs[k:k + 6]; args = []
        for p in grp: args += ['-i', p]
        subprocess.run([FF, '-y', '-loglevel', 'error', *args, '-filter_complex', f'hstack=inputs={len(grp)}' if len(grp) > 1 else 'null', os.path.join(ck, f'sheet-{k // 6 + 1}.png')], check=True)
    json.dump(rows, open(os.path.join(ck, 'check.json'), 'w'), ensure_ascii=False, indent=1)
    dur = subprocess.run([FF, '-i', mp4], capture_output=True, text=True).stderr
    d = [l.strip() for l in dur.splitlines() if 'Duration' in l]
    print(json.dumps({'captions': len(rows), 'too_short': [r['n'] for r in rows if r['short']], 'duration': d[0] if d else '?', 'sheets': (len(pngs) + 5) // 6}, ensure_ascii=False))

if __name__ == '__main__':
    main()
