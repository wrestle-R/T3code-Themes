"""Build the self-contained Minecraft theme with Pillow."""
from base64 import b64encode
from io import BytesIO
from pathlib import Path
import json
from math import sin, tau
from PIL import Image, ImageColor, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path(__file__).with_name('assets') / 'minecraft'

def data_url(data, media_type):
    return f'url("data:{media_type};base64,{b64encode(data).decode()}")'

def sprite_url(image):
    out = BytesIO()
    image.save(out, 'PNG', optimize=True)
    return data_url(out.getvalue(), 'image/png')

SPRITE_SIZE = 32
OUTLINE = '#090a0c'

# Each cuboid has a lit top, a face, and a darker right plane.
def voxel(draw, bounds, colors, depth=3):
    x, y, right, bottom = bounds
    top, front, side = colors
    draw.polygon([(x, y), (x+depth, y-depth), (right+depth, y-depth), (right, y)], fill=top)
    draw.polygon([(right, y), (right+depth, y-depth), (right+depth, bottom-depth), (right, bottom)], fill=side)
    draw.rectangle(bounds, fill=front)
    draw.line((x, y, right, y), fill=top)

def outlined(image):
    edge = Image.new('RGBA', image.size, OUTLINE)
    edge.putalpha(image.getchannel('A').filter(ImageFilter.MaxFilter(3)))
    edge.alpha_composite(image)
    return edge

def held_gear(tier):
    tool = Image.new('RGBA', (SPRITE_SIZE, SPRITE_SIZE))
    draw = ImageDraw.Draw(tool)
    if tier == 'fast':
        draw.line([(23, 28), (27, 20)], fill='#78350f', width=2)
        draw.line([(24, 27), (26, 23)], fill='#ac6940')
        draw.polygon([(22, 19), (24, 17), (28, 17), (30, 19), (30, 22), (28, 21), (27, 19)], fill='#cbd5e1')
        draw.line([(25, 18), (28, 19), (29, 21)], fill='#78889f')
    else:
        blade, bevel, guard = ('#3b3340', '#6b5b73', '#f59e0b') if tier == 'heavy' else ('#22d3ee', '#0284c7', '#a5f3fc')
        draw.line([(23, 28), (27, 22)], fill='#673f2b', width=2)
        draw.polygon([(24, 23), (27, 17), (30, 16), (30, 20), (27, 24)], fill=blade)
        draw.line([(27, 22), (29, 18)], fill=bevel, width=2)
        draw.line([(22, 22), (26, 25)], fill=guard)
        draw.point((29, 17), fill=guard)
    return outlined(tool)

PALETTES = {
    'openai': ('#eef2f8', '#cbd5e1', '#64748b'),
    'claude': ('#ffc395', '#c77c52', '#8e4b36'),
    'gemini': ('#7dd3fc', '#38bdf8', '#0284c7'),
    'opencode': ('#303039', '#13131a', '#201c2b'),
    'creeper': ('#68d965', '#46b543', '#338c31'),
    'fox': ('#ffad69', '#ff7a1a', '#d95b00'),
}

def mini_mob(key, tier):
    colors = PALETTES[key]
    sheet = Image.new('RGBA', (SPRITE_SIZE * 4, SPRITE_SIZE))
    for stage in range(4):
        frame = Image.new('RGBA', (SPRITE_SIZE, SPRITE_SIZE))
        draw = ImageDraw.Draw(frame)
        if key == 'gemini':
            wing_tip = (14, 12, 10, 13)[stage]
            draw.polygon([(9, 21), (2, wing_tip), (2, 21), (7, 25)], fill=(130, 223, 255, 165))
            draw.polygon([(20, 21), (28, wing_tip), (28, 21), (23, 25)], fill=(130, 223, 255, 165))
            draw.line([(2, wing_tip + 2), (7, 21)], fill=(209, 245, 255, 205))
            draw.line([(27, wing_tip + 2), (22, 21)], fill=(209, 245, 255, 205))
            voxel(draw, (10, 19, 18, 27), colors, 2)
            voxel(draw, (9, 4, 19, 19), colors)
            draw.rectangle((12, 2, 15, 5), fill=colors[0])
            draw.rectangle((11, 10, 12, 14-stage%2), fill='#15273d')
            draw.rectangle((16, 10, 17, 14-stage%2), fill='#15273d')
            draw.point((13, 16), fill='#dcf7ff')
            draw.point((14, 16), fill='#dcf7ff')
        elif key == 'fox':
            voxel(draw, (9, 20, 20, 27), colors)
            draw.polygon([(8, 26), (5, 25), (3, 21), (6, 20), (11, 24)], fill=colors[2])
            draw.rectangle((3, 21, 5, 22), fill='#f8fafc')
            for x in (8, 18):
                draw.rectangle((x, 26, x+3, 29), fill='#3d2832')
            voxel(draw, (7, 8, 20, 21), colors)
            for x in (7, 18):
                draw.polygon([(x, 10), (x, 4), (x+2, 2), (x+5, 9)], fill=colors[1])
                draw.line((x+1, 5, x+2, 3), fill='#442330', width=2)
                draw.polygon([(x+1, 9), (x+2, 6), (x+3, 9)], fill='#ffc59c')
            draw.polygon([(7, 15), (11, 17), (16, 17), (20, 15), (20, 21),
                          (17, 23), (12, 23), (9, 21)], fill='#f8fafc')
            draw.rectangle((12, 18, 16, 19), fill='#e5d1c8')
            draw.rectangle((13, 20, 15, 21), fill='#321c29')
            for x in (10, 17):
                draw.rectangle((x, 12, x+1, 14-stage%2), fill=OUTLINE)
        elif key == 'creeper':
            voxel(draw, (10, 18, 18, 27), colors)
            for x, y in ((8, 25), (19, 25), (10, 27), (16, 27)):
                voxel(draw, (x, y, x+2, y+2), colors, 1)
            voxel(draw, (6, 5, 20, 20), colors, 4)
            for x, y, length in ((7, 7, 2), (16, 7, 2), (8, 15, 2), (18, 15, 2), (7, 18, 3), (17, 19, 2), (13, 24, 2)):
                draw.line((x, y, x+length-1, y), fill=colors[0] if (x+y)%2 else colors[2])
            draw.rectangle((8, 10, 11, 13-stage%2), fill='#111914')
            draw.rectangle((15, 10, 18, 13-stage%2), fill='#111914')
            draw.polygon([(12, 13), (14, 13), (14, 15), (16, 15), (16, 18),
                          (14, 18), (14, 16), (12, 16), (12, 18), (10, 18), (10, 15), (12, 15)], fill='#111914')
        elif key == 'opencode':
            for x in (10, 16):
                voxel(draw, (x, 24, x+2, 29), colors, 1)
            for x in (6, 20):
                voxel(draw, (x, 17, x+2, 27), colors, 1)
            voxel(draw, (10, 17, 18, 25), colors, 2)
            voxel(draw, (7, 5, 20, 18), colors, 4)
            for x in (9, 15):
                draw.rectangle((x, 11, x+3, 12), fill='#cc00fa')
                draw.point((x+1, 11+(stage==1)), fill='#f59eff')
            for pos in ((3, 8), (24, 9), (4, 20-(stage==1))):
                draw.point(pos, fill='#a65cdb')
        else:
            for x in (9, 16):
                voxel(draw, (x, 25, x+4, 29), colors, 2)
            voxel(draw, (7, 17, 21, 26), colors)
            for x in (4, 21):
                voxel(draw, (x, 18, x+3, 26), colors, 2)
            voxel(draw, (8, 5, 19, 18), colors, 4)
            draw.line((9, 10, 18, 10), fill=colors[2], width=2)
            for x in (10, 16):
                draw.rectangle((x, 11, x+1, 13-stage%2), fill='#713c32')
            draw.rectangle((13, 12, 15, 17), fill=colors[0])
            draw.line((13, 17, 16, 17), fill=colors[2])
            if key == 'openai':
                draw.line([(8, 19), (11, 20), (11, 23), (15, 24), (15, 25)], fill='#4d7c0f', width=2)
                draw.point((9, 19), fill='#a3bc62')
                draw.point((13, 23), fill='#65a30d')
                if stage == 0:
                    draw.line((24, 27, 25, 22), fill='#65a30d', width=2)
                    draw.rectangle((24, 20, 26, 22), fill='#ef4444')
                    draw.point((25, 20), fill='#ff9c83')
            else:
                draw.rectangle((13, 2, 15, 5), fill=colors[0])
                draw.rectangle((11, 20, 16, 23), fill='#886955')
                draw.line((11, 21, 16, 21), fill='#c2bc87')
                draw.point((15, 23), fill='#65a78c')
        base = Image.new('RGBA', frame.size)
        ImageDraw.Draw(base).ellipse((4, 29, 25, 31), fill=(7, 8, 10, 115))
        base.alpha_composite(outlined(frame))
        if stage >= 2:
            base.alpha_composite(held_gear(tier))
        sheet.paste(base, (stage * SPRITE_SIZE, 0))
    return sheet


assets = {
    mob + suffix: sprite_url(mini_mob(mob, tier))
    for mob in PALETTES
    for tier, suffix in [('standard', ''), ('fast', '-fast'), ('heavy', '-heavy')]
}

# The strata and diagonal grain both wrap on a 32-pixel period.
stone = Image.new('RGB', (32, 32))
strata = [ImageColor.getrgb(color) for color in ('#0e1014', '#13161c', '#181c24', '#1f242e')]
for y in range(32):
    for x in range(32):
        bend = 1.5 * sin(tau*(x+2*y)/32) + 0.9 * sin(tau*(2*x-y)/32)
        ridge = int((y + bend + 32) % 32)
        cut = (x + 5*(ridge//8)) % 32
        layer = 1
        if ridge in (2, 11, 19, 28) and not 22 <= cut <= 26:
            layer = 0
        elif ridge in (3, 4, 12, 20, 21, 29) and not 10 <= cut <= 13:
            layer = 2
        grain = (x + 3*y + (x//4)*2) % 32
        if grain in (6, 7) and layer == 2 and cut < 18:
            layer = 3
        elif grain in (14, 15, 16) and layer == 1:
            layer = 2
        stone.putpixel((x, y), strata[layer])
assets['deepslate'] = sprite_url(stone)

sparks = Image.new('RGBA', (24, 18))
draw = ImageDraw.Draw(sparks)
draw.point((19, 8), fill='#80ff20')
draw.point((22, 11), fill='#67e8f9')
assets['effort-sparks-art'] = sprite_url(sparks)
draw.line([(20, 2), (20, 4), (22, 4)], fill='#c084fc')
draw.point((22, 2), fill='#f5d0fe')
draw.line([(16, 5), (17, 4), (18, 5), (17, 6), (16, 5)], fill='#d8b4fe')
draw.line([(21, 14), (22, 15), (23, 14)], fill='#67e8f9')
assets['effort-runes'] = sprite_url(sparks)

# Each icon occupies a 16px box and replaces only the existing control glyph.
icons = {
    'craft': ('#754a32', '#c38c59', ['..dddddddddd..', '.dlllllllllld.', '.dlllddlldlld.', '.dlllddlldlld.',
                                  '.dddddddddddd.', '.dldllddllld.', '.dldllddllld.', '.dldllddllld.', '.dddddddddddd.']),
    'book': ('#753d90', '#dca5f0', ['..ddddddddd...', '..dlllllllld..', '..dlddddlld...', '..dlllllld....',
                                 '..ddllldd.....', '..dlllllld....', '..dddddddd....']),
    'repeater': ('#464d59', '#ee6464', ['...l......l...', '..lll....lll..', '...l......l...', '..dddddddddd..',
                                     '.dddddddddddd.', '.dddddddddddd.']),
    'paper': ('#928b80', '#f0e8d8', ['...dddddddd...', '...dlllllld...', '...dldddl ld...', '...dlllll ld...',
                                   '...dldddl ld...', '...dlllllld...', '...dddddddd...']),
    'emerald': ('#227752', '#70e5a9', ['.....dddd.....', '....dllll d....', '...dllllll d...', '...dllllll d...',
                                     '....dllll d....', '.....dddd.....']),
    'command': ('#966148', '#e3aa81', ['..dddddddddd..', '..dllllllll d..', '..dlddddlll d..', '..dldlldlll d..',
                                     '..dlddddlll d..', '..dllllllll d..', '..dddddddddd..']),
}
for key, (dark, light, rows) in icons.items():
    icon = Image.new('RGBA', (16, 16))
    palette = {'d': ImageColor.getcolor(dark, 'RGBA'), 'l': ImageColor.getcolor(light, 'RGBA')}
    for y, row in enumerate(rows, (16 - len(rows)) // 2):
        for x, pixel in enumerate(row.replace(' ', ''), 1):
            if pixel in palette:
                icon.putpixel((x, y), palette[pixel])
    assets[key] = sprite_url(icon)

css = '/* Silkscreen license\n' + (ASSETS / 'silkscreen-OFL.txt').read_text(encoding='utf-8') + '\n*/\n'
css += '@font-face { font-family: "Minecraft UI"; font-display: swap; src: '
css += data_url((ASSETS / 'silkscreen.woff2').read_bytes(), 'font/woff2') + " format('woff2'); }\n"
css += ':root {\n' + '\n'.join(f'--mc-{key}: {value};' for key, value in assets.items()) + '\n}\n'
css += (ASSETS / 'theme.css').read_text(encoding='utf-8')

dark = {
    'canvas': '#121316', 'text': '#e8eaee', 'textMuted': '#a4aab6',
    'chrome': '#191b20', 'toolbar': '#191b20', 'toolbarForeground': '#e8eaee',
    'toolbarBorder': '#252830', 'toolbarControl': '#202229', 'toolbarControlHover': '#292d35',
    'sidebar': '#191b20', 'sidebarForeground': '#e8eaee', 'sidebarMutedForeground': '#a4aab6',
    'sidebarRowActive': '#252830', 'sidebarRowSelected': '#252830', 'sidebarRowHover': '#202229',
    'sidebarBorder': '#252830', 'sidebarControlSurface': '#202229',
    'surface': '#191c22', 'surfaceRaised': '#14161a', 'surfaceOverlay': '#191c22',
    'messageSurface': '#191c22', 'messageForeground': '#eee9e1',
    'border': '#252830', 'input': '#14161a', 'focus': '#38bdf8',
    'accent': '#38bdf8', 'accentForeground': '#10191f', 'accentSurface': '#1c2a32',
    'secondary': '#202229', 'secondaryForeground': '#e8eaee', 'muted': '#252830',
    'mutedForeground': '#a4aab6', 'secondaryLabel': '#a4aab6', 'placeholder': '#a4aab6',
    'iconMuted': '#a4aab6', 'codeBackground': '#15171b', 'codeForeground': '#e8eaee',
    'messageAction': '#d92b2b', 'messageActionHover': '#bf2525', 'messageActionForeground': '#fff',
    'terminalBackground': '#121316', 'terminalForeground': '#e8eaee',
}
light = {
    'canvas': '#e8e9ec', 'text': '#20232a', 'surfaceRaised': '#f8f9fb',
    'textMuted': '#505663', 'toolbar': '#f1f2f5', 'toolbarBorder': '#bac0cb',
    'messageSurface': '#e9dfd4', 'messageForeground': '#2f251d',
    'accent': '#116587', 'accentForeground': '#fff',
}
theme = {
    'version': 1, 'id': 'minecraft', 'name': 'Minecraft', 'appearance': 'dark',
    'canvas': dark['canvas'], 'accent': dark['accent'], 'colors': dark,
    'variants': {'light': light}, 'css': css,
}
assert len(css) < 100000, len(css)
(ROOT / 'public/downloads/minecraft.json').write_text(json.dumps(theme, indent=2) + '\n')
print(f'Minecraft CSS: {len(css):,} characters')
