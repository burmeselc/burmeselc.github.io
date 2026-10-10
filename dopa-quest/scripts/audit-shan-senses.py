"""Read-only audit of the existing sense inventory. No repairs or new IDs.
Japanese POS labels in the preserved parent fields are evidence of the old
annotation, not proof of linguistic POS or of the unavailable generator's code.
"""
import json,re,unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def read(p):return json.loads((ROOT/'data'/p).read_text())
def key(text):return re.sub(r'[\s　；;、，,。．]+','',unicodedata.normalize('NFKC',text)).strip()
def family(label):
    if label.startswith(('動詞','他動詞','自動詞'))or label=='verb':return 'verb'
    if label.startswith('名詞')or label=='noun':return 'noun'
    if label.startswith('形容詞')or label=='adjective':return 'adjective'
    if label.startswith('副詞')or label=='adverb':return 'adverb'
    return label

def audit():
    parents={x['id']:x for p in ['shan-1.json','shan-2.json']for x in read(p)}
    cards=[x for i in range(1,9)for x in read(f'shan-senses-{i}.json')]
    empty=[];pos_review=[];embedded=[]
    for x in cards:
        p=parents[x['parent_id']]
        evidence=p['japanese_core']+' ['+p.get('english','')
        base={'card_id':x['id'],'parent_id':p['id'],'word':x['shan'],'gloss':x['japanese_core'],'current_pos':x['game_pos'],'playable':x['game_include']==1}
        if not x['japanese_core'].strip():
            empty.append({**base,'parent_japanese':p['japanese_core'],'parent_english':p.get('english',''),'decision':'keep-withheld','reason':'empty_child_gloss','original_dictionary_verified':False})
        if '【'in x['japanese_core']:
            embedded.append({**base,'reason':'pos_marker_remains_inside_child_gloss','decision':'review-boundary'})
        # Require an exact entire Japanese scope, not a substring/keyword/POS guess.
        candidates=[]
        for m in re.finditer(r'【([^】]+)】([^【]*)',evidence):
            label=m[1].strip()
            if not re.search(r'[ぁ-んァ-ヶ一-龯]',label):continue
            body=re.split(r'[\[①②③④⑤⑥⑦⑧⑨⑩]',m[2],maxsplit=1)[0].strip(' ；;、，,。．')
            if body and key(body)==key(x['japanese_core']):candidates.append((label,m[0]))
        labels={label for label,context in candidates}
        if len(labels)==1:
            source_pos=next(iter(labels))
            if family(source_pos)!=family(x['game_pos']):
                pos_review.append({**base,'preserved_source_pos':source_pos,'context':candidates[0][1],
                    'evidence_field':'parent.japanese_core + parent.english','decision':'review-before-metadata-repair',
                    'linguistic_pos_confirmed':False,'generator_cause_confirmed':False})
    result={'schema':'dopa-shan-sense-audit-v1','read_only':True,'new_ids':0,'changed_records':0,
            'generator_source_available_in_repo':False,
            'counts':{'empty_child_gloss':len(empty),'exact_source_pos_family_disagreements':len(pos_review),'embedded_pos_markers':len(embedded)},
            'empty_glosses':empty,'source_pos_disagreements':pos_review,'embedded_pos_markers':embedded}
    (ROOT/'data'/'shan-sense-audit-v1.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(result['counts'])

if __name__=='__main__':audit()
