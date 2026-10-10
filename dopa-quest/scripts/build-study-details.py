"""Build the opt-in pilot from explicit reviews of existing Japanese glosses.
No new words, sense splitting, automatic POS inference, or ID migration.
"""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
# Each group is manually assigned. Exact glosses pin the reviewed definition.
GROUPS = [
('burmese','03.01','entity','body_part','', '''
1395616248119|目
1396908547070|頭
1397415649189|胃
1397415681206|腹、お腹
1398608742293|血
1398608999048|脳
1398609815254|髪、髪の毛
1400452862515|鼻
1400452919041|顔
1402176025351|口
1403372480576|身体
1403373144636|指
1403373556717|心臓
1403373596701|肺
'''),
('burmese','03.03','state','','medicine', '''
1389398610694|元気である
1396907529904|痩せている
1397417359744|痛む
1403373708628|熱、発熱
'''),
('burmese','03.04','entity','','medicine', '''
1398088928976|病院
1398091133648|絆創膏、プラスター
1400453293696|薬局
1403373727976|医師、医者
'''),
('burmese','06.01','entity','consumable','', '''
1394193038053|ハンバーガー
1394193093202|ホットドッグ
1394494161518|サンドイッチ
1394664211986|プリン
1395253090045|炊いた米、ご飯
1395253386859|ひき肉
1395254757378|アイスクリーム
1395254818450|ケーキ
'''),
('burmese','06.02','entity','consumable','', '''
1394276976301|コーヒー
1394277049037|ココア
1394664073664|ビール
1395253830568|オレンジジュース
1395254126617|牛乳、ミルク
1395254243998|ミャンマー式ミルクティー
'''),
('burmese','06.04','event','','', '''
1394192863785|食べる
1394192894184|飲む
'''),
('burmese','06.05','property','','', '''
1388199181751|辛い、香辛料がきいている
1399933295948|おいしい、味がよい
'''),
('burmese','11.03','entity','','', '''
1395616100472|道、道路、通り
1395616128150|列車、鉄道
1398609052019|空港
1398610270860|タクシー
1398610313196|バス
1398610363905|バスターミナル、バス停留所
1398610429196|鉄道駅
1398610540015|自転車
1398610603305|オートバイ、バイク
'''),
('burmese','11.01','entity','tool','', '''
1397343049586|カメラ
1409415204695|機械、器具、ガジェット
1418253483988|斧
'''),
('burmese','11.04','entity','tool','computing', '''
1396906563197|コンピューター
'''),
('burmese','11.02','entity','material','', '''
1403370920724|鉄（金属）
1409401883813|木材
1423653221467|金属
1423655623672|接着剤、のり
'''),
('shan','03.01','entity','body_part','', '''
1783945284526|腹、腹部、腸
1783945284749|首；喉
1783945284848|脳
1783945285014|口、唇
1783945285323|指（手）
1783945285544|頭
'''),
('shan','03.03','state','','medicine', '''
1783945284389|病気、疾患
1783945285250|頭痛がする
1783945285257|太っている、ふくよかである、肥満している
1783945285563|負傷する
1783945285581|尿が出にくい、結石がある
'''),
('shan','03.04','entity','','medicine', '''
1783945284318|病院、診療所、クリニック
1783945284859|医師、医者
'''),
('shan','03.02','event','','', '''
1783945285385|咳をする
1783945285519|むせる、息が詰まる（不快な臭いや刺激臭、強すぎる芳香などで）
1783945285616|あくびをする
'''),
('shan','06.01','entity','consumable','', '''
1783945284901|食べ物
1783945285602|精米
1783945286214|お菓子、パン、ケーキ、クッキー
1783945286239|スープ、だし汁、肉汁
1783945286316|ラード、豚の脂
1783945286373|食べ物、食べられるもの
1783945286388|ご飯とおかず、定食
1783945286609|麺、カオソーイ
'''),
('shan','06.02','entity','consumable','', '''
1783945285322|飲み水、飲料水
'''),
('shan','06.04','event','','', '''
1783945284305|[口語] 食べる
1783945285820|噛む
1783945286584|酒を飲む
'''),
('shan','06.04','entity','','', '''
1783945285138|朝食
1783945286131|食事
'''),
('shan','06.05','property','','', '''
1783945285700|酸っぱい
'''),
('shan','11.03','entity','','', '''
1783945284106|車、自動車
1783945284199|道、道路、ルート
1783945284532|オートバイ、バイク
1783945284818|道路、道
1783945285037|荷車、車輪付きの乗り物
1783945285460|大通り、幹線道路、ハイウェイ
1783945285721|飛行機
'''),
('shan','11.01','entity','tool','', '''
1783945284830|刃物、ナイフ
1783945285596|織機、機（はた）
'''),
('shan','11.02','entity','material','', '''
1783945284383|鉄くず、鍛冶屋の金屑
1783945284892|鉄
1783945285932|煉瓦
'''),
('shan','11.02','event','','craft', '''
1783945285081|ナイフで滑らかにする
1783945285274|ナイフで滑らかにする（削る）
1783945285434|道路を作る、修理する
'''),
]

def build():
    paths = {'burmese':['burmese.json'], 'shan':['shan-1.json','shan-2.json']}
    decks = {l:{x['id']:x for p in ps for x in json.loads((ROOT/'data'/p).read_text())} for l,ps in paths.items()}
    out = {'schema':'dopa-study-details-pilot-v1','review_basis':'existing-japanese-gloss-only',
           'original_dictionary_verified':False,'new_cards_created':0,'cards':{'burmese':{},'shan':{}}}
    for lang,medium,kind,feature,field,rows in GROUPS:
        prefix = 'bur:' if lang=='burmese' else 'shn:'
        sem = json.loads((ROOT/'data'/f'{lang}-categories-v1.json').read_text())['cards']
        for row in rows.strip().splitlines():
            ident,gloss = row.split('|',1); ident=prefix+ident; x=decks[lang][ident]
            assert x['japanese_core']==gloss,(ident,x['japanese_core'],gloss)
            # Cross-domain/missing entries stay withheld; no legacy category changes.
            assert sem[ident][0]==medium[:2] and sem[ident][1] in ['P','R'],ident
            assert ident not in out['cards'][lang]
            out['cards'][lang][ident] = {'word':x[lang],'gloss':gloss,'medium':medium,
                'tags':{'semantic_type':[kind],'feature':[feature] if feature else [],
                        'field':[field] if field else [],'usage':['colloquial'] if '[口語]' in gloss else []},
                'review_status':'gloss-reviewed-pilot','evidence':gloss}
    (ROOT/'data'/'study-details-pilot-v1.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    print({l:len(c) for l,c in out['cards'].items()})

if __name__=='__main__':build()
