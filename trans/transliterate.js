// ALA-LC対応 マッピング辞書

const consonants = {
    'က': 'k', 'ခ': 'kh', 'ဂ': 'g', 'ဃ': 'gh', 'င': 'ṅ',
    'စ': 'c', 'ဆ': 'ch', 'ဇ': 'j', 'ဈ': 'jh', 'ည': 'ññ', 'ဉ': 'ñ',
    'ဋ': 'ṭ', 'ဌ': 'ṭh', 'ဍ': 'ḍ', 'ဎ': 'ḍh', 'ဏ': 'ṇ',
    'တ': 't', 'ထ': 'th', 'ဒ': 'd', 'ဓ': 'dh', 'န': 'n',
    'ပ': 'p', 'ဖ': 'ph', 'ဗ': 'b', 'ဘ': 'bh', 'မ': 'm',
    'ယ': 'y', 'ရ': 'r', 'လ': 'l', 'ဝ': 'v', 'သ': 's',
    'ဟ': 'h', 'ဠ': 'ḷ', 'အ': 'ʾ' 
};

// 介子音 (Medials)
const medials = {
    'ျ': 'y', 'ြ': 'r', 'ွ': 'v', 'ှ': 'h'
};

// 母音記号
const vowels = {
    'ို': 'ui', 'ေါ': 'o', 'ော': 'o',
    'ာ': 'ā', 'ါ': 'ā', 'ိ': 'i', 'ီ': 'ī', 
    'ု': 'u', 'ူ': 'ū', 'ေ': 'e', 'ဲ': 'ai'
};

// 声調・特殊記号
const marks = {
    '့': 'ʹ', // auk-myit (下降調)
    'း': 'ʺ', // visarga
    'ံ': 'ṃ', // anusvara
    '်': 'ʿ', // asat (明示的に出力)
    '္': ''   // virama (重ね字マーカー。出力しない)
};

// 独立語・略語群
const abbreviations = {
    '၍': 'r*',
    '၌': 'n*',
    '၎': 'l*'
};

function replaceFromDict(str, dict) {
    const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
    let result = str;
    for (const key of keys) {
        if (result.includes(key)) {
            result = result.split(key).join(dict[key]);
        }
    }
    return result;
}

function transliterate(text) {
    let roman = text;

    roman = replaceFromDict(roman, abbreviations);

    const syllableRegex = /([က-အဉည])([ျြွှ]*)([ါာိီုူေဲ]*)([ံ့း်္]*)/g;

    roman = roman.replace(syllableRegex, (match, base, medialStr, vowelStr, markStr) => {
        let out = '';

        out += consonants[base] || base;

        if (medialStr) {
            out += replaceFromDict(medialStr, medials);
        }

        let romanVowel = '';
        if (vowelStr) {
            romanVowel = replaceFromDict(vowelStr, vowels);
            out += romanVowel;
        }

        // 特殊ルール: Virama (္) がある場合、Kinzi などの Asat (်) は記号として出力しない
        let processedMarkStr = markStr;
        if (processedMarkStr.includes('္')) {
            processedMarkStr = processedMarkStr.replace('်', '');
        }

        let romanMark = '';
        if (processedMarkStr) {
            romanMark = replaceFromDict(processedMarkStr, marks);
            out += romanMark;
        }

        // 『a』を載せるかの判定
        const hasAsat = markStr.includes('်');
        const hasVirama = markStr.includes('္'); 
        const hasExplicitVowel = romanVowel.length > 0;
        
        if (!hasAsat && !hasVirama && !hasExplicitVowel) {
            out += 'a'; 
        }

        // 音節ごとにスペースを追加（ただし、重ね字の上段子音にはスペースを入れない）
        if (!hasVirama) {
            out += ' ';
        }

        return out;
    });

    // 句読点（၊ や ။）の直前にある不要なスペースを取り除く
    roman = roman.replace(/\s+([၊။])/g, '$1');
    // 全体の連続するスペースを一つに整える
    roman = roman.replace(/\s+/g, ' ').trim();

    return roman;
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('transliterate-btn');
    const input = document.getElementById('burmese-input');
    const output = document.getElementById('roman-output');

    if (btn && input && output) {
        btn.addEventListener('click', () => {
            const result = transliterate(input.value);
            output.value = result;
        });
    }
});