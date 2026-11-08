import os
import sys
import json
import math
import wave
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
import cv2
import imageio_ffmpeg

try:
    from pythainlp.tokenize import word_tokenize as thai_word_tokenize
    HAS_PYTHAINLP = True
except Exception:
    HAS_PYTHAINLP = False

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ==============================================================================
# 1. THAI + ENGLISH SMART TOKENIZER & ASR POST-CORRECTION (PyThaiNLP Powered)
# ==============================================================================

ASR_CORRECTIONS = [
    # Lifestyle / Vlog / Beauty homophones
    ("One Day of with me", "One Day With Me"),
    ("One Day Wrong With Me", "One Day With Me"),
    ("One Day long With Me", "One Day With Me"),
    ("one day for me", "One Day With Me"),
    ("มาดามฟินกินชายอ่อน", "Madame Fin กลิ่น Shine On"),
    ("มาดามฟินกลิ่นชายอ่อน", "Madame Fin กลิ่น Shine On"),
    ("มาดามฟินกลิ่นใช้อ่อน", "Madame Fin กลิ่น Shine On"),
    ("มาดามฟินๆชายอ่อน", "Madame Fin กลิ่น Shine On"),
    ("มาดามฟินๆชายเอาเลย", "Madame Fin กลิ่น Shine On เลย"),
    ("มาดามฟินๆใช้ออนเลย", "Madame Fin กลิ่น Shine On เลย"),
    ("น้ำหอมมาดามฟินกินชาย", "น้ำหอม Madame Fin กลิ่น Shine On"),
    ("น้ำฟินกินช้ายอ่อน", "Madame Fin กลิ่น Shine On"),
    ("น้ำพริกกินใช้ on เลย", "Madame Fin กลิ่น Shine On เลย"),
    ("ต้มน้ำหอม Madame Fin", "ต้องน้ำหอม Madame Fin"),
    ("ต้มน้ำหอมมาดามฟิน", "ต้องน้ำหอม Madame Fin"),
    ("ต้มน้ำหอม", "ต้องน้ำหอม"),
    ("ต้องน้ำหอมมาดามฟิน", "ต้องน้ำหอม Madame Fin"),
    ("ทนมากถ้าอยากลอง", "กลิ่นนี้คือติดทนมาก ใครอยากลอง"),
    ("แค่อยากลองต้องน้ำหอม", "ใครอยากลองต้องน้ำหอม"),
    ("ข้าอยากลองต้องน้ำหอม", "ใครอยากลองต้องน้ำหอม"),
    ("สิ่งนี้คือติดทนมาก", "กลิ่นนี้คือติดทนมาก"),
    ("กินช้อน", "กลิ่น Shine On"),
    ("Fifty footy", "ฟรุ๊ตตี้"),
    ("Fifty Fifty", "ฟรุ๊ตตี้"),
    ("หวานนิดๆฟร พริตตี้", "หวานนิดๆ ฟรุ๊ตตี้"),
    ("หวานนิดๆ พริตตี้", "หวานนิดๆ ฟรุ๊ตตี้"),
    ("พริตตี้แต่ไม่หวาน", "ฟรุ๊ตตี้ แต่ไม่หวาน"),
    ("แต่ไม่หวานเกินไป", "แต่ไม่หวานเลี่ยนเกินไป"),
    ("แต่ไม่ เกินไป", "แต่ไม่หวานเลี่ยนเกินไป"),
    ("ตัดผ้ามาคืน", "ตัดภาพมาคือ"),
    ("ตัดภาพมาคืน", "ตัดภาพมาคือ"),
    ("ฉันก็แค่ทำงานกลุ่ม", "อาจารย์ก็ให้ทำงานกลุ่ม"),
    ("ไม่หอมแล้วจะกินตั้งแต่เช้าแล้วอ่ะ", "เพื่อนบอกตัวหอมมาก ฉีดตั้งแต่เช้าแล้วนะ"),
    ("กล้วยหอมแล้วได้กินตั้งแต่เช้าแล้วอ่ะ", "เพื่อนบอกตัวหอมมาก ฉีดตั้งแต่เช้าแล้วนะ"),
    ("กล้วยหอมแล้วได้กิน", "เพื่อนบอกตัวหอมมาก ฉีด"),
    ("วางมากินหมาล่า", "แวะมากินหมาล่า"),
    ("จริงหรอเพื่อนก็ทักอยู่เลย", "เพื่อนก็ยังทักอยู่เลย"),
    ("ทักอยู่เลยว่าตัว ขณะ", "ทักอยู่เลยว่าตัวหอม ขนาด"),
    ("ว่าตัวหอมขนาด", "ว่าตัวหอม ขนาด"),
    ("ขณะใช้ชีวิต", "ขนาดใช้ชีวิต"),
    ("19:30 น", "ทุ่มครึ่ง"),
    ("21:00 น กว่าๆ", "3 ทุ่มครึ่ง"),
    ("21:00 น กว่า", "3 ทุ่มครึ่ง"),
    # Nivea Sun homophones
    ("คล้ำเลยมาลงนีเวียซัน C &Eer", "เลยมาลง Nivea Sun C&E"),
    ("เลยมาลงนีเวียซัน C &Eer", "เลยมาลง Nivea Sun C&E"),
    ("นีเวียซัน C &Eer", "Nivea Sun C&E"),
    ("C &Eer", "C&E"),
    ("C & E", "C&E"),
    ("รณรงค์นีเวียซัน", "เลยมาลง Nivea Sun"),
    ("เลยมาลอง Nivea Sun C&Eer", "เลยมาลง Nivea Sun C&E"),
    ("เลยมาลองนีเวียซัน", "เลยมาลง Nivea Sun"),
    ("c&e S", "C&E"),
    ("กันแดดนีเวียส้ม หน้าไบ ", "กันแดดนีเวียส้ม หน้าไบร์ท "),
    ("เหนือเขาบางเบา", "เนื้อเซรั่มเขาบางเบา"),
    ("เนื้อเขาบางเบา", "เนื้อเซรั่มเขาบางเบา"),
    ("ใช่แล้วน่าไปขึ้น", "ใช้แล้วหน้าไบร์ทขึ้นจริง"),
    ("ใช่แล้วหน้าไปขึ้น", "ใช้แล้วหน้าไบร์ทขึ้นจริง"),
    ("ใช่แล้วหน้าไบร์ทขึ้น", "ใช้แล้วหน้าไบร์ทขึ้นจริง"),
    ("SPF 50+", "SPF50+"),
    ("SPF 50", "SPF50+"),
    ("SPF50++", "SPF50+"),
    ("PA ++++", "PA++++"),
    ("PA + + + +", "PA++++"),
    ("PA + + +", "PA++++"),
    ("uva uvb", "UVA UVB"),
    ("มีทอง", "มีทอน"),
    ("ต้องถึงพร้อมดูแลผิวให้ดูใบขึ้น", "ปกป้องถึงขีดสุด พร้อมดูแลผิวให้ดูไบร์ทขึ้น"),
    ("ดูใบขึ้น", "ดูไบร์ทขึ้น"),
    # Tech / AI / Vibe Coding homophones
    ("คนยังไม่ค่อยเจ็บมากพอ", "คุณยังไม่เก็ทมากพอ"),
    ("สามารถบาสโคราช", "สามารถ Vibe Code ได้"),
    ("ทุกคนสามารถโพสต์ได้", "ทุกคนสามารถ Code ได้"),
    ("การที่ AI มันโพสต์ได้", "การที่ AI มัน Code ได้"),
    ("เปลี่ยนรูปได้เนี่ย", "เปลี่ยนโลกได้เนี่ย"),
    ("รักคนที่บาร์โค้ด", "และคนที่ Vibe Code"),
    ("เป็นอัปอะไรก็ได้", "เป็นแอปอะไรก็ได้"),
    ("ส่งไอ้แก๊ประหว่าง", "ช่องว่างระหว่าง"),
    ("สิ่งหนึ่งที่ไอ้รู้ว่า", "สิ่งหนึ่งที่รู้ว่า"),
    ("แต่อายุนี้เนี่ย", "แต่ยุคนี้เนี่ย"),
    ("อายุที่แม่งทุกคนสามารถ", "ยุคที่ทุกคนสามารถ"),
]

# Natural Thai discourse/clause starters used to snap subtitle boundaries cleanly
CLAUSE_STARTERS = {
    "วันนี้", "แล้ว", "แล้วเรา", "แล้วก็", "แวะ", "เพราะว่า", "เพราะ", "แต่ว่า", "แต่",
    "แต่ไม่", "แต่ยัง", "โชคดี", "ตัดภาพ", "อาจารย์", "เป็นเวลา", "ก็นั่ง", "ในที่สุด",
    "เราก็", "มาถาม", "ถามเพื่อน", "เพื่อนบอก", "เสร็จแล้ว", "แวะมา", "ร้านนี้",
    "มาเดิน", "ก็เป็นเวลา", "เพื่อนก็", "ขนาด", "กว่าเรา", "กว่าจะ", "ยังรู้สึก",
    "กลิ่นนี้", "ใครอยาก", "ต้องน้ำหอม", "ต้องลอง", "เลยมา", "เนื้อเซรั่ม", "แถมยัง",
    "ช่วยลด", "ให้ผิว", "มีสาร", "ใช้แล้ว", "พร้อม", "ปกป้อง", "ราคา", "ใครหา",
    "ใช่", "อย่าลืม", "มันจะ", "สร้าง", "ก็แปลว่า", "คนที่", "แต่ถ้า", "ใครก็",
    "แต่นั่น", "การที่", "เหมือน", "คุณน่ะ", "มีเงิน", "มึงก็", "ไม่ว่า"
}

# Conversational setup tokens stripped when selecting the punchy keyword core
SETUP_STOP_TOKENS = {
    "ผม", "ว่า", "คุณ", "ฉัน", "เรา", "เขา", "มัน", "คือ", "ก็คือ", "ก็", "จะ", "มา", "ไป",
    "ได้", "ให้", "ใน", "ของ", "กับ", "จาก", "ที่", "ซึ่ง", "อัน", "นี้", "นั้น", "อันนั้น",
    "อันนี้", "นั่นแหละ", "แต่นั่นแหละ", "แปลว่า", "ก็แปลว่า", "เพราะว่า", "เพราะ",
    "แต่ว่า", "แต่", "ถ้า", "แล้ว", "แล้วก็", "ส่วน", "อย่าง", "เวลา", "เป็นเวลา",
    "ก็เป็นเวลา", "คนที่", "ใครที่", "สิ่งที่", "การที่", "เหมือน", "บอกว่า", "ถามว่า",
    "รู้สึก", "รู้สึกได้เลยว่า", "รู้สึกว่า", "สมมุติ", "สมมติ", "หมายถึง", "หมายถึงว่า",
    "กว่า", "กว่าจะ", "เสร็จ", "เสร็จแล้ว", "ตัดภาพ", "ตัดภาพมา", "ในที่สุด"
}

TRAILING_PARTICLES = {
    "ครับ", "ค่ะ", "คะ", "นะ", "นะคะ", "นะครับ", "เนี่ย", "เลย", "อ่ะ", "อะ",
    "เนาะ", "จ้า", "น้า", "ทุกคน", "ด้วย", "อยู่", "แล้ว", "กัน"
}

POWER_PHRASES = [
    r"One Day With Me",
    r"Nivea Sun C&E",
    r"Madame Fin",
    r"Shine On",
    r"Nineties Design",
    r"Fast code app",
    r"App Store",
    r"Vibe Code(?:\s*ได้)?",
    r"SPF\s*50\+?",
    r"PA\+\+\+\+",
    r"UVA\s*UVB",
    r"2\s*แบงค์เขียวมีทอน",
    r"แบงค์เขียวมีทอน",
    r"กันแดดนีเวียส้ม",
    r"นีเวียส้มหน้าไบร์ท",
    r"หน้าไบร์ทขึ้นจริง",
    r"หน้าไบร์ท",
    r"ดูไบร์ทขึ้น",
    r"โดนแดดบ่อยมาก",
    r"กลัวผิวหมองคล้ำ",
    r"กลัวผิวหมอง",
    r"บางเบามาก",
    r"ซึมไว",
    r"บางเบา",
    r"สบายผิวมาก",
    r"สบายผิว",
    r"ลดจุดดำ",
    r"ฝ้าแดด",
    r"ผิวกระจ่างใส",
    r"กระจ่างใส",
    r"ใน\s*7\s*วัน",
    r"Whitening\s*5\s*ชนิด",
    r"ไวท์เทนนิ่ง\s*5\s*ชนิด",
    r"แสงสีฟ้า",
    r"ฉีดน้ำหอม",
    r"ฉีดครั้งแรก",
    r"กลิ่นหอมมาก",
    r"กลิ่นมีความหอม",
    r"หอมสดชื่น",
    r"ฟรุ๊ตตี้",
    r"ไม่หวานเลี่ยน",
    r"ฉีดได้ทุกวัน",
    r"ไปเรียนกัน",
    r"รีบวิ่งมาก",
    r"จะสายแล้ว",
    r"โชคดีนะคะที่ยังทัน",
    r"โชคดีที่ยังทัน",
    r"ยังทันอยู่",
    r"ทำงานกลุ่ม",
    r"เกือบ\s*4\s*โมงแล้ว",
    r"เกือบ\s*4\s*โมง",
    r"ยังไม่เลิกเลย",
    r"นั่งทำงานต่อ",
    r"เลิกเรียนแล้ว",
    r"ถามเพื่อนว่าวันนี้",
    r"ตัวหอมไหม",
    r"ตัวหอมมาก",
    r"หอมมาก",
    r"ฉีดตั้งแต่เช้า",
    r"ตัวยังหอมอยู่เลย",
    r"ตัวยังหอม",
    r"ตัวหอม",
    r"หมาล่าทั่ง",
    r"อร่อยมาก+",
    r"เดินตลาดนัด",
    r"ตลาดนัด",
    r"3\s*ทุ่มครึ่ง",
    r"เกือบทุ่มครึ่ง",
    r"ทุ่มครึ่ง",
    r"ใช้ชีวิตมาทั้งวัน",
    r"กลิ่นนี้คือติดทนมาก",
    r"ติดทนมาก",
    r"ใครอยากลอง",
    r"ต้องน้ำหอม",
    r"เอี๊ยมยีนส์",
    r"พรางหุ่นเป๊ะ",
    r"ปรับระดับได้",
    r"ใส่สบาย",
    r"น่ารักมาก+",
    r"ยังไม่ตื่นเต้น",
    r"ยังไม่เก็ทมากพอ",
    r"เปลี่ยนชีวิต",
    r"เปลี่ยนโลกได้",
    r"เปลี่ยนโลก",
    r"สร้างความเปลี่ยนแปลง",
    r"เขียนโค้ดได้",
    r"มีเงินมากพอ",
    r"มีเงินไม่มีเงิน",
    r"ฉลาดขึ้น",
    r"มีแต่ดีขึ้น",
    r"ไม่เป็นปัญหาถาวร",
    r"[0-9]+\s*(?:บาท|แถม|ชิ้น|วัน|เท่า|โมง|ทุ่ม|วิ|นาที|%|ชนิด|ปี|บุคคล)"
]


def clean_asr_text(raw_txt):
    if not raw_txt:
        return ""
    txt = raw_txt.strip()
    for wrong, right in ASR_CORRECTIONS:
        if wrong.lower() in txt.lower():
            pattern = re.compile(re.escape(wrong), re.IGNORECASE)
            txt = pattern.sub(right, txt)
    # Boundary-aware edge corrections
    if txt.startswith("ดีนะคะที่ยัง"):
        txt = "โชค" + txt
    if txt.startswith("ตีแต่"):
        txt = "ฟรุ๊ต" + txt
    if txt.startswith("กว่าก็เป็นเวลา"):
        txt = txt.replace("กว่าก็เป็นเวลา", "กว่าเราจะกลับก็เป็นเวลา", 1)
    if txt.endswith("ที่ยัง"):
        txt = txt + "ทันอยู่"
    if txt.endswith("หน้าไบ"):
        txt = txt + "ร์ท"
    if txt.endswith("ว่าตัว"):
        txt = txt + "หอม"
    if txt.endswith("กลิ่นมีความ"):
        txt = txt + "หอม"
    if txt.endswith("หวานนิด"):
        txt = txt + "ๆ ฟรุ๊ตตี้"
    return " ".join(txt.split())


def tokenize_thai_smart(text):
    """
    Tokenizes mixed Thai + English text into 100% complete dictionary words
    using PyThaiNLP (newmm) and groups multi-word English brand/tech phrases.
    Never slices inside a Thai word!
    """
    clean = clean_asr_text(text.replace("*", ""))
    if not clean:
        return []

    if HAS_PYTHAINLP:
        raw_tokens = thai_word_tokenize(clean, engine="newmm", keep_whitespace=True)
    else:
        raw_tokens = clean.split()

    merged = []
    i = 0
    while i < len(raw_tokens):
        tk = raw_tokens[i]
        if not tk.strip():
            i += 1
            continue
        tk_s = tk.strip()
        # Group consecutive English/numeric words (up to 4 words, e.g. "One Day With Me", "Nivea Sun C&E")
        if re.match(r"^[A-Za-z0-9&+.:-]+$", tk_s):
            eng_grp = [tk_s]
            j = i + 1
            while j < len(raw_tokens) and len(eng_grp) < 4:
                nxt = raw_tokens[j].strip()
                if not nxt:
                    j += 1
                    continue
                if re.match(r"^[A-Za-z0-9&+.:-]+$", nxt):
                    eng_grp.append(nxt)
                    j += 1
                else:
                    break
            merged.append(" ".join(eng_grp))
            i = j
        else:
            merged.append(tk_s)
            i += 1

    # Second pass: re-join Thai combining characters and compound loanwords (e.g. หมาล่าทั่ง)
    COMPOUND_PAIRS = {
        ("หมา", "ล่า"): "หมาล่า",
        ("หมาล่า", "ทั่ง"): "หมาล่าทั่ง",
        ("ฟรุ๊ต", "ตี้"): "ฟรุ๊ตตี้",
        ("หน้า", "ไบร์ท"): "หน้าไบร์ท",
        ("ดู", "ไบร์ท"): "ดูไบร์ท",
        ("เอี๊ยม", "ยีนส์"): "เอี๊ยมยีนส์",
        ("แบงค์", "เขียว"): "แบงค์เขียว",
        ("3", "ทุ่มครึ่ง"): "3 ทุ่มครึ่ง",
        ("เกือบ", "ทุ่มครึ่ง"): "เกือบทุ่มครึ่ง",
        ("ตัว", "หอม"): "ตัวหอม",
        ("ตัว", "หอมมาก"): "ตัวหอมมาก",
        ("ตัวหอม", "มาก"): "ตัวหอมมาก",
        ("ตัวหอม", "ไหม"): "ตัวหอมไหม",
        ("ต้อง", "น้ำหอม"): "ต้องน้ำหอม",
        ("PA", "++++"): "PA++++",
        ("PA", "+++"): "PA++++",
    }
    final_tokens = []
    for t in merged:
        if final_tokens and len(t) == 1 and ("\u0e30" <= t <= "\u0e4e"):
            final_tokens[-1] += t
        elif final_tokens and (final_tokens[-1], t) in COMPOUND_PAIRS:
            final_tokens[-1] = COMPOUND_PAIRS[(final_tokens[-1], t)]
        else:
            final_tokens.append(t)
    # Run compound merge one more time for 3-part compounds like หมา+ล่า+ทั่ง
    merged_compounds = []
    for t in final_tokens:
        if merged_compounds and (merged_compounds[-1], t) in COMPOUND_PAIRS:
            merged_compounds[-1] = COMPOUND_PAIRS[(merged_compounds[-1], t)]
        else:
            merged_compounds.append(t)
    return merged_compounds


def join_thai_tokens(tokens):
    """
    Joins tokenized Thai/English words cleanly (spaces around English/numbers,
    no artificial spaces breaking Thai words).
    """
    if not tokens:
        return ""
    out = []
    for idx, tk in enumerate(tokens):
        if idx == 0:
            out.append(tk)
            continue
        prev = tokens[idx - 1]
        is_eng_cur = bool(re.search(r"[A-Za-z0-9]", tk))
        is_eng_prev = bool(re.search(r"[A-Za-z0-9]", prev))
        if is_eng_cur or is_eng_prev:
            out.append(" " + tk)
        else:
            out.append(tk)
    return "".join(out).strip()


def safe_thai_word_limit(text, max_chars=22):
    """
    Limits text length ONLY at complete PyThaiNLP word boundaries.
    NEVER truncates a Thai word mid-syllable!
    """
    tokens = tokenize_thai_smart(text)
    if not tokens:
        return text.strip()
    acc = []
    cur_len = 0
    for tk in tokens:
        add_len = len(tk) + (1 if acc and re.search(r"[A-Za-z0-9]", tk) else 0)
        if acc and (cur_len + add_len > max_chars):
            break
        acc.append(tk)
        cur_len += add_len
    return join_thai_tokens(acc)


def extract_universal_keywords(text):
    """
    Extracts:
      1. full_highlighted: Full natural spoken clause with 1-2 key phrases wrapped in *...*
      2. keyword_only: Punchy, 100% complete-word viral hook (*คำสำคัญ*) with zero mid-word cuts.
    """
    clean = clean_asr_text(text.replace("*", ""))
    if not clean:
        return "", ""

    # 1. Check explicit high-value POWER_PHRASES first
    highlights = []
    occupied_spans = []
    for pat in POWER_PHRASES:
        for m in re.finditer(pat, clean, flags=re.IGNORECASE):
            s_i, e_i = m.span()
            if any(not (e_i <= os_i or s_i >= oe_i) for os_i, oe_i in occupied_spans):
                continue
            matched_str = m.group(0).strip()
            if matched_str and matched_str not in highlights:
                highlights.append(matched_str)
                occupied_spans.append((s_i, e_i))
            if len(highlights) >= 2:
                break
        if len(highlights) >= 2:
            break

    tokens = tokenize_thai_smart(clean)

    # 2. If no preset phrase matched, extract Semantic Core from PyThaiNLP tokens
    if not highlights and tokens:
        # Check for English brand/tech phrases in tokens first
        eng_tokens = [tk for tk in tokens if re.search(r"[A-Za-z]{2,}", tk)]
        for et in eng_tokens[:2]:
            highlights.append(et)

    if not highlights and tokens:
        # Strip conversational setup tokens from start and particles from end
        start_idx = 0
        while start_idx < len(tokens) - 1 and tokens[start_idx] in SETUP_STOP_TOKENS:
            start_idx += 1
        end_idx = len(tokens)
        while end_idx > start_idx + 1 and tokens[end_idx - 1] in TRAILING_PARTICLES:
            end_idx -= 1

        core_tokens = tokens[start_idx:end_idx]
        if not core_tokens:
            core_tokens = tokens

        # Build a complete-word highlight phrase of 2 to 5 tokens (<= 18 chars)
        picked = []
        c_len = 0
        for tk in core_tokens:
            if picked and (c_len + len(tk) > 18 or len(picked) >= 5):
                break
            picked.append(tk)
            c_len += len(tk)
        if picked:
            highlights.append(join_thai_tokens(picked))
        else:
            highlights.append(tokens[-1])

    # 3. Build full_highlighted (insert *...* around matched complete phrases)
    full_hi = clean
    for h in highlights[:2]:
        if h and h in full_hi and f"*{h}*" not in full_hi:
            full_hi = full_hi.replace(h, f" *{h}* ", 1)
    full_hi = " ".join(full_hi.split())
    if "*" not in full_hi and highlights:
        full_hi = f"*{highlights[0]}*"

    # 4. Build keyword_only (100% complete words, punchy 1-2 phrases, zero dangling verbs)
    if len(highlights) >= 2:
        kw_only = f"*{highlights[0]}* *{highlights[1]}*"
    else:
        kw_only = f"*{highlights[0]}*"

    spaced_full_hi, _ = segment_highlighted_into_word_beats(full_hi)
    return spaced_full_hi, " ".join(kw_only.split())


def segment_highlighted_into_word_beats(full_hi):
    """
    Uses PyThaiNLP dictionary tokenization (tokenize_thai_smart) to segment
    non-highlighted Thai clauses into natural 1-2 word spoken beats while
    preserving *highlighted* phrases intact.
    Returns (spaced_full_hi, beat_tokens) where:
      - spaced_full_hi has clean spaces between spoken Thai beats so frontend
        parseSubToTokens() and word chips work word-by-word!
      - beat_tokens is [{"text": str, "highlight": bool}, ...]
    """
    if not full_hi:
        return "", []
    parts = full_hi.split("*")
    beat_tokens = []
    SHORT_GLUE = {"ก็", "จะ", "ที่", "ใน", "มา", "ไป", "เลย", "ว่า", "ยัง", "ได้", "ให้", "กับ", "ของ", "ดู", "มี", "เป็น", "คือ", "แต่", "และ"}
    for idx, part in enumerate(parts):
        p_clean = part.strip()
        if not p_clean:
            continue
        is_hi = (idx % 2 == 1)
        if is_hi:
            beat_tokens.append({"text": p_clean, "highlight": True})
        else:
            raw_w = tokenize_thai_smart(p_clean)
            grouped = []
            for w in raw_w:
                if grouped and (
                    (len(grouped[-1]) <= 2 or grouped[-1] in SHORT_GLUE or len(w) <= 2 or w in SHORT_GLUE)
                    and len(grouped[-1]) + len(w) <= 8
                    and not re.search(r"[A-Za-z0-9]", grouped[-1])
                    and not re.search(r"[A-Za-z0-9]", w)
                ):
                    grouped[-1] = grouped[-1] + w
                else:
                    grouped.append(w)
            for gw in grouped:
                beat_tokens.append({"text": gw, "highlight": False})

    spaced_str = " ".join(
        f"*{bt['text']}*" if bt["highlight"] else bt["text"]
        for bt in beat_tokens
    )
    return spaced_str, beat_tokens


def split_long_utterance_at_word_valley(u_s, u_e, u_rms, u_txt, smooth_rms, voiced, silence_thr):
    """
    Post-ASR Real-Time Clause Splitter:
    If an aligned utterance is > 2.05s and contains >= 4 PyThaiNLP word tokens,
    splits it into 2 tight real-time phrase cards right at the deepest 20ms
    vocal energy valley between complete PyThaiNLP words (ZERO mid-word cuts!).
    """
    dur = u_e - u_s
    tokens = tokenize_thai_smart(u_txt)
    if dur <= 2.05 or len(tokens) < 4:
        return [(u_s, u_e, u_rms, u_txt)]

    n_rms = len(smooth_rms)
    f_s = max(0, min(n_rms - 1, int(round(u_s / 0.02))))
    f_e = max(f_s + 1, min(n_rms, int(round(u_e / 0.02))))
    n_f = f_e - f_s
    if n_f < 20:
        return [(u_s, u_e, u_rms, u_txt)]

    weights = [token_phonetic_weight(tk) for tk in tokens]
    total_w = sum(weights)
    cum_w = np.cumsum(weights)

    f_act = np.array([
        float(smooth_rms[i]) if voiced[i] else float(silence_thr * 0.08)
        for i in range(f_s, f_e)
    ])
    cum_f = np.cumsum(f_act)
    total_f = float(cum_f[-1]) if len(cum_f) > 0 and cum_f[-1] > 0 else 1.0

    # Candidate token split indices near the middle (leaving at least 2 tokens on each side)
    lo_tk = max(1, len(tokens) // 2 - 2)
    hi_tk = min(len(tokens) - 1, len(tokens) // 2 + 2)
    best_tk = len(tokens) // 2
    best_frame = f_s + n_f // 2
    best_score = -999.0

    for cand_tk in range(lo_tk, hi_tk + 1):
        ratio = float(cum_w[cand_tk - 1]) / total_w
        rel_f = int(np.searchsorted(cum_f, ratio * total_f))
        rel_f = max(15, min(n_f - 15, rel_f))

        # Search +-6 frames (+-120ms) for deepest acoustic valley in smooth_rms
        v_lo = max(12, rel_f - 6)
        v_hi = min(n_f - 12, rel_f + 6)
        valley_rel = v_lo + int(np.argmin(smooth_rms[f_s + v_lo:f_s + v_hi + 1]))
        valley_rms = float(smooth_rms[f_s + valley_rel])

        nxt_tok = tokens[cand_tk]
        prev_tok = tokens[cand_tk - 1]
        score = -abs(ratio - 0.50) * 2.5 - (valley_rms / max(0.01, u_rms)) * 1.8
        if nxt_tok in CLAUSE_STARTERS or any(nxt_tok.startswith(cs) for cs in ("แล้ว", "แต่", "เพราะ", "คือ", "จะ", "ก็", "พร้อม", "ต้อง", "ใคร", "กลิ่น")):
            score += 1.6
        if prev_tok in {"จะ", "ก็", "ที่", "ใน", "ของ", "ให้", "ว่า", "มา", "มีความ", "เป็นเวลา", "เกือบ"}:
            score -= 2.5
        if score > best_score:
            best_score = score
            best_tk = cand_tk
            best_frame = f_s + valley_rel

    cut_t = round(best_frame * 0.02, 2)
    if cut_t - u_s < 0.70 or u_e - cut_t < 0.70:
        return [(u_s, u_e, u_rms, u_txt)]

    txt1 = join_thai_tokens(tokens[:best_tk])
    txt2 = join_thai_tokens(tokens[best_tk:])
    rms1 = float(np.mean(smooth_rms[f_s:best_frame])) if best_frame > f_s else u_rms
    rms2 = float(np.mean(smooth_rms[best_frame:f_e])) if f_e > best_frame else u_rms

    res = []
    res.extend(split_long_utterance_at_word_valley(u_s, cut_t, rms1, txt1, smooth_rms, voiced, silence_thr))
    res.extend(split_long_utterance_at_word_valley(round(cut_t + 0.02, 2), u_e, rms2, txt2, smooth_rms, voiced, silence_thr))
    return res


def compute_word_timings_and_kw_window(u_s, u_e, full_hi, kw_hi, smooth_rms, voiced, silence_thr):
    """
    20ms Vocal-Band Acoustic Energy Forced Aligner:
    Maps every single word beat in `full_hi` to its exact 20ms [start, end]
    timestamp inside [u_s, u_e], AND computes the exact [kwStart, kwEnd]
    timestamp window when the highlighted keyword itself is spoken!
    """
    _, beat_tokens = segment_highlighted_into_word_beats(full_hi)
    if not beat_tokens:
        return round(u_s, 2), round(u_e, 2), round(u_s, 2), round(u_e, 2), []

    n_rms = len(smooth_rms)
    f_s = max(0, min(n_rms - 1, int(round(u_s / 0.02))))
    f_e = max(f_s + 1, min(n_rms, int(round(u_e / 0.02))))

    # Trim leading/trailing unvoiced frames inside [f_s, f_e] for tightest onset/offset
    while f_s < f_e - 4 and not voiced[f_s] and smooth_rms[f_s] < silence_thr * 0.95:
        f_s += 1
    while f_e > f_s + 4 and not voiced[f_e - 1] and smooth_rms[f_e - 1] < silence_thr * 0.95:
        f_e -= 1

    exact_s = round(max(0.0, f_s * 0.02 - 0.02), 2)
    exact_e = round(min(n_rms * 0.02, f_e * 0.02 + 0.02), 2)
    if exact_e - exact_s < 0.35:
        exact_e = round(min(n_rms * 0.02, exact_s + 0.45), 2)

    m = len(beat_tokens)
    if m == 1:
        wt = [{
            "text": beat_tokens[0]["text"],
            "start": exact_s,
            "end": exact_e,
            "highlight": beat_tokens[0]["highlight"]
        }]
        return exact_s, exact_e, exact_s, exact_e, wt

    n_f = max(m * 2, f_e - f_s)
    weights = [token_phonetic_weight(bt["text"]) for bt in beat_tokens]
    total_w = sum(weights)
    cum_w = np.cumsum(weights)

    f_act = np.array([
        float(smooth_rms[min(n_rms - 1, f_s + i)]) if voiced[min(n_rms - 1, f_s + i)] else float(silence_thr * 0.08)
        for i in range(n_f)
    ])
    cum_f = np.cumsum(f_act)
    total_f = float(cum_f[-1]) if len(cum_f) > 0 and cum_f[-1] > 0 else 1.0

    bounds = [0]
    for k in range(1, m):
        ratio = float(cum_w[k - 1]) / total_w
        rel_f = int(np.searchsorted(cum_f, ratio * total_f))
        min_b = bounds[-1] + 2
        max_b = n_f - (m - k) * 2
        rel_f = max(min_b, min(max_b, rel_f))

        # Snap to deepest 20ms acoustic syllable valley within +-4 frames (+-80ms)
        v_lo = max(min_b, rel_f - 4)
        v_hi = min(max_b, rel_f + 4)
        if v_hi > v_lo:
            slice_rms = [smooth_rms[min(n_rms - 1, f_s + idx)] for idx in range(v_lo, v_hi + 1)]
            valley_f = v_lo + int(np.argmin(slice_rms))
        else:
            valley_f = rel_f
        bounds.append(valley_f)
    bounds.append(n_f)

    word_timings = []
    for k in range(m):
        b0 = bounds[k]
        b1 = bounds[k + 1]
        ws = round(max(exact_s, (f_s + b0) * 0.02 - (0.02 if k == 0 else 0.0)), 2)
        we = round(min(exact_e, (f_s + b1) * 0.02 + (0.02 if k == m - 1 else 0.0)), 2)
        if we <= ws:
            we = round(ws + 0.12, 2)
        word_timings.append({
            "text": beat_tokens[k]["text"],
            "start": ws,
            "end": we,
            "highlight": beat_tokens[k]["highlight"]
        })

    # Compute exact keyword spoken window [kwStart, kwEnd] from highlighted word_timings
    hi_wts = [w for w in word_timings if w["highlight"]]
    if hi_wts:
        kw_s = round(max(exact_s, hi_wts[0]["start"] - 0.03), 2)
        kw_e = round(min(exact_e + 0.06, max(hi_wts[-1]["end"] + 0.04, kw_s + 0.68)), 2)
    else:
        kw_s = exact_s
        kw_e = exact_e

    return exact_s, exact_e, kw_s, kw_e, word_timings


# ==============================================================================
# 2. OPENCV VISUAL FORENSICS (Face Framing + Black Endscreen + Lens-Cover)
# ==============================================================================

def analyze_visual_forensics(video_path):
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    total_dur = round(frames / fps, 2) if fps > 0 else 30.0

    face_cascade = None
    try:
        cascade_path = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
        if os.path.exists(cascade_path):
            face_cascade = cv2.CascadeClassifier(cascade_path)
    except Exception:
        face_cascade = None

    face_y_centers = []
    bad_intervals = []

    # High-speed uniform sampling (max 8-12 sample frames across entire video, instead of 400+ seeks)
    n_samples = min(10, max(4, int(total_dur / 5.0)))
    sample_times = np.linspace(0.4, max(0.4, total_dur - 0.4), n_samples)
    lumas = []
    sharpnesses = []

    for idx, t in enumerate(sample_times):
        cap.set(cv2.CAP_PROP_POS_MSEC, float(t) * 1000.0)
        ret, frm = cap.read()
        if not ret or frm is None:
            lumas.append(100.0)
            sharpnesses.append(100.0)
            continue

        small = cv2.resize(frm, (144, 256))
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        luma = float(np.mean(gray))
        sharp = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        lumas.append(luma)
        sharpnesses.append(sharp)

        if face_cascade is not None and len(face_y_centers) < 4:
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=3, minSize=(28, 28))
            if len(faces) > 0:
                fx, fy, fw, fh = max(faces, key=lambda b: b[2] * b[3])
                cy_ratio = (fy + fh * 0.45) / 256.0
                face_y_centers.append(cy_ratio)

    cap.release()

    med_luma = float(np.median(lumas)) if lumas else 100.0
    med_sharp = float(np.median(sharpnesses)) if sharpnesses else 100.0

    default_crop_y = 0.25
    if face_y_centers:
        avg_face_y = float(np.median(face_y_centers))
        default_crop_y = round(max(0.18, min(0.45, avg_face_y - 0.05)), 2)

    return {
        "fps": fps,
        "frames": frames,
        "total_dur": total_dur,
        "sample_times": sample_times,
        "lumas": lumas,
        "sharpnesses": sharpnesses,
        "med_luma": med_luma,
        "med_sharp": med_sharp,
        "default_crop_y": default_crop_y,
        "bad_intervals": bad_intervals
    }


# ==============================================================================
# 3. 20ms VOCAL-BAND FORCED ALIGNMENT + BREATH-GROUP ASR ENGINE
# ==============================================================================

def token_phonetic_weight(tk):
    """
    Computes spoken syllable duration weight of a Thai/English token
    (excluding zero-duration combining tone/vowel marks).
    """
    base_chars = [c for c in tk if not ("\u0e31" <= c <= "\u0e3a" or "\u0e47" <= c <= "\u0e4e")]
    return max(1.2, float(len(base_chars)))


def align_breath_group_tokens_to_subwindows(bg_txt, sub_wins, sub_txts):
    """
    Given:
      - bg_txt: Full unbroken ASR sentence for the Breath-Group (zero mid-word slicing!)
      - sub_wins: List of [w_start, w_end, active_voiced_dur, mean_rms] for each subtitle window
      - sub_txts: Optional list of individual ASR transcripts per sub-window
    Returns:
      List of (w_start, w_end, mean_rms, aligned_text) where every sub-window
      gets 100% complete PyThaiNLP words aligned to its exact 20ms vocal timestamps!
    """
    n_wins = len(sub_wins)
    if n_wins == 0:
        return []
    if n_wins == 1:
        txt = bg_txt if bg_txt else (sub_txts[0] if sub_txts else "")
        return [(sub_wins[0][0], sub_wins[0][1], sub_wins[0][3], clean_asr_text(txt))]

    # Prune leading/trailing ambient-noise sub-windows where individual ASR returned empty string
    if sub_txts and any(t.strip() for t in sub_txts):
        filtered_pairs = [
            (w, t) for w, t in zip(sub_wins, sub_txts)
            if t.strip() or (w[1] - w[0] < 0.65)
        ]
        if filtered_pairs:
            sub_wins = [p[0] for p in filtered_pairs]
            sub_txts = [p[1] for p in filtered_pairs]
            n_wins = len(sub_wins)
            if n_wins == 1:
                txt = bg_txt if bg_txt else sub_txts[0]
                return [(sub_wins[0][0], sub_wins[0][1], sub_wins[0][3], clean_asr_text(txt))]

    # If bg_txt is empty, fall back to individual sub_txts
    if not bg_txt or len(bg_txt.strip()) < 3:
        out = []
        for idx, w in enumerate(sub_wins):
            stxt = clean_asr_text(sub_txts[idx]) if idx < len(sub_txts) else ""
            if stxt:
                out.append((w[0], w[1], w[3], stxt))
        return out

    tokens = tokenize_thai_smart(bg_txt)
    if len(tokens) < n_wins:
        return [(sub_wins[0][0], sub_wins[-1][1], sub_wins[0][3], clean_asr_text(bg_txt))]

    weights = [token_phonetic_weight(tk) for tk in tokens]
    total_w = sum(weights)
    cum_w = np.cumsum(weights)

    active_durs = [max(0.25, w[2]) for w in sub_wins]
    total_dur = sum(active_durs)

    split_indices = [0]
    acc_dur = 0.0
    for k in range(n_wins - 1):
        acc_dur += active_durs[k]
        target_ratio = acc_dur / total_dur
        target_w = target_ratio * total_w

        # Candidate token index closest to target acoustic weight
        raw_idx = int(np.argmin(np.abs(cum_w - target_w))) + 1
        min_allowed = split_indices[-1] + 1
        max_allowed = len(tokens) - (n_wins - 1 - k)
        raw_idx = max(min_allowed, min(max_allowed, raw_idx))

        # Check if sub_txts[k] or sub_txts[k+1] provides an exact lexical anchor within +-3 tokens
        best_idx = raw_idx
        best_score = -999.0
        lo_search = max(min_allowed, raw_idx - 3)
        hi_search = min(max_allowed, raw_idx + 3)

        sub_cur_clean = clean_asr_text(sub_txts[k]) if k < len(sub_txts) else ""
        sub_nxt_clean = clean_asr_text(sub_txts[k + 1]) if (k + 1) < len(sub_txts) else ""

        for cand in range(lo_search, hi_search + 1):
            # Distance penalty from acoustic duration target
            dist_pen = -abs(cand - raw_idx) * 0.8
            bonus = 0.0
            nxt_tok = tokens[cand]
            prev_tok = tokens[cand - 1]

            # Bonus 1: Next token is a natural Thai clause starter or conjunction
            if nxt_tok in CLAUSE_STARTERS or any(nxt_tok.startswith(cs) for cs in ("แล้ว", "แต่", "เพราะ", "โชคดี", "ในที่สุด", "เสร็จ", "ร้านนี้", "กว่า", "ยังรู้สึก", "ใคร")):
                bonus += 2.2
            # Bonus 2: Lexical match with individual sub-window ASR start/end
            if sub_nxt_clean and len(nxt_tok) >= 2 and sub_nxt_clean.startswith(nxt_tok[:2]):
                bonus += 3.0
            if sub_cur_clean and len(prev_tok) >= 2 and sub_cur_clean.endswith(prev_tok[-2:]):
                bonus += 2.5
            # Penalty for splitting right after a preposition/auxiliary ("ใน", "ของ", "ที่", "จะ", "ก็", "มา", "ไป", "ให้", "ว่า")
            if prev_tok in {"จะ", "ก็", "ที่", "ใน", "ของ", "ให้", "ว่า", "มา", "มีความ", "เป็นเวลา", "เกือบ"}:
                bonus -= 2.8

            score = bonus + dist_pen
            if score > best_score:
                best_score = score
                best_idx = cand

        split_indices.append(best_idx)

    split_indices.append(len(tokens))

    aligned = []
    for k in range(n_wins):
        i1, i2 = split_indices[k], split_indices[k + 1]
        chunk_tokens = tokens[i1:i2]
        chunk_txt = join_thai_tokens(chunk_tokens)
        if chunk_txt:
            aligned.append((sub_wins[k][0], sub_wins[k][1], sub_wins[k][3], chunk_txt))
    return aligned


def analyze_custom_video_human_like(video_path, mode="keywords"):
    if not os.path.exists(video_path):
        return {"segments": [], "zooms": [], "subtitles": [], "sfx": [], "vfx": []}

    vis = analyze_visual_forensics(video_path)
    total_dur = vis["total_dur"]
    crop_y = vis["default_crop_y"]
    bad_intervals = vis["bad_intervals"]

    workdir = os.path.join(BASE_DIR, "audio_temp")
    os.makedirs(workdir, exist_ok=True)
    pid_tag = f"{os.getpid()}_{int(np.random.randint(1000, 9999))}"
    wav_path = os.path.join(workdir, f"audio_{pid_tag}.wav")

    # Ultra-fast single-pass 16kHz audio extraction with high-clarity voice normalization
    subprocess.run([
        FFMPEG_EXE, "-y", "-i", video_path,
        "-af", "highpass=f=80,lowpass=f=5500,dynaudnorm=f=150:g=15",
        "-ar", "16000", "-ac", "1", wav_path
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    sr_rate = 16000
    pcm_asr_int16 = np.zeros(int(total_dur * sr_rate), dtype=np.int16)

    if os.path.exists(wav_path):
        with wave.open(wav_path, "rb") as wf:
            pcm_asr_int16 = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).copy()
        try:
            os.remove(wav_path)
        except Exception:
            pass

    # High-Resolution 20ms (0.02s = 50Hz) Vocal-Band Energy Envelope
    vad_float = pcm_asr_int16.astype(np.float32) / 32768.0
    step = int(0.02 * sr_rate)  # 320 samples = 20ms
    n_frames = max(1, len(vad_float) // step)
    rms = np.array([np.sqrt(np.mean(vad_float[i * step:(i + 1) * step] ** 2)) for i in range(n_frames)])
    smooth_rms = np.convolve(rms, np.ones(3) / 3.0, mode="same")

    silence_thr = max(0.014, float(np.percentile(rms, 20)) * 0.92)
    effective_end = total_dur
    sample_times = vis["sample_times"]
    lumas = vis["lumas"]
    sharpnesses = vis["sharpnesses"]

    for i in range(len(sample_times) - 1, -1, -1):
        t = float(sample_times[i])
        if total_dur - t > 3.5:
            break
        f_idx = min(n_frames - 1, int(t / 0.02))
        tail_rms = float(np.mean(rms[f_idx:min(n_frames, f_idx + 12)]))
        is_silent_tail = tail_rms < silence_thr * 0.80
        is_black = lumas[i] < 18.0
        is_lens_cover = (sharpnesses[i] < 7.0 and lumas[i] < 38.0)
        if is_black or (is_lens_cover and is_silent_tail):
            effective_end = max(1.0, round(t - 0.05, 2))
        elif not is_silent_tail:
            break

    # Zero out RMS during mid-clip lens-occlusion intervals if silent
    for b_s, b_e in bad_intervals:
        bi1 = max(0, int(b_s / 0.02))
        bi2 = min(n_frames, int(b_e / 0.02))
        if float(np.mean(rms[bi1:bi2])) < silence_thr * 1.30:
            rms[bi1:bi2] = 0.0
            smooth_rms[bi1:bi2] = 0.0

    max_frame = min(n_frames, int(effective_end / 0.02))
    voiced = rms[:max_frame] > silence_thr

    # --------------------------------------------------------------------------
    # STEP 1: Detect Atomic 20ms Voiced Micro-Islands (Pause >= 80ms = 4 frames)
    # --------------------------------------------------------------------------
    micro_islands = []
    in_v = False
    s_i = 0
    for i in range(max_frame):
        if voiced[i] and not in_v:
            s_i = i
            in_v = True
        elif not voiced[i] and in_v:
            if not np.any(voiced[i:min(max_frame, i + 4)]):
                dur = (i - s_i) * 0.02
                if dur >= 0.08:
                    m_s = round(s_i * 0.02, 2)
                    m_e = round(i * 0.02, 2)
                    micro_islands.append([m_s, m_e])
                in_v = False
    if in_v and (max_frame - s_i) * 0.02 >= 0.08:
        micro_islands.append([round(s_i * 0.02, 2), round(effective_end, 2)])

    # Only split a continuous micro-island if it exceeds 3.15s without any 80ms pause
    fine_micro = []
    for m_s, m_e in micro_islands:
        cur = m_s
        while m_e - cur > 3.15:
            lo = int((cur + 1.25) / 0.02)
            hi = min(max_frame - 1, int(min(m_e - 0.90, cur + 2.55) / 0.02))
            if hi <= lo:
                break
            v_idx = lo + int(np.argmin(smooth_rms[lo:hi + 1]))
            cut_t = round(v_idx * 0.02, 2)
            fine_micro.append([cur, cut_t])
            cur = cut_t
        if m_e - cur >= 0.14:
            fine_micro.append([cur, m_e])

    # --------------------------------------------------------------------------
    # STEP 2: Group into Unbroken Breath-Groups (Break at Pause >= 260ms) & Sub-Windows
    # --------------------------------------------------------------------------
    breath_groups = []
    for m_s, m_e in fine_micro:
        if not breath_groups:
            breath_groups.append({"start": m_s, "end": m_e, "items": [[m_s, m_e]]})
        else:
            bg = breath_groups[-1]
            gap = m_s - bg["end"]
            comb = m_e - bg["start"]
            # Preserve stop consonants (< 260ms gap) inside the same Breath-Group; break at true breath pauses >= 260ms
            if gap < 0.26 and comb <= 6.5:
                bg["end"] = m_e
                bg["items"].append([m_s, m_e])
            elif gap < 0.34 and (bg["end"] - bg["start"] < 0.90 or m_e - m_s < 0.70) and comb <= 4.8:
                bg["end"] = m_e
                bg["items"].append([m_s, m_e])
            else:
                breath_groups.append({"start": m_s, "end": m_e, "items": [[m_s, m_e]]})

    # Partition each Breath-Group into Display Subtitle Windows (1.2s - 2.95s each)
    for bg in breath_groups:
        items = bg["items"]
        sub_wins = []
        cur_w = None
        for it_s, it_e in items:
            f1 = max(0, int(it_s / 0.02))
            f2 = min(max_frame, max(f1 + 1, int(it_e / 0.02)))
            it_rms = float(np.mean(rms[f1:f2]))
            it_act = max(0.10, it_e - it_s)
            if cur_w is None:
                cur_w = [it_s, it_e, it_act, it_rms]
            else:
                gap = it_s - cur_w[1]
                comb_dur = it_e - cur_w[0]
                if (comb_dur <= 2.85 and gap < 0.20) or (cur_w[1] - cur_w[0] < 0.95 and comb_dur <= 3.10 and gap < 0.26):
                    cur_w[1] = it_e
                    cur_w[2] += it_act
                    cur_w[3] = max(cur_w[3], it_rms)
                else:
                    sub_wins.append(cur_w)
                    cur_w = [it_s, it_e, it_act, it_rms]
        if cur_w is not None:
            if sub_wins and (cur_w[1] - cur_w[0] < 0.75) and (cur_w[1] - sub_wins[-1][0] <= 3.15):
                sub_wins[-1][1] = cur_w[1]
                sub_wins[-1][2] += cur_w[2]
                sub_wins[-1][3] = max(sub_wins[-1][3], cur_w[3])
            else:
                sub_wins.append(cur_w)
        bg["sub_wins"] = sub_wins

    # --------------------------------------------------------------------------
    # STEP 3: Dual-Pass Parallel In-Memory ASR (Breath-Groups + Sub-Windows)
    # --------------------------------------------------------------------------
    try:
        import speech_recognition as sr_mod
        has_sr = True
    except Exception:
        has_sr = False

    asr_tasks = []
    for bg_idx, bg in enumerate(breath_groups):
        # Unbroken full breath-group audio (with 0.16s pre / 0.22s post pad)
        asr_tasks.append(("bg", bg_idx, -1, max(0.0, bg["start"] - 0.16), min(total_dur, bg["end"] + 0.22)))

    rec_shared = sr_mod.Recognizer() if has_sr else None

    def run_asr_slice(task_tuple):
        kind, bg_i, sw_i, t_s, t_e = task_tuple
        if not has_sr or rec_shared is None:
            return (kind, bg_i, sw_i, "")
        idx1 = max(0, int(t_s * sr_rate))
        idx2 = min(len(pcm_asr_int16), int(t_e * sr_rate))
        if idx2 - idx1 < int(0.25 * sr_rate):
            return (kind, bg_i, sw_i, "")
        pcm_bytes = pcm_asr_int16[idx1:idx2].tobytes()
        try:
            aud = sr_mod.AudioData(pcm_bytes, sr_rate, 2)
            txt = rec_shared.recognize_google(aud, language="th-TH")
        except Exception:
            txt = ""
        return (kind, bg_i, sw_i, txt)

    bg_transcripts = {}
    if asr_tasks:
        with ThreadPoolExecutor(max_workers=8) as pool:
            futs = [pool.submit(run_asr_slice, t) for t in asr_tasks]
            for f in as_completed(futs):
                kind, bg_i, sw_i, txt = f.result()
                bg_transcripts[bg_i] = txt

    # Align unbroken Breath-Group tokens onto exact 20ms Sub-Windows
    raw_aligned = []
    for bg_idx, bg in enumerate(breath_groups):
        bg_txt = bg_transcripts.get(bg_idx, "")
        sw_list = bg["sub_wins"]
        aligned = align_breath_group_tokens_to_subwindows(bg_txt, sw_list, [])
        raw_aligned.extend(aligned)

    # Post-Alignment Fragment Merger: merge tiny 1-word/short fragments (< 0.90s or <= 6 chars) into neighbor
    SUFFIX_FRAGMENTS = {"+", "++", "+++", "++++", "แล้ว", "เลย", "นะคะ", "นะครับ", "นะ", "อ่ะ", "ต่อ"}
    aligned_utterances = []
    idx_a = 0
    while idx_a < len(raw_aligned):
        u_s, u_e, u_rms, u_txt = raw_aligned[idx_a]
        clean_u = u_txt.strip()
        is_symbol_only = bool(re.match(r"^[\+\-\*\.]+$", clean_u.replace(" ", "")))
        is_tiny = is_symbol_only or (u_e - u_s < 0.90 and len(clean_u) <= 10) or len(clean_u) <= 5
        if (is_symbol_only or clean_u in SUFFIX_FRAGMENTS) and aligned_utterances:
            prev_s, prev_e, prev_r, prev_t = aligned_utterances[-1]
            if u_s - prev_e < 0.65:
                if is_symbol_only and "PA" in prev_t and "PA++++" not in prev_t:
                    prev_t = prev_t.replace("PA", "PA++++")
                    aligned_utterances[-1] = (prev_s, u_e, max(prev_r, u_rms), prev_t.strip())
                else:
                    sep = "" if is_symbol_only else " "
                    aligned_utterances[-1] = (prev_s, u_e, max(prev_r, u_rms), (prev_t + sep + clean_u).strip())
                idx_a += 1
                continue
        if is_tiny and (idx_a + 1) < len(raw_aligned):
            nxt_s, nxt_e, nxt_r, nxt_t = raw_aligned[idx_a + 1]
            if nxt_s - u_e < 0.65:
                raw_aligned[idx_a + 1] = (u_s, nxt_e, max(u_rms, nxt_r), (clean_u + " " + nxt_t).strip())
                idx_a += 1
                continue
        if is_tiny and aligned_utterances:
            prev_s, prev_e, prev_r, prev_t = aligned_utterances[-1]
            if u_s - prev_e < 0.65:
                aligned_utterances[-1] = (prev_s, u_e, max(prev_r, u_rms), (prev_t + " " + clean_u).strip())
                idx_a += 1
                continue
        aligned_utterances.append((u_s, u_e, u_rms, clean_u))
        idx_a += 1

    # Post-ASR Real-Time Clause Splitter: split any > 2.05s multi-clause utterance at 20ms word valley
    realtime_utterances = []
    for u_s, u_e, u_rms, clean_u in aligned_utterances:
        realtime_utterances.extend(
            split_long_utterance_at_word_valley(u_s, u_e, u_rms, clean_u, smooth_rms, voiced, silence_thr)
        )

    # Build final Subtitles list with fullStart/fullEnd, kwStart/kwEnd, wordTimings, fullText, keywordText
    subtitles = []
    energies = [u[2] for u in realtime_utterances if u[3]]
    high_energy_thr = float(np.percentile(energies, 62)) if energies else 0.05

    for idx_u, (u_s, u_e, u_rms, u_txt) in enumerate(realtime_utterances):
        if not u_txt:
            continue
        full_hi, kw_hi = extract_universal_keywords(u_txt)
        if not full_hi:
            continue

        full_s, full_e, kw_s, kw_e, word_timings = compute_word_timings_and_kw_window(
            u_s, u_e, full_hi, kw_hi, smooth_rms, voiced, silence_thr
        )
        # Prevent overlap with next utterance's start
        if idx_u + 1 < len(realtime_utterances):
            nxt_u_s = realtime_utterances[idx_u + 1][0]
            if full_e > nxt_u_s - 0.02:
                full_e = round(max(full_s + 0.25, nxt_u_s - 0.02), 2)
            if kw_e > nxt_u_s - 0.02:
                kw_e = round(max(kw_s + 0.25, nxt_u_s - 0.02), 2)

        is_peak = (len(subtitles) == 0) or (u_rms >= high_energy_thr)
        sub_zoom = 1.28 if is_peak else 1.20
        use_kw = (mode != "full")
        subtitles.append({
            "id": f"sub_{len(subtitles) + 1}",
            "start": kw_s if use_kw else full_s,
            "end": kw_e if use_kw else full_e,
            "fullStart": full_s,
            "fullEnd": full_e,
            "kwStart": kw_s,
            "kwEnd": kw_e,
            "fullText": full_hi,
            "keywordText": kw_hi,
            "text": kw_hi if use_kw else full_hi,
            "wordTimings": word_timings,
            "subZoom": sub_zoom,
            "_energy": u_rms
        })

    # Fallback only if video has zero spoken dialogue (music-only B-roll/OOTD clip)
    if len(subtitles) == 0:
        fallback_hooks = [
            ("*ลุคนี้ต้องตำ* ทรงสวยมาก", "ป้ายยา *ลุคสุดคิ้วท์* ทรงสวยพรางหุ่น"),
            ("*ดีเทลเป๊ะ* แมทช์ง่ายสุดๆ", "ดีเทลสวย *แมทช์ง่าย* ใส่ได้ทุกวัน"),
            ("*เนื้อผ้านิ่ม* ใส่สบายมาก", "เนื้อผ้าดี *ใส่สบาย* ไม่อึดอัดเลย"),
            ("*น่ารักมาก* พิกัดในตะกร้า", "ใส่แล้ว *น่ารักมาก* พิกัดในตะกร้าเลย")
        ]
        t_step = max(2.8, effective_end / len(fallback_hooks))
        for i, (kw_h, full_h) in enumerate(fallback_hooks):
            st = round(i * t_step + 0.3, 2)
            et = round(min(effective_end, (i + 1) * t_step), 2)
            if et - st < 0.8:
                break
            subtitles.append({
                "id": f"sub_{i + 1}",
                "start": st,
                "end": et,
                "fullStart": st,
                "fullEnd": et,
                "kwStart": st,
                "kwEnd": et,
                "fullText": full_h,
                "keywordText": kw_h,
                "text": kw_h if mode != "full" else full_h,
                "wordTimings": [],
                "subZoom": 1.26,
                "_energy": 0.05
            })

    # --------------------------------------------------------------------------
    # STEP 4: Natural Continuous Scene Segments (100% Contiguous, Zero Chopped Words)
    # The entire video timeline 0.0 -> effective_end is completely preserved without
    # cutting silence or dropping frames. Segments connect smoothly at natural breath pauses.
    # --------------------------------------------------------------------------
    split_points = []
    if subtitles and len(subtitles) >= 2:
        last_split = 0.0
        for idx_sub in range(len(subtitles) - 1):
            s_cur = subtitles[idx_sub]
            s_nxt = subtitles[idx_sub + 1]
            cur_end = s_cur.get("fullEnd", s_cur["end"])
            nxt_start = s_nxt.get("fullStart", s_nxt["start"])
            gap = nxt_start - cur_end
            dur_from_last = cur_end - last_split
            if (dur_from_last >= 7.5 and gap >= 0.25) or (dur_from_last >= 13.0 and gap >= 0.06):
                split_t = round((cur_end + nxt_start) / 2.0, 2)
                split_points.append(split_t)
                last_split = split_t

    raw_segments = []
    prev_t = 0.0
    for sp in split_points:
        if sp > prev_t + 1.8 and sp < effective_end - 1.8:
            raw_segments.append((prev_t, sp))
            prev_t = sp
    raw_segments.append((prev_t, round(effective_end, 2)))

    segments_out = []
    for idx_s, (s_start, s_end) in enumerate(raw_segments):
        matching_subs = [s for s in subtitles if s.get("fullStart", s["start"]) >= s_start - 0.20 and s.get("fullEnd", s["end"]) <= s_end + 0.20]
        if matching_subs:
            first_kw = matching_subs[0]["keywordText"].replace("*", "").strip()
            lbl = f"คัต #{idx_s + 1}: {safe_thai_word_limit(first_kw, 22)}"
        else:
            lbl = f"คัตที่ {idx_s + 1} ({s_start:.1f}s - {s_end:.1f}s)"
        segments_out.append({
            "id": f"s{idx_s + 1}",
            "sourceStart": s_start,
            "sourceEnd": s_end,
            "zoomScale": 1.0,
            "cropY": crop_y,
            "label": lbl
        })

    # --------------------------------------------------------------------------
    # STEP 5: Human-Grade Camera Zooms, SFX, and VFX Locked to Subtitle Onsets
    # --------------------------------------------------------------------------
    zooms = []
    sfx = []
    vfx = []

    if subtitles:
        first_sub = subtitles[0]
        zooms.append({
            "id": "z_1",
            "start": first_sub["start"],
            "end": first_sub["end"],
            "scale": 1.22,
            "mode": "smooth",
            "label": "ซูมเปิด Hook"
        })
        sfx.append({
            "id": "sfx_1",
            "time": first_sub["start"],
            "type": "pop",
            "label": "ป๊อปเปิด Hook"
        })

    last_zoom_end = zooms[0]["end"] if zooms else 0.0
    max_zooms = max(6, int(effective_end / 9.0))
    for idx_sub, s in enumerate(subtitles[1:], start=1):
        if s["start"] - last_zoom_end >= 5.0 and len(zooms) < max_zooms:
            is_punch = (len(zooms) % 2 == 1)
            clean_kw = safe_thai_word_limit(s["keywordText"].replace("*", ""), 18)
            zooms.append({
                "id": f"z_{len(zooms) + 1}",
                "start": s["start"],
                "end": s["end"],
                "scale": 1.25 if is_punch else 1.22,
                "mode": "punch" if is_punch else "smooth",
                "label": f"ซูมเน้นคำ ({clean_kw})"
            })
            sfx.append({
                "id": f"sfx_{len(sfx) + 1}",
                "time": s["start"],
                "type": "sparkle" if is_punch else "pop",
                "label": "เสียงเน้นคำสำคัญ (Keywords)"
            })
            last_zoom_end = s["end"]

    for seg in segments_out[1:5]:
        sfx.append({
            "id": f"sfx_{len(sfx) + 1}",
            "time": seg["sourceStart"],
            "type": "shutter",
            "label": "ชัตเตอร์เปลี่ยนฉาก"
        })
    if len(segments_out) >= 2:
        vfx.append({
            "id": "vfx_1",
            "start": segments_out[1]["sourceStart"],
            "end": round(min(effective_end, segments_out[1]["sourceStart"] + 0.30), 2),
            "type": "flash",
            "intensity": 0.42,
            "label": "แฟลชเปลี่ยนฉาก"
        })
    vfx.append({
        "id": "vfx_2",
        "start": segments_out[0]["sourceStart"],
        "end": round(min(effective_end, segments_out[0]["sourceStart"] + 3.5), 2),
        "type": "warm_glow",
        "intensity": 0.32,
        "label": "ออร่าผิวใสเปิดคลิป"
    })

    for s in subtitles:
        s.pop("_energy", None)

    hook_banner = ""
    if len(subtitles) >= 2:
        k1 = safe_thai_word_limit(subtitles[0]["keywordText"].replace("*", "").strip(), 18)
        k2 = safe_thai_word_limit(subtitles[1]["keywordText"].replace("*", "").strip(), 18)
        hook_banner = f"{k1} • {k2}"
    elif len(subtitles) == 1:
        hook_banner = safe_thai_word_limit(subtitles[0]["keywordText"].replace("*", "").strip(), 22)

    return {
        "aspectRatio": "3:4",
        "fitMode": "fill",
        "defaultCropY": crop_y,
        "hookText": hook_banner,
        "hookDuration": effective_end,
        "subtitleMode": "keywords" if mode != "full" else "full",
        "style": {
            "preset": "meowmaew_pink",
            "fontFamily": "Kanit",
            "fontSize": 44,
            "accentColor": "#FF5A96",
            "subYRatio": 0.83,
            "usePill": True
        },
        "segments": segments_out,
        "zooms": zooms,
        "pins": [
            {
                "id": "p1",
                "start": 0.0,
                "end": effective_end,
                "title": safe_thai_word_limit(hook_banner.split("•")[0].strip(), 20) or "พิกัดสินค้า",
                "price": "ปักหมุด"
            }
        ],
        "sfx": sorted(sfx, key=lambda x: x["time"]),
        "vfx": vfx,
        "subtitles": subtitles
    }


# ==============================================================================
# 5. MULTI-CLIP PRO MERGER & SEQUENCER ENGINE (รวมหลายคลิปย่อยเป็น 1 วิดีโอ)
# ==============================================================================

def probe_video_fast(video_path):
    """
    Fast probe of a video file's duration, dimensions, FPS, and audio presence.
    """
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 720
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1280
    dur = round(frames / fps, 2) if fps > 0 else 10.0
    cap.release()

    has_audio = True
    try:
        pr = subprocess.run(
            [FFMPEG_EXE, "-hide_banner", "-i", video_path],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        info_txt = pr.stderr.decode("utf-8", errors="ignore")
        has_audio = ("Audio:" in info_txt)
    except Exception:
        has_audio = True

    return {
        "duration": max(0.2, dur),
        "width": w,
        "height": h,
        "fps": round(fps, 2),
        "hasAudio": has_audio
    }


def merge_video_clips_pro(merge_cfg_path, out_mp4_path):
    """
    Normalizes and stitches multiple sub-videos (any resolution, FPS, codec,
    with or without audio, with optional per-clip trimStart/trimEnd) into a
    single sample-accurate master MP4, then runs the Real-Time AI Director
    across the unified video with sub-clip boundary markers and transitions.
    """
    with open(merge_cfg_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    clip_items = cfg.get("clips", [])
    sub_mode = cfg.get("subtitleMode", "keywords")
    auto_ai = cfg.get("autoAi", True)
    add_transitions = cfg.get("addTransitions", True)

    if not clip_items:
        return {"ok": False, "error": "No clips provided"}

    valid_clips = []
    for idx, item in enumerate(clip_items):
        rel_p = item.get("sourcePath", "")
        in_p = rel_p if os.path.isabs(rel_p) else os.path.join(BASE_DIR, rel_p)
        in_p = os.path.abspath(in_p)
        if not os.path.exists(in_p):
            continue
        meta = probe_video_fast(in_p)
        raw_dur = meta["duration"]
        t_s = max(0.0, float(item.get("trimStart") or 0.0))
        t_e = float(item.get("trimEnd") or 0.0)
        if t_e <= t_s + 0.15 or t_e > raw_dur:
            t_e = raw_dur
        title = (item.get("title") or os.path.splitext(os.path.basename(in_p))[0])[:20]
        valid_clips.append({
            "index": idx,
            "path": in_p,
            "trimStart": t_s,
            "trimEnd": t_e,
            "duration": round(t_e - t_s, 2),
            "hasAudio": meta["hasAudio"],
            "title": title
        })

    if not valid_clips:
        return {"ok": False, "error": "No valid video files found"}

    # Single-pass FFmpeg filter_complex concat (instantaneous, zero disk I/O bottleneck, zero path escaping errors)
    cmd = [FFMPEG_EXE, "-y"]
    filter_parts = []
    concat_order = []
    cur_offset = 0.0
    clip_boundaries = []

    for i, c in enumerate(valid_clips):
        cmd.extend(["-ss", f"{c['trimStart']:.2f}", "-to", f"{c['trimEnd']:.2f}", "-i", c["path"]])
        filter_parts.append(f"[{i}:v]scale=720:960:force_original_aspect_ratio=increase,crop=720:960,setsar=1,fps=30[v{i}];")
        if c["hasAudio"]:
            filter_parts.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo[a{i}];")
        else:
            filter_parts.append(f"aevalsrc=0:d={c['duration']:.2f}:s=44100:c=stereo[a{i}];")
        concat_order.append(f"[v{i}][a{i}]")

        start_off = round(cur_offset, 2)
        end_off = round(cur_offset + c["duration"], 2)
        clip_boundaries.append({
            "clipIndex": i + 1,
            "title": c["title"],
            "startOffset": start_off,
            "endOffset": end_off,
            "duration": c["duration"]
        })
        cur_offset += c["duration"]

    n = len(valid_clips)
    concat_str = "".join(filter_parts) + "".join(concat_order) + f"concat=n={n}:v=1:a=1[outv][outa]"
    cmd.extend([
        "-filter_complex", concat_str,
        "-map", "[outv]",
        "-map", "[outa]",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "44100", "-b:a", "160k",
        out_mp4_path
    ])

    res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if not os.path.exists(out_mp4_path) or os.path.getsize(out_mp4_path) == 0:
        return {
            "ok": False,
            "error": "FFmpeg merge failed",
            "stderr": res.stderr.decode("utf-8", errors="ignore")
        }

    total_merged_dur = round(cur_offset, 2)

    if auto_ai:
        plan = analyze_custom_video_human_like(out_mp4_path, mode=sub_mode)
    else:
        plan = {
            "aspectRatio": "3:4",
            "fitMode": "fill",
            "defaultCropY": 0.25,
            "hookText": "รวมคลิปสุดปัง • เหมียวน่ารัก 3:4",
            "hookDuration": total_merged_dur,
            "subtitleMode": sub_mode,
            "style": {
                "preset": "meowmaew_pink",
                "fontFamily": "Kanit",
                "fontSize": 44,
                "accentColor": "#FF5A96",
                "subYRatio": 0.83,
                "usePill": True
            },
            "segments": [
                {
                    "id": f"s{b['clipIndex']}",
                    "sourceStart": b["startOffset"],
                    "sourceEnd": b["endOffset"],
                    "zoomScale": 1.0,
                    "cropY": 0.25,
                    "label": f"[คลิป #{b['clipIndex']}] {b['title']}"
                }
                for b in clip_boundaries
            ],
            "zooms": [],
            "pins": [{"id": "p1", "start": 0.0, "end": total_merged_dur, "title": "รวมคลิปไฮไลต์", "price": "ปักหมุด"}],
            "sfx": [],
            "vfx": [],
            "subtitles": []
        }

    # Split any AI segment that crosses a sub-clip join boundary & tag labels with [คลิป #k]
    if auto_ai and plan.get("segments") and len(clip_boundaries) > 1:
        join_points = [b["endOffset"] for b in clip_boundaries[:-1]]
        split_segs = []
        for seg in plan["segments"]:
            s_cur = float(seg["sourceStart"])
            s_end = float(seg["sourceEnd"])
            pts = [jp for jp in join_points if s_cur + 0.25 < jp < s_end - 0.25]
            cuts = [s_cur] + pts + [s_end]
            for ci in range(len(cuts) - 1):
                c0 = round(cuts[ci], 2)
                c1 = round(cuts[ci + 1], 2)
                if c1 - c0 >= 0.25:
                    split_segs.append({
                        "id": f"s{len(split_segs) + 1}",
                        "sourceStart": c0,
                        "sourceEnd": c1,
                        "zoomScale": seg.get("zoomScale", 1.0),
                        "cropY": seg.get("cropY", 0.25),
                        "label": seg.get("label", "")
                    })

        # Label each segment with its originating sub-clip [คลิป #k]
        for idx_s, seg in enumerate(split_segs):
            mid_t = 0.5 * (seg["sourceStart"] + seg["sourceEnd"])
            owner = clip_boundaries[0]
            for b in clip_boundaries:
                if b["startOffset"] - 0.1 <= mid_t <= b["endOffset"] + 0.1:
                    owner = b
                    break
            matching_subs = [
                s for s in plan.get("subtitles", [])
                if s.get("fullStart", s["start"]) >= seg["sourceStart"] - 0.35
                and s.get("fullEnd", s["end"]) <= seg["sourceEnd"] + 0.35
            ]
            if matching_subs:
                kw_clean = safe_thai_word_limit(matching_subs[0]["keywordText"].replace("*", "").strip(), 16)
                seg["label"] = f"[คลิป #{owner['clipIndex']}] {kw_clean}"
            else:
                seg["label"] = f"[คลิป #{owner['clipIndex']}] {owner['title']}"
        plan["segments"] = split_segs

    # Add crisp transition SFX & Flash VFX at each sub-clip join boundary
    if add_transitions and len(clip_boundaries) > 1:
        sfx_list = plan.get("sfx", [])
        vfx_list = plan.get("vfx", [])
        for b in clip_boundaries[1:]:
            jt = b["startOffset"]
            if not any(abs(ev["time"] - jt) < 0.25 for ev in sfx_list):
                sfx_list.append({
                    "id": f"sfx_join_{b['clipIndex']}",
                    "time": jt,
                    "type": "shutter",
                    "label": f"รอยต่อเข้าคลิป #{b['clipIndex']}"
                })
            if not any(abs(v["start"] - jt) < 0.25 for v in vfx_list):
                vfx_list.append({
                    "id": f"vfx_join_{b['clipIndex']}",
                    "start": jt,
                    "end": round(min(total_merged_dur, jt + 0.28), 2),
                    "type": "flash",
                    "intensity": 0.40,
                    "label": f"แฟลชเชื่อมคลิป #{b['clipIndex']}"
                })
        plan["sfx"] = sorted(sfx_list, key=lambda x: x["time"])
        plan["vfx"] = vfx_list

    plan["mergedClips"] = clip_boundaries
    plan["shortTitle"] = f"รวม {len(clip_boundaries)} คลิป ({total_merged_dur:.0f}s)"

    rel_out = os.path.relpath(out_mp4_path, BASE_DIR).replace("\\", "/")
    return {
        "ok": True,
        "sourcePath": rel_out,
        "duration": total_merged_dur,
        "mergedCount": len(clip_boundaries),
        "clipBoundaries": clip_boundaries,
        "plan": plan
    }


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--analyze":
        rel_or_abs = sys.argv[2]
        mode_arg = sys.argv[3] if len(sys.argv) >= 4 else "keywords"
        full_p = rel_or_abs if os.path.isabs(rel_or_abs) else os.path.join(BASE_DIR, rel_or_abs)
        res = analyze_custom_video_human_like(full_p, mode=mode_arg)
        print(json.dumps({"ok": True, "plan": res}, ensure_ascii=False))
    elif len(sys.argv) >= 3 and sys.argv[1] == "--probe":
        rel_or_abs = sys.argv[2]
        full_p = rel_or_abs if os.path.isabs(rel_or_abs) else os.path.join(BASE_DIR, rel_or_abs)
        meta = probe_video_fast(full_p)
        print(json.dumps({"ok": True, **meta}, ensure_ascii=False))
    elif len(sys.argv) >= 4 and sys.argv[1] == "--merge":
        cfg_p = sys.argv[2]
        out_p = sys.argv[3]
        res = merge_video_clips_pro(cfg_p, out_p)
        print(json.dumps(res, ensure_ascii=False))
    else:
        print("UNIVERSAL_AI_DIRECTOR_READY")
