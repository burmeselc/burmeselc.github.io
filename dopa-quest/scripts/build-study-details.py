"""Validate and build exact, explicitly reviewed definitions; never classify by POS.
Run from any working directory. The review recipe is separate from runtime metadata.
"""
import json
from collections import Counter
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def read(name):
    return json.loads((ROOT/'data'/name).read_text())

def build():
    recipe=read('study-details-review-v2.json')
    assert recipe['schema']=='dopa-study-details-review-v2'
    paths={'burmese':['burmese.json'],'shan':['shan-1.json','shan-2.json']}
    decks={l:{x['id']:x for p in ps for x in read(p)}for l,ps in paths.items()}
    taxonomy=read('study-taxonomy-v1.json')
    mediums={c['id']:major['id']for major in taxonomy['categories']for c in major['children']}
    axes={a['axis']:set(a['values'])for a in taxonomy['tag_axes']}
    out={'schema':'dopa-study-details-pilot-v1','review_basis':recipe['review_basis'],
         'original_dictionary_verified':False,'new_cards_created':0,'cards':recipe['cards'],'choice_conflicts':recipe['choice_conflicts']}
    for l,cards in out['cards'].items():
        sem=read(f'{l}-categories-v1.json')['cards']
        for ident,a in cards.items():
            x=decks[l][ident]
            assert x[l]==a['word'] and x['japanese_core']==a['gloss']==a['evidence'],ident
            assert a['review_status']=='gloss-reviewed-pilot',ident
            assert a['medium'] in mediums,ident
            assert sem[ident][0]==mediums[a['medium']] and sem[ident][1]in ['P','R'],ident
            assert set(a['tags'])==set(axes),ident
            for axis,values in a['tags'].items():
                assert len(set(values))==len(values) and set(values)<=axes[axis],(ident,axis)
    for l,groups in out['choice_conflicts'].items():
        for group in groups:
            assert len(set(group['ids']))>=2 and all(id in out['cards'][l]for id in group['ids'])
    out['counts']={l:len(c)for l,c in out['cards'].items()}
    out['medium_counts']={l:dict(sorted(Counter(a['medium']for a in cards.values()).items()))for l,cards in out['cards'].items()}
    (ROOT/'data'/'study-details-pilot-v1.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    print(out['counts'])

if __name__=='__main__':build()
