"""Apply bounded facial edits, retaining exact original pixels elsewhere."""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'artwork-fixes-2026-09-10'
ART=ROOT/'artwork-masters'
BOXES={'standing':(475,371,580,448),'pointing-left':(438,355,547,435),'pointing-right':(491,342,604,435),'shrugging':(470,394,584,474),'arms-folded':(461,364,580,443)}
BROWS=[(391,232,472,295),(554,209,640,269)]
EYES=[(384,292,493,392),(547,269,653,374)]

def read(path):return np.array(Image.open(path).convert('RGBA'))
def original(pose,name):return read(WORK/'before'/pose/(name+'.png'))
def blend(base,donor,boxes):
    result=base.copy(); union=np.zeros(base.shape[:2],np.uint8)
    for box in boxes:
        x0,y0,x1,y1=box
        m=Image.new('L',(base.shape[1],base.shape[0]))
        ImageDraw.Draw(m).rounded_rectangle(box,radius=7,fill=255)
        mask=np.array(m);union|=mask
        mixed=cv2.seamlessClone(donor[:,:,:3].copy(),result[:,:,:3].copy(),mask.copy(),((x0+x1)//2,(y0+y1)//2),cv2.NORMAL_CLONE)
        result[mask>0,:3]=mixed[mask>0]
    assert np.array_equal(result[union==0],base[union==0])
    assert np.array_equal(result[:,:,3],base[:,:,3])
    return result,union

def main():
    reports=[]
    def save(pose,name,result,base,allowed):
        assert np.array_equal(result[allowed==0],base[allowed==0])
        assert np.array_equal(result[:,:,3],base[:,:,3])
        dest=ART/pose/(name+'.png')
        if not dest.exists() or not np.array_equal(read(dest),result):Image.fromarray(result).save(dest)
        delta=np.any(result!=base,axis=2);yy,xx=np.where(delta)
        reports.append({'file':name,'changes':int(delta.sum()),'bbox':[int(xx.min()),int(yy.min()),int(xx.max()),int(yy.max())] if len(xx) else None,'outside_region_changed':0,'alpha_identical':True})
    oldbase=original('shrugging','shrugging')
    donor=read(WORK/'donors'/'shrugging-base.png')
    newbase,mask=blend(oldbase,donor,BROWS+[BOXES['shrugging']])
    save('shrugging','shrugging',newbase,oldbase,mask)
    # Reuse approved eye/mouth art on the new base. Copy the entire small region
    # so none of the new resting smile remains outside the replacement mouth.
    for kind in ['blink','talk','talk-a','talk-e','talk-o','talk-m','talk-s']:
        name='shrugging-'+kind
        old=original('shrugging',name)
        result=newbase.copy();allowed=np.zeros(old.shape[:2],np.uint8)
        boxes=EYES if kind=='blink' else [BOXES['shrugging']]
        for x0,y0,x1,y1 in boxes:
            # Only pixels changed by the original blink belong to the eyelids;
            # this preserves new brow pixels even where the rectangles touch.
            if kind=='blink':
                local=np.any(old[y0:y1+1,x0:x1+1]!=oldbase[y0:y1+1,x0:x1+1],axis=2)
                for bx0,by0,bx1,by1 in BROWS:
                    ix0,iy0,ix1,iy1=max(x0,bx0),max(y0,by0),min(x1,bx1),min(y1,by1)
                    if ix0<=ix1 and iy0<=iy1:local[iy0-y0:iy1-y0+1,ix0-x0:ix1-x0+1]=False
                result[y0:y1+1,x0:x1+1][local]=old[y0:y1+1,x0:x1+1][local]
                allowed[y0:y1+1,x0:x1+1][local]=255
            else:
                result[y0:y1+1,x0:x1+1,:3]=old[y0:y1+1,x0:x1+1,:3]
                allowed[y0:y1+1,x0:x1+1]=255
        if kind=='talk-a' and (WORK/'donors'/'shrugging-talk-a.png').exists():
            result,allowed=blend(newbase,read(WORK/'donors'/'shrugging-talk-a.png'),[BOXES['shrugging']])
        save('shrugging',name,result,newbase,allowed)
    for pose,box in BOXES.items():
        if pose=='shrugging':continue
        path=WORK/'donors'/(pose+'-talk-a.png')
        if not path.exists():continue
        old=original(pose,pose+'-talk-a')
        result,allowed=blend(old,read(path),[box])
        save(pose,pose+'-talk-a',result,old,allowed)
    (WORK/'validation.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
    sheet=Image.new('RGB',(1200,720),'white');draw=ImageDraw.Draw(sheet)
    for row,pose in enumerate(BOXES):
        for col,im in enumerate([original(pose,pose+'-talk-a'),read(ART/pose/(pose+'-talk-a.png'))]):
            tile=Image.fromarray(im).crop((300,180,710,490)).resize((300,216))
            sheet.paste(tile.convert('RGB'),(col*300,row*144))
    # Separate focused shrug comparison and mouth comparison avoid tiny images.
    overview=Image.new('RGB',(1200,550),'white');d=ImageDraw.Draw(overview)
    for col,im in enumerate([oldbase,newbase,read(ART/'shrugging'/'shrugging-blink.png')]):
        overview.paste(Image.fromarray(im).crop((300,185,720,500)).resize((400,300)).convert('RGB'),(col*400,20))
        d.text((col*400+5,5),['Original shrug','Cheerful shrug','Updated blink'][col],fill='black')
    for col,pose in enumerate(BOXES):
        box=BOXES[pose];x0,y0,x1,y1=box
        for row,im in enumerate([original(pose,pose+'-talk-a'),read(ART/pose/(pose+'-talk-a.png'))]):
            crop=Image.fromarray(im).crop((x0-8,y0-8,x1+8,y1+8)).resize((220,95)).convert('RGB')
            overview.paste(crop,(col*240,345+row*105))
        d.text((col*240+4,327),pose+' before / after',fill='black')
    overview.save(WORK/'review.jpg',quality=97)
    print(f'Applied {len(reports)} edits; alpha and pixels outside masks verified.')

if __name__=='__main__':main()
