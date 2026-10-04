# 원리 컷 ①②③ AI 영상용 키프레임(시작·끝) + 라벨 오버레이 PNG 생성 (Higgsfield sandbox에서 실행)
# 트랩은 실제 제품 이미지만 합성 → AI 영상 모델은 이 두 장면 사이의 움직임만 생성
import os, subprocess
from PIL import Image
CF = 'https://d8j0ntlcm91z4.cloudfront.net/user_39sUpHbwBquNe1iB2u0CUyyHgzC/'
GH = 'https://raw.githubusercontent.com/netformrnd-lab/pour-construction-form/claude/eloquent-turing-r4703j/prompts/shorts/drain-trap/'
MG = {
    'bg_roof': 'hf_20261003_014747_e2c32272-5711-4544-8ae7-c06261bc9a59.png',
    'bg_top': 'hf_20261003_014746_2df00480-9148-4b8d-b58e-1f4cefa8cf83.png',
    'conc': 'hf_20261003_014925_c2cf20fc-be4f-4d33-9295-7755316ebf2c.png',
    'leaves': 'hf_20261003_014746_6ce24b77-37f3-4c37-a5d5-e8d5982cb65f.png',
    'prod': 'hf_20261003_014752_d1fa80e7-6663-485e-a73a-36d36ed6b2cf.png',
}
D = {'out': 3.4, 'in': 3.3, 'deep': 5.6}; SPLIT = 2.4
def sh(c): subprocess.run(c, shell=True, check=True)
os.makedirs('kf', exist_ok=True); os.chdir('kf')
os.makedirs('fonts', exist_ok=True)
if not os.path.exists('fonts/NotoSansCJKkr-Bold.otf'):
    sh('curl -sfL -o fonts/NotoSansCJKkr-Bold.otf https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansCJKkr-Bold.otf')
for k, v in MG.items(): sh(f'curl -sfL -o mg_{k}.png "{CF}{v}"')
for n in ['part-support-top-cut.png', 'part-dome-top-cut.png', 'mg_principle.py']: sh(f'curl -sfL -o "{n}" "{GH}{n}"')
import sys; sys.path.insert(0, '.')
import mg_principle as M
for mode in ('clean', 'labels'):
    M.MODE = mode
    M.mg_outside('mg_bg_roof.png', 'mg_prod.png', 'mg_leaves.png', D['out'], 'out')
    M.mg_inside('mg_bg_top.png', 'part-support-top-cut.png', 'part-dome-top-cut.png', D['in'], 'in')
    M.mg_deep('mg_conc.png', 'mg_prod.png', D['deep'], SPLIT, 'deep')
for k in ('out', 'in', 'deep'):
    for i in (0, 1): Image.open(f'{k}_clean_{i}.png').convert('RGB').save(f'../kf_{k}_{i}.png')
ims = [Image.open(f'../kf_{k}_{i}.png').resize((270, 480)) for k in ('out', 'in', 'deep') for i in (0, 1)]
sheet = Image.new('RGB', (270 * 6, 480), 'white')
for j, im in enumerate(ims): sheet.paste(im, (270 * j, 0))
sheet.save('../kf_contact.jpg', quality=85)
print('ok', os.listdir('.'))
