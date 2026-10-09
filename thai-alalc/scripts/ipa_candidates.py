"""Generate *tentative* ALA-LC candidates from SEAlang phonetic transcriptions.

Not a certified ALA-LC transcription: Thai word division, irregular names,
homophones, and pronunciation alternatives still require human verification.
Source standard: https://www.loc.gov/catdir/cpso/romanization/thai.pdf
"""
import unicodedata

VOWELS={
 'ʉʉ':'ư̄','ɯɯ':'ư̄','ɛɛ':'ǣ','ɔɔ':'ǭ','əə':'œ̄',
 'aa':'ā','ii':'ī','uu':'ū','ee':'ē','oo':'ō',
 'ʉ':'ư','ɯ':'ư','ɛ':'æ','ɔ':'ǫ','ə':'œ',
 'a':'a','i':'i','u':'u','e':'e','o':'o',
}
CONSONANTS={
 'kʰ':'kh','pʰ':'ph','tʰ':'th','cʰ':'ch','tɕʰ':'ch','tɕ':'čh',
 'ŋ':'ng','ɲ':'y','k':'k','p':'p','t':'t','c':'čh',
 'b':'b','d':'d','f':'f','s':'s','h':'h','m':'m','n':'n',
 'l':'l','r':'r','w':'w','j':'y','y':'y','v':'w','g':'k',
}
TOKENS=sorted({**VOWELS,**CONSONANTS},key=len,reverse=True)

def candidate_from_ipa(value):
    if not value or any(x in value for x in ('~','/','(',')','------')):
        return None
    # Drop tone/stress marks but retain phonemic segmental symbols.
    raw=unicodedata.normalize('NFD',value)
    raw=''.join(c for c in raw if unicodedata.category(c)!='Mn')
    raw=raw.replace('ˈ','').replace('ˌ','').replace('⁐','').replace('ː','')
    raw=raw.replace('-','').replace('.','')
    out=''
    i=0
    while i<len(raw):
        c=raw[i]
        if c.isspace():
            out+=' ';i+=1;continue
        if c=='ʔ':
            # Glottal onset often corresponds to Thai อ; not reliable from IPA alone.
            if i==0 or raw[i-1].isspace():out+='‘'
            i+=1;continue
        match=next((x for x in TOKENS if raw.startswith(x,i)),None)
        if match is None:return None
        out+=(VOWELS.get(match) or CONSONANTS[match])
        i+=len(match)
    return ' '.join(out.split()) if out else None
