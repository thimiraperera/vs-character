"""Remove border-connected neutral checkerboards; preserve pose geometry."""
from pathlib import Path
import shutil
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'pose-drafts-2026-09-07'
POSES = ['pointing-left', 'pointing-right', 'shrugging', 'arms-folded']

def remove(path):
    backup = ART / 'originals-checkerboard' / path.parent.name / path.name
    backup.parent.mkdir(parents=True, exist_ok=True)
    if not backup.exists():
        shutil.copy2(path, backup)
    im = Image.open(backup).convert('RGBA')
    w, h = im.size
    # White garments are enclosed by dark contours. Only neutral light pixels
    # connected to the outside are classified as background.
    eligible = Image.new('L', (w + 2, h + 2), 255)
    interior = Image.new('L', (w, h))
    interior.putdata([255 if min(r,g,b) >= 175 and max(r,g,b)-min(r,g,b) <= 24
                      else 0 for r,g,b,a in im.getdata()])
    eligible.paste(interior, (1, 1))
    ImageDraw.floodfill(eligible, (0, 0), 128, thresh=0)
    outside = eligible.crop((1,1,w+1,h+1)).point(lambda x: 255 if x == 128 else 0)
    # Remove the bright subpixel fringe along the background-facing contour.
    edge = outside.filter(ImageFilter.MaxFilter(3))
    pixels = list(im.getdata())
    bg = list(outside.getdata())
    fringe = list(edge.getdata())
    result = []
    for (r,g,b,a), is_bg, near_bg in zip(pixels,bg,fringe):
        if is_bg:
            result.append((0,0,0,0))
        elif near_bg and min(r,g,b) > 65 and max(r,g,b)-min(r,g,b) < 35:
            # Antialiased dark outline over the pale checkerboard, modeled
            # against a near-white matte; retain coverage and unmix the matte.
            alpha = max(0.0, min(1.0, (245-max(r,g,b))/205))
            if alpha > 0:
                rgb = tuple(max(0,min(255,round((c-245*(1-alpha))/alpha))) for c in (r,g,b))
                result.append((*rgb, round(alpha*255)))
            else:
                result.append((0,0,0,0))
        else:
            result.append((r,g,b,a))
    im.putdata(result)
    im.save(path)
    alpha = im.getchannel('A')
    assert im.size == (1024,1536)
    assert alpha.getextrema() == (0,255)
    assert all(alpha.getpixel(p)==0 for p in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)])
    print(f'{path.parent.name}: {w}x{h}, RGBA, transparent pixels={sum(v==0 for v in alpha.getdata())}')
    return im

if __name__ == '__main__':
    sheet = Image.new('RGB',(1024,768),'#577b88')
    for n, pose in enumerate(POSES):
        im = remove(ART / pose / (pose+'.png'))
        thumb = im.resize((256,384), Image.Resampling.LANCZOS)
        for row, color in enumerate(['#577b88','#242033']):
            tile=Image.new('RGBA',thumb.size,color)
            tile.alpha_composite(thumb)
            sheet.paste(tile.convert('RGB'),(n*256,row*384))
    sheet.save(ART / 'transparency-preview.jpg',quality=95)
