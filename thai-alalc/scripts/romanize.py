"""Conservative Thai-to-ALA-LC 2011 guesses, NOT certified cataloging forms.
Reference: https://www.loc.gov/catdir/cpso/romanization/thai.pdf
"""
from __future__ import annotations
import unicodedata
from typing import Optional

INITIAL = {
'ก':'k','ข':'kh','ฃ':'kh','ค':'kh','ฅ':'kh','ฆ':'kh','ง':'ng',
'จ':'čh','ฉ':'ch','ช':'ch','ฌ':'ch','ญ':'y','ฎ':'d','ฏ':'t',
'ฐ':'th','ฑ':'th','ฒ':'th','ณ':'n','ด':'d','ต':'t','ถ':'th',
'ท':'th','ธ':'th','น':'n','บ':'b','ป':'p','ผ':'ph','ฝ':'f',
'พ':'ph','ฟ':'f','ภ':'ph','ม':'m','ย':'y','ร':'r','ล':'l',
'ว':'w','ศ':'s','ษ':'s','ส':'s','ห':'h','ฬ':'l','อ':'‘',
'ฮ':'h','ซ':'s'}
FINAL = {
**{c:'k' for c in 'กขฃคฅฆ'}, **{c:'ng' for c in 'ง'},
**{c:'t' for c in 'จฉชฌฎฏฐฑฒดตถทธศษสซ'},
**{c:'n' for c in 'ญณนรลฬ'}, **{c:'p' for c in 'บปผฝพฟภ'},
'ม':'m','ย':'i','ว':'o'}
CLUSTERS = {'กร','กล','กว','ขร','ขล','ขว','คร','คล','คว','ตร',
'ปร','ปล','พร','พล','ผล','บร','บล','ดร','ฟร','ฟล','สร'}
TONE = '\u0e48\u0e49\u0e4a\u0e4b'
VOWEL_MARKS = 'ะาำัิีึืุูเแโใไ็'

def normalize_thai(value:str)->str:
    return unicodedata.normalize('NFC',value.strip().replace('\u200b',''))

def guess_word(word:str)->Optional[str]:
    """A tentative spelling-based candidate for a simple syllable.
    Unsupported multisyllabic words and silent-consonant spellings return None.
    """
    s=normalize_thai(word)
    if not s or '์' in s or 'รร' in s or any(c.isspace() for c in s):return None
    s=s.translate(str.maketrans('','',TONE))
    if any(c not in INITIAL and c not in VOWEL_MARKS for c in s):return None
    pre=s[0] if s[0] in 'เแโใไ' else ''
    if pre:s=s[1:]
    if not s or s[0] not in INITIAL:return None
    onset,s=s[0],s[1:]
    if s and s[0] in INITIAL and onset+s[0] in CLUSTERS:
        onset,s=onset+s[0],s[1:]
    ini=''.join(INITIAL[c] for c in onset)
    if onset=='ห' and s and s[0] in 'งญนมยรลว':
        ini,s=INITIAL[s[0]],s[1:]
    if pre=='เ' and s.startswith('ีย'):vowel,s='īa',s[2:]
    elif pre=='เ' and s.startswith('ือ'):vowel,s='ư̄a',s[2:]
    elif pre=='เ' and s.startswith('า'):vowel,s='ao',s[1:]
    elif pre=='เ' and s.startswith(('ะ','็')):vowel,s='e',s[1:]
    elif pre=='เ':vowel='ē'
    elif pre=='แ' and s.startswith(('ะ','็')):vowel,s='æ',s[1:]
    elif pre=='แ':vowel='ǣ'
    elif pre=='โ' and s.startswith('ะ'):vowel,s='o',s[1:]
    elif pre=='โ':vowel='ō'
    elif pre in ('ไ','ใ'):vowel='ai'
    elif s.startswith('ัวะ'):vowel,s='ua',s[3:]
    elif s.startswith('ัว'):vowel,s='ūa',s[2:]
    elif s.startswith('า'):vowel,s='ā',s[1:]
    elif s.startswith('ำ'):vowel,s='am',s[1:]
    elif s.startswith('ี'):vowel,s='ī',s[1:]
    elif s.startswith('ิ'):vowel,s='i',s[1:]
    elif s.startswith('ื'):vowel,s='ư̄',s[1:]
    elif s.startswith('ึ'):vowel,s='ư',s[1:]
    elif s.startswith('ู'):vowel,s='ū',s[1:]
    elif s.startswith('ุ'):vowel,s='u',s[1:]
    elif s.startswith('ะ'):vowel,s='a',s[1:]
    elif s.startswith('ั'):vowel,s='a',s[1:]
    elif s.startswith('็'):return None
    elif len(s)==1 and s in FINAL and s not in ('ย','ว'):vowel='o'
    else:return None
    if not s:return ini+vowel
    if len(s)!=1 or s not in FINAL or s in ('ย','ว'):return None
    return ini+vowel+FINAL[s]
