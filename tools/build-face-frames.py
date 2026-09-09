"""Compose generated facial patches onto unchanged pose pixels."""
from pathlib import Path
import json
import shutil
import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('C:/Users/Thimira Perera/.codex/generated_images/01a05208-9ad4-7b32-9ac8-a6e2f7d5334e')
WORK = ROOT / 'face-generation-2026-09-10'
# Small feature regions in the original 1024x1536 coordinate space.
SPECS = {
 'standing': ('01180e62-fd95-4fd0-9b0b-224bbe9a03e9', [(384,267,502,370),(535,249,650,359)], (475,371,580,448)),
 'pointing-left': ('490adafa-b9de-4b4c-82b3-02793596abab', [(393,232,483,330),(535,259,648,362)], (438,355,547,435)),
 'pointing-right': ('d5f6d79c-5739-4ac5-8ddb-d678a8b317fe', [(396,257,507,355),(560,219,645,313)], (491,342,604,435)),
 'shrugging': ('127cea13-90ae-483f-a0b3-526697270740', [(384,292,493,392),(547,269,653,374)], (483,400,575,469)),
 'arms-folded': ('139f554f-9409-4626-be75-54e3eb3066da', [(383,267,488,365),(544,253,646,354)], (461,364,580,443)),
}

def build():
    WORK.mkdir(exist_ok=True)
    reports=[]
    preview=Image.new('RGB',(1500,1050),'#ffffff')
    for row,(pose,(source_id,eyes,mouth)) in enumerate(SPECS.items()):
        folder=ROOT/'vs-character'/pose
        base=Image.open(folder/(pose+'.png')).convert('RGBA')
        a=np.array(base)
        donor_path=WORK/(pose+'-donor.png')
        if not donor_path.exists():
            shutil.copy2(SOURCE/('exec-'+source_id+'.png'),donor_path)
        donor=np.array(Image.open(donor_path).convert('RGB'))
        assert donor.shape==a[:,:,:3].shape
        previews=[base]
        for kind,regions in [('blink',eyes),('talk',[mouth])]:
            result=a.copy()
            union=np.zeros(a.shape[:2],np.uint8)
            for x0,y0,x1,y1 in regions:
                mask_im=Image.new('L',base.size)
                ImageDraw.Draw(mask_im).rounded_rectangle((x0,y0,x1,y1),radius=14,fill=255)
                mask=np.array(mask_im)
                union=np.maximum(union,mask)
                # Poisson blending matches the generated skin to the base at
                # the small patch boundary. Explicit copy confines all edits.
                mixed=cv2.seamlessClone(donor,result[:,:,:3].copy(),mask.copy(),((x0+x1)//2,(y0+y1)//2),cv2.NORMAL_CLONE)
                result[mask>0,:3]=mixed[mask>0]
            assert np.array_equal(result[union==0],a[union==0])
            assert np.array_equal(result[:,:,3],a[:,:,3])
            changed=np.any(result!=a,axis=2)
            ys,xs=np.where(changed)
            assert len(xs)>0
            dest=folder/(pose+'-'+kind+'.png')
            Image.fromarray(result).save(dest)
            reports.append({'file':str(dest.relative_to(ROOT)), 'changed_pixels':int(changed.sum()), 'changed_bbox':[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())], 'outside_mask_changed':0,'alpha_unchanged':True})
            previews.append(Image.fromarray(result))
        for col,im in enumerate(previews):
            crop=im.crop((300,190,710,490)).resize((287,210),Image.Resampling.LANCZOS)
            preview.paste(crop.convert('RGB'),(col*500,row*210))
    preview.save(WORK/'face-review.jpg',quality=97)
    (WORK/'validation.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
    print(json.dumps(reports,indent=2))

if __name__=='__main__':
    build()
