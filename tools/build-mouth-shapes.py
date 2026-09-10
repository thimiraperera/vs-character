"""Build 25 mouth-only RGBA frames from generated donors and verify pixels."""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'mouth-generation-2026-09-10'
BOXES={
 'standing':(475,371,580,448),
 'pointing-left':(438,355,547,435),
 'pointing-right':(491,342,604,435),
 'shrugging':(483,400,575,469),
 'arms-folded':(461,364,580,443),
}
SHAPES=['a','e','o','m','s']

def main():
    report=[]
    sheet=Image.new('RGB',(1200,800),'#ffffff')
    draw=ImageDraw.Draw(sheet)
    for row,(pose,box) in enumerate(BOXES.items()):
        folder=ROOT/'vs-character'/pose
        base=Image.open(folder/(pose+'.png')).convert('RGBA')
        a=np.array(base)
        x0,y0,x1,y1=box
        mask_im=Image.new('L',base.size)
        ImageDraw.Draw(mask_im).rounded_rectangle(box,radius=10,fill=255)
        mask=np.array(mask_im)
        for col,shape in enumerate(SHAPES):
            donor_path=WORK/'donors'/(pose+'-talk-'+shape+'.png')
            if not donor_path.exists():
                continue
            donor=np.array(Image.open(donor_path).convert('RGB'))
            assert donor.shape==a[:,:,:3].shape, donor_path
            mixed=cv2.seamlessClone(donor,a[:,:,:3].copy(),mask.copy(),((x0+x1)//2,(y0+y1)//2),cv2.NORMAL_CLONE)
            result=a.copy()
            result[mask>0,:3]=mixed[mask>0]
            assert np.array_equal(result[mask==0],a[mask==0])
            assert np.array_equal(result[:,:,3],a[:,:,3])
            changed=np.any(result!=a,axis=2)
            yy,xx=np.where(changed)
            assert len(xx)>0
            path=folder/(pose+'-talk-'+shape+'.png')
            im=Image.fromarray(result)
            if not path.exists() or not np.array_equal(np.array(Image.open(path)),result):
                im.save(path)
            # Validate decoded export too, including invisible RGB and alpha.
            saved=np.array(Image.open(path))
            assert np.array_equal(saved,result)
            report.append({'file':str(path.relative_to(ROOT)),'changed_pixels':int(changed.sum()),'bbox':[int(xx.min()),int(yy.min()),int(xx.max()),int(yy.max())],'outside_mouth_changed':0,'alpha_identical':True})
            crop=im.crop((x0-15,y0-15,x1+15,y1+15)).convert('RGB')
            crop.thumbnail((220,120),Image.Resampling.LANCZOS)
            # Enlarge feature previews for comfortable inspection.
            crop=crop.resize((220,120),Image.Resampling.LANCZOS)
            sheet.paste(crop,(col*240,row*160+25))
            draw.text((col*240+5,row*160+5),pose+' / '+shape,fill='black')
    sheet.save(WORK/'mouth-review.jpg',quality=97)
    (WORK/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(f'Built and verified {len(report)}/25 mouth frames.')

if __name__=='__main__':
    main()
