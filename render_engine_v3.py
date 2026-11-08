import os
import sys
import json
import math
import wave
import subprocess
import numpy as np
import cv2
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_DIR = os.path.join(BASE_DIR, "source_videos")
FONTS_DIR = os.path.join(BASE_DIR, "fonts")
SFX_DIR = os.path.join(BASE_DIR, "sfx")

UPPER_VOWELS = set("\u0e31\u0e34\u0e35\u0e36\u0e37\u0e47\u0e4d")
TONE_MARKS = set("\u0e48\u0e49\u0e4a\u0e4b\u0e4c")
TALL_CONSONANTS = set("ปฝฟฬ")

FONT_MAP = {
    "kanit_black": os.path.join(FONTS_DIR, "Kanit-Black.ttf"),
    "kanit": os.path.join(FONTS_DIR, "Kanit-ExtraBold.ttf"),
    "mitr": os.path.join(FONTS_DIR, "Mitr-Bold.ttf"),
    "prompt": os.path.join(FONTS_DIR, "Prompt-ExtraBold.ttf"),
    "mali": os.path.join(FONTS_DIR, "Mali-Bold.ttf"),
    "itim": os.path.join(FONTS_DIR, "Itim-Regular.ttf"),
}

_FONT_CACHE = {}
def get_font(font_key, size):
    fpath = FONT_MAP.get(font_key, FONT_MAP["kanit"])
    if not os.path.exists(fpath):
        fpath = r"C:\Windows\Fonts\tahomabd.ttf"
    key = (fpath, int(size))
    if key not in _FONT_CACHE:
        _FONT_CACHE[key] = ImageFont.truetype(fpath, int(size))
    return _FONT_CACHE[key]

def hex_to_rgb(hex_str, default=(255, 107, 157)):
    if not hex_str:
        return default
    if isinstance(hex_str, (list, tuple)):
        return tuple(hex_str[:3])
    s = str(hex_str).lstrip("#")
    if len(s) == 6:
        try:
            return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))
        except Exception:
            return default
    return default

# --- THAI SHAPED TEXT RENDERER ---
def split_thai_stacked(text):
    # Strip unsupported raw emoji characters (surrogates / astral plane) so no [] boxes ever appear
    clean_text = "".join(ch for ch in text if ord(ch) < 0x1F000 and ch not in "✨💖🌸🍊🐱🫧📸🛍️📍🔥👑💧☀️🛡️💸💕😳🧸📚🍲🏃‍♀️💨✅🔍👆")
    clean_text = clean_text.strip()
    base_chars = []
    lifted_marks = []
    n = len(clean_text)
    i = 0
    while i < n:
        ch = clean_text[i]
        if ch in TONE_MARKS and (i + 1 < n and clean_text[i + 1] == "\u0e33"):
            prev_cons = base_chars[-1] if base_chars else ""
            x_sh = -0.08 if prev_cons in TALL_CONSONANTS else 0.0
            lifted_marks.append((len(base_chars), ch, 0.24, x_sh))
            i += 1
            continue
        if ch in TONE_MARKS and len(base_chars) >= 1 and base_chars[-1] in UPPER_VOWELS:
            prev_cons = base_chars[-2] if len(base_chars) >= 2 else ""
            x_sh = -0.08 if prev_cons in TALL_CONSONANTS else 0.0
            lifted_marks.append((len(base_chars), ch, 0.23, x_sh))
            i += 1
            continue
        base_chars.append(ch)
        i += 1
    return "".join(base_chars), lifted_marks

def measure_thai_text(draw, text, font):
    base_str, _ = split_thai_stacked(text)
    if not base_str:
        return 0, 0
    bbox = draw.textbbox((0, 0), base_str, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

def draw_thai_shaped(draw, xy, text, font, fill=(255,255,255,255), stroke_width=0, stroke_fill=(0,0,0,255), anchor="mm"):
    base_str, lifted_marks = split_thai_stacked(text)
    if not base_str:
        return
    bbox = draw.textbbox((0, 0), base_str, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x, y = xy
    if anchor == "mm":
        start_x = x - w / 2.0 - bbox[0]
        start_y = y - h / 2.0 - bbox[1]
    elif anchor == "lm":
        start_x = x - bbox[0]
        start_y = y - h / 2.0 - bbox[1]
    elif anchor == "rm":
        start_x = x - w - bbox[0]
        start_y = y - h / 2.0 - bbox[1]
    else:
        start_x, start_y = x, y

    fsize = getattr(font, "size", 40)

    if stroke_width > 0:
        draw.text((start_x, start_y), base_str, font=font, fill=stroke_fill, stroke_width=stroke_width, stroke_fill=stroke_fill)
        for idx, t_ch, y_lift, x_sh in lifted_marks:
            px = draw.textlength(base_str[:idx], font=font)
            draw.text((start_x + px + x_sh * fsize, start_y - y_lift * fsize), t_ch, font=font, fill=stroke_fill, stroke_width=stroke_width, stroke_fill=stroke_fill)

    draw.text((start_x, start_y), base_str, font=font, fill=fill)
    for idx, t_ch, y_lift, x_sh in lifted_marks:
        px = draw.textlength(base_str[:idx], font=font)
        draw.text((start_x + px + x_sh * fsize, start_y - y_lift * fsize), t_ch, font=font, fill=fill)

# --- VECTOR ICON RENDERERS (Zero Tofu!) ---
def draw_sparkle_icon(draw, cx, cy, r, color=(255, 235, 90, 255)):
    pts = []
    for i in range(8):
        ang = i * math.pi / 4.0
        rad = r if i % 2 == 0 else r * 0.28
        pts.append((cx + math.cos(ang) * rad, cy + math.sin(ang) * rad))
    draw.polygon(pts, fill=color)
    draw.ellipse([cx - r*0.18, cy - r*0.18, cx + r*0.18, cy + r*0.18], fill=(255, 255, 255, 255))

def draw_heart_icon(draw, cx, cy, r, color=(255, 95, 150, 255)):
    pts = []
    for deg in range(0, 360, 10):
        t = math.radians(deg)
        px = 16 * (math.sin(t) ** 3)
        py = -(13 * math.cos(t) - 5 * math.cos(2*t) - 2 * math.cos(3*t) - math.cos(4*t))
        pts.append((cx + px * (r / 16.0), cy + py * (r / 16.0)))
    draw.polygon(pts, fill=color, outline=(255, 255, 255, 240))

def draw_check_icon(draw, cx, cy, r, bg_color=(34, 197, 94, 255)):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=bg_color, outline=(255, 255, 255, 255), width=2)
    p1 = (cx - r * 0.42, cy + r * 0.02)
    p2 = (cx - r * 0.10, cy + r * 0.36)
    p3 = (cx + r * 0.46, cy - r * 0.32)
    draw.line([p1, p2, p3], fill=(255, 255, 255, 255), width=max(2, int(r * 0.26)), joint="curve")

def draw_pin_icon(draw, cx, cy, r, color=(244, 63, 94, 255)):
    draw.ellipse([cx - r*0.7, cy - r*0.9, cx + r*0.7, cy + r*0.5], fill=color, outline=(255,255,255,255), width=2)
    draw.polygon([(cx - r*0.55, cy + r*0.15), (cx + r*0.55, cy + r*0.15), (cx, cy + r*1.05)], fill=color)
    draw.ellipse([cx - r*0.28, cy - r*0.48, cx + r*0.28, cy + r*0.08], fill=(255, 255, 255, 255))

# --- SUBTITLE TOKEN PARSER ---
def parse_subtitle_tokens(sub_item, default_color="#FF6B9D"):
    """
    Supports either explicit `tokens` list OR inline `*คำสำคัญ*` syntax!
    """
    if "tokens" in sub_item and isinstance(sub_item["tokens"], list) and len(sub_item["tokens"]) > 0:
        return sub_item["tokens"]
    raw_text = sub_item.get("text", "")
    # Parse *highlighted* segments or space-separated tokens
    tokens = []
    parts = raw_text.split("*")
    palette = ["#FF5A96", "#FFE600", "#5CE1E6", "#FF8A00", "#70FF94"]
    hi_idx = 0
    for idx, part in enumerate(parts):
        part_clean = part.strip()
        if not part_clean:
            continue
        is_hi = (idx % 2 == 1)
        if is_hi:
            col = sub_item.get("highlightColor") or palette[hi_idx % len(palette)]
            tokens.append({
                "text": part_clean,
                "highlight": True,
                "color": col,
                "pill": (hi_idx == 0 and sub_item.get("usePill", True))
            })
            hi_idx += 1
        else:
            for w in part_clean.split():
                tokens.append({
                    "text": w,
                    "highlight": False,
                    "color": "#FFFFFF",
                    "pill": False
                })
    return tokens

# --- DRAW MULTI-TOKEN KINETIC SUBTITLE ---
def draw_kinetic_subtitle(draw, target_w, target_h, sub_item, cur_t, style_cfg):
    tokens = parse_subtitle_tokens(sub_item)
    if not tokens:
        return

    font_family = style_cfg.get("fontFamily", "kanit")
    base_size = int(style_cfg.get("fontSize", 42) * (target_w / 720.0))
    hi_size = int(base_size * 1.24)

    # Calculate active spoken token index based on exact wordTimings (or fallback linear progress)
    sub_dur = max(0.2, sub_item["end"] - sub_item["start"])
    rel_p = max(0.0, min(0.999, (cur_t - sub_item["start"]) / sub_dur))
    active_idx = int(rel_p * len(tokens))
    word_timings = sub_item.get("wordTimings")
    if isinstance(word_timings, list) and len(word_timings) == len(tokens):
        exact_idx = -1
        for i_wt, wt in enumerate(word_timings):
            if float(wt.get("start", 0.0)) - 0.03 <= cur_t <= float(wt.get("end", 0.0)) + 0.03:
                exact_idx = i_wt
                break
        if exact_idx != -1:
            active_idx = exact_idx
        else:
            last_p = 0
            for i_wt, wt in enumerate(word_timings):
                if cur_t >= float(wt.get("start", 0.0)) - 0.02:
                    last_p = i_wt
            active_idx = last_p

    # Entrance pop animation (first 0.16s of subtitle) controlled by sub_item["subZoom"]
    sub_zoom_target = float(sub_item.get("subZoom", style_cfg.get("defaultSubZoom", 1.24)))
    age = cur_t - sub_item["start"]
    entrance_scale = 1.0
    if sub_zoom_target > 1.01 and age < 0.18:
        p = age / 0.18
        # Smooth human-like spring pop from 0.85 -> sub_zoom_target -> 1.0
        entrance_scale = 0.85 + (sub_zoom_target - 0.85) * math.sin(p * math.pi * 0.82)
    elif sub_zoom_target > 1.01:
        # Hold slight emphasis scale if subZoom > 1.25
        entrance_scale = 1.0 + max(0.0, (sub_zoom_target - 1.20) * 0.35)

    # Split tokens into 1 or 2 balanced lines if width exceeds 86% of canvas
    lines = []
    cur_line = []
    cur_w = 0
    max_line_w = target_w * 0.84
    f_test_norm = get_font(font_family, base_size)
    f_test_hi = get_font("kanit_black" if font_family == "kanit" else font_family, hi_size)

    for idx, tk in enumerate(tokens):
        tk_copy = dict(tk)
        tk_copy["_idx"] = idx
        f = f_test_hi if tk_copy.get("highlight") else f_test_norm
        tw, _ = measure_thai_text(draw, tk_copy["text"], f)
        if tk_copy.get("pill"):
            tw += 28
        if cur_line and (cur_w + tw + 16 > max_line_w) and len(lines) < 1:
            lines.append(cur_line)
            cur_line = [tk_copy]
            cur_w = tw
        else:
            cur_line.append(tk_copy)
            cur_w += tw + 16
    if cur_line:
        lines.append(cur_line)

    base_y = int(target_h * style_cfg.get("subYRatio", 0.83))
    line_gap = int(base_size * 1.48)
    start_line_y = base_y - ((len(lines) - 1) * line_gap) // 2

    for line_i, line_tokens in enumerate(lines):
        cy = start_line_y + line_i * line_gap
        spacing = int(14 * (target_w / 720.0))
        measured = []
        total_w = 0

        for tk in line_tokens:
            is_active = (tk["_idx"] == active_idx)
            is_hi = bool(tk.get("highlight"))
            scale_mult = entrance_scale * (1.10 if is_active else 1.0)
            f_sz = int((hi_size if is_hi else base_size) * scale_mult)
            f_key = ("kanit_black" if font_family == "kanit" and is_hi else font_family)
            font_obj = get_font(f_key, f_sz)
            w, h = measure_thai_text(draw, tk["text"], font_obj)
            if tk.get("pill"):
                w += int(30 * (target_w / 720.0))
            measured.append((tk, font_obj, w, h, is_active, is_hi))
            total_w += w
        total_w += spacing * max(0, len(line_tokens) - 1)

        cur_x = (target_w - total_w) // 2
        for tk, font_obj, w, h, is_active, is_hi in measured:
            cx = cur_x + w // 2
            y_offset = -5 if is_active else 0
            draw_y = cy + y_offset
            rgb_col = hex_to_rgb(tk.get("color"), (255, 90, 150) if is_hi else (255, 255, 255))

            if tk.get("pill"):
                pad_y = int(base_size * 0.68)
                # Drop shadow
                draw.rounded_rectangle([cur_x - 2, draw_y - pad_y + 5, cur_x + w + 2, draw_y + pad_y + 5], radius=16, fill=(0, 0, 0, 175))
                # Pill body
                draw.rounded_rectangle([cur_x, draw_y - pad_y, cur_x + w, draw_y + pad_y], radius=16, fill=(*rgb_col, 250), outline=(255, 255, 255, 255), width=3)
                # Determine dark vs white text on pill based on luminance
                lum = 0.299 * rgb_col[0] + 0.587 * rgb_col[1] + 0.114 * rgb_col[2]
                txt_fill = (20, 20, 25, 255) if lum > 175 else (255, 255, 255, 255)
                st_fill = (255, 255, 255, 255) if lum > 175 else (20, 10, 18, 255)
                draw_thai_shaped(draw, (cx, draw_y), tk["text"], font_obj, fill=txt_fill, stroke_width=4, stroke_fill=st_fill, anchor="mm")
                draw_sparkle_icon(draw, cur_x + w - 4, draw_y - pad_y + 4, 10, (255, 240, 110, 255))
            elif is_hi:
                # Shadow layer
                draw_thai_shaped(draw, (cx + 3, draw_y + 5), tk["text"], font_obj, fill=(0, 0, 0, 200), stroke_width=10, stroke_fill=(0, 0, 0, 200), anchor="mm")
                # Main highlighted word
                draw_thai_shaped(draw, (cx, draw_y), tk["text"], font_obj, fill=(*rgb_col, 255), stroke_width=9, stroke_fill=(15, 15, 20, 255), anchor="mm")
                if is_active:
                    draw_sparkle_icon(draw, cx + w // 2 + 4, draw_y - int(base_size * 0.55), 9, (255, 255, 255, 255))
            else:
                # Crisp white word with thick dark stroke
                txt_col = (255, 250, 190, 255) if is_active else (255, 255, 255, 255)
                draw_thai_shaped(draw, (cx + 2, draw_y + 4), tk["text"], font_obj, fill=(0, 0, 0, 185), stroke_width=8, stroke_fill=(0, 0, 0, 185), anchor="mm")
                draw_thai_shaped(draw, (cx, draw_y), tk["text"], font_obj, fill=txt_col, stroke_width=7, stroke_fill=(15, 15, 20, 255), anchor="mm")

            cur_x += w + spacing

_STICKER_CACHE = {}

def get_sticker_img(stk_type):
    if stk_type not in _STICKER_CACHE:
        p = os.path.join(BASE_DIR, "stickers", f"{stk_type}.png")
        if os.path.exists(p):
            try:
                _STICKER_CACHE[stk_type] = Image.open(p).convert("RGBA")
            except Exception:
                _STICKER_CACHE[stk_type] = None
        else:
            _STICKER_CACHE[stk_type] = None
    return _STICKER_CACHE[stk_type]

def draw_kinetic_sticker(overlay_img, target_w, target_h, stk, cur_t):
    stk_type = stk.get("type", "fire")
    simg = get_sticker_img(stk_type)
    if simg is None:
        return
    
    age = cur_t - stk.get("start", 0.0)
    anim = stk.get("animation", "pop")
    scale = float(stk.get("scale", 1.0))

    if anim == "pop" and age < 0.25:
        p = age / 0.25
        bounce = 0.5 + 0.6 * math.sin(p * math.pi * 0.85)
        scale *= bounce
    elif anim == "bounce":
        scale *= (1.0 + 0.08 * math.sin(age * 8.0))

    base_w = int(140 * (target_w / 720.0) * scale)
    base_h = int(140 * (target_w / 720.0) * scale)
    if base_w <= 8 or base_h <= 8:
        return

    rel_x = float(stk.get("x", 0.82))
    rel_y = float(stk.get("y", 0.32))
    cx = int(rel_x * target_w)
    cy = int(rel_y * target_h)

    resized = simg.resize((base_w, base_h), Image.Resampling.LANCZOS)
    if anim == "wiggle":
        rot = math.sin(age * 12.0) * 8.0
        resized = resized.rotate(rot, resample=Image.Resampling.BICUBIC, expand=True)

    rw, rh = resized.size
    px = cx - rw // 2
    py = cy - rh // 2

    overlay_img.alpha_composite(resized, (max(0, px), max(0, py)))

# --- AUDIO MIXER WITH SAMPLE-ACCURATE SEGMENT STITCHING & SFX ---
def build_mixed_audio(in_video_path, segments, sfx_events, out_wav_path):
    temp_full_wav = out_wav_path + ".full.wav"
    sr = 44100
    subprocess.run([FFMPEG_EXE, "-y", "-i", in_video_path, "-ar", str(sr), "-ac", "2", temp_full_wav], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    if os.path.exists(temp_full_wav):
        with wave.open(temp_full_wav, "rb") as wf:
            n_frames = wf.getnframes()
            raw = np.frombuffer(wf.readframes(n_frames), dtype=np.int16).astype(np.float32) / 32768.0
            raw = raw.reshape(-1, 2)
        os.remove(temp_full_wav)
    else:
        raw = np.zeros((sr * 10, 2), dtype=np.float32)

    # Extract and concatenate audio segments with 12ms smooth cosine crossfade
    seg_arrays = []
    fade_samples = int(0.012 * sr)
    for seg in segments:
        if seg.get("deleted") or seg.get("muted"):
            if not seg.get("deleted") and seg.get("muted"):
                dur_s = max(0.05, seg["sourceEnd"] - seg["sourceStart"])
                seg_arrays.append(np.zeros((int(dur_s * sr), 2), dtype=np.float32))
            continue
        s_idx = max(0, int(seg["sourceStart"] * sr))
        e_idx = min(len(raw), int(seg["sourceEnd"] * sr))
        chunk = raw[s_idx:e_idx].copy()
        if len(chunk) > fade_samples * 2:
            fade_in = np.linspace(0.0, 1.0, fade_samples)[:, None]
            fade_out = np.linspace(1.0, 0.0, fade_samples)[:, None]
            chunk[:fade_samples] *= fade_in
            chunk[-fade_samples:] *= fade_out
        seg_arrays.append(chunk)

    if seg_arrays:
        timeline_audio = np.vstack(seg_arrays)
    else:
        timeline_audio = raw

    # Normalize speech softly so dialogue is punchy and clear
    peak = np.max(np.abs(timeline_audio))
    if peak > 0.05:
        timeline_audio = timeline_audio * min(1.35, 0.88 / peak)

    # Mix SFX events on timeline time
    for ev in sfx_events:
        sfx_name = ev.get("type", "pop")
        if not sfx_name.endswith(".wav"):
            sfx_name += ".wav"
        sfx_path = os.path.join(SFX_DIR, sfx_name)
        if not os.path.exists(sfx_path):
            continue
        with wave.open(sfx_path, "rb") as swf:
            sn = swf.getnframes()
            sdata = np.frombuffer(swf.readframes(sn), dtype=np.int16).astype(np.float32) / 32768.0
            if swf.getnchannels() == 1:
                sdata = np.column_stack([sdata, sdata])
            else:
                sdata = sdata.reshape(-1, swf.getnchannels())[:, :2]
        vol = float(ev.get("volume", 0.55))
        start_sample = int(float(ev.get("time", 0.0)) * sr)
        if 0 <= start_sample < len(timeline_audio):
            end_sample = min(len(timeline_audio), start_sample + len(sdata))
            timeline_audio[start_sample:end_sample] += sdata[:end_sample - start_sample] * vol

    timeline_audio = np.clip(timeline_audio, -1.0, 1.0)
    pcm16 = (timeline_audio * 32767.0).astype(np.int16)
    with wave.open(out_wav_path, "wb") as out_wf:
        out_wf.setnchannels(2)
        out_wf.setsampwidth(2)
        out_wf.setframerate(sr)
        out_wf.writeframes(pcm16.tobytes())

# --- MAIN VIDEO COMPOSITOR & RENDERER ---
def render_project(project_cfg, out_mp4_path):
    in_video = project_cfg["sourcePath"]
    if not os.path.isabs(in_video):
        in_video = os.path.join(BASE_DIR, in_video)

    ratio = project_cfg.get("aspectRatio", "3:4")
    ratio_dims = {
        "3:4": (720, 960),
        "9:16": (720, 1280),
        "1:1": (720, 720),
        "16:9": (960, 540),
    }
    target_w, target_h = ratio_dims.get(ratio, (720, 960))
    fit_mode = project_cfg.get("fitMode", "fill") # 'fill' (Full-bleed 3:4) or 'fit' (Blurred frame)

    cap = cv2.VideoCapture(in_video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_src_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    src_dur = total_src_frames / fps

    segments = [s for s in project_cfg.get("segments", []) if not s.get("deleted")]
    if not segments:
        segments = [{"sourceStart": 0.0, "sourceEnd": src_dur, "zoomScale": 1.0, "cropY": 0.35}]

    temp_vid = out_mp4_path + ".temp_v.mp4"
    temp_wav = out_mp4_path + ".temp_a.wav"

    cmd = [
        FFMPEG_EXE, "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{target_w}x{target_h}",
        "-pix_fmt", "bgr24",
        "-r", str(fps),
        "-i", "-",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        temp_vid
    ]
    pipe = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)

    style_cfg = project_cfg.get("style", {})
    font_family = style_cfg.get("fontFamily", "kanit")
    accent_rgb = hex_to_rgb(style_cfg.get("accentColor", "#FF5A96"))

    timeline_t = 0.0
    dt = 1.0 / fps

    for seg_idx, seg in enumerate(segments):
        s_start = max(0.0, float(seg["sourceStart"]))
        s_end = min(src_dur, float(seg["sourceEnd"]))
        if s_end <= s_start:
            continue

        cap.set(cv2.CAP_PROP_POS_MSEC, s_start * 1000.0)
        n_seg_frames = int((s_end - s_start) * fps)
        seg_base_zoom = float(seg.get("zoomScale", 1.0))
        seg_crop_y = float(seg.get("cropY", project_cfg.get("defaultCropY", 0.35)))

        for f_i in range(n_seg_frames):
            ret, frame = cap.read()
            if not ret:
                break

            src_t = s_start + f_i * dt

            # 1. Calculate dynamic Punch-Zoom / Smooth-Zoom
            zoom = seg_base_zoom
            for z in project_cfg.get("zooms", []):
                zt_mode = z.get("timeMode", "source")
                ref_t = timeline_t if zt_mode == "timeline" else src_t
                if z["start"] <= ref_t <= z["end"]:
                    zdur = max(0.2, z["end"] - z["start"])
                    rel = ref_t - z["start"]
                    z_style = z.get("mode", "smooth")
                    in_ramp = 0.09 if z_style == "punch" else 0.24
                    out_ramp = 0.16 if z_style == "punch" else 0.28
                    if rel < in_ramp:
                        ease = 0.5 - 0.5 * math.cos(math.pi * (rel / in_ramp))
                    elif rel > zdur - out_ramp:
                        ease = 0.5 - 0.5 * math.cos(math.pi * ((zdur - rel) / out_ramp))
                    else:
                        ease = 1.0
                    zoom = max(zoom, 1.0 + (float(z.get("scale", 1.25)) - 1.0) * ease)
                    break

            # 2. Frame into Target Aspect Ratio (3:4 Smart Fill vs Blur Fit)
            if fit_mode == "fill":
                scale = max(target_w / orig_w, target_h / orig_h) * zoom
                nw, nh = int(orig_w * scale), int(orig_h * scale)
                resized = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_LINEAR)
                x0 = (nw - target_w) // 2
                y0 = int((nh - target_h) * max(0.0, min(1.0, seg_crop_y)))
                canvas_bgr = resized[y0:y0 + target_h, x0:x0 + target_w].copy()
            else:
                bg = cv2.resize(frame, (target_w, target_h))
                bg = cv2.GaussianBlur(bg, (45, 45), 0)
                bg = (bg * 0.55).astype(np.uint8)
                scale = min(target_w / orig_w, target_h / orig_h) * zoom
                fg_w, fg_h = int(orig_w * scale), int(orig_h * scale)
                fg = cv2.resize(frame, (fg_w, fg_h), interpolation=cv2.INTER_LINEAR)
                # Center crop or place
                canvas_bgr = bg
                x0 = (target_w - fg_w) // 2
                y0 = (target_h - fg_h) // 2
                cx1, cy1 = max(0, x0), max(0, y0)
                cx2, cy2 = min(target_w, x0 + fg_w), min(target_h, y0 + fg_h)
                fx1, fy1 = cx1 - x0, cy1 - y0
                canvas_bgr[cy1:cy2, cx1:cx2] = fg[fy1:fy1 + (cy2 - cy1), fx1:fx1 + (cx2 - cx1)]

            # 2B. Apply Visual Effects (vfx: warm_glow, flash, vignette)
            for vfx in project_cfg.get("vfx", []):
                if vfx["start"] <= src_t <= vfx["end"]:
                    vtype = vfx.get("type", "warm_glow")
                    inten = float(vfx.get("intensity", 0.35))
                    if vtype == "warm_glow":
                        # Soft warm beauty glow
                        blur_g = cv2.GaussianBlur(canvas_bgr, (0, 0), 15)
                        canvas_bgr = cv2.addWeighted(canvas_bgr, 1.0, blur_g, inten * 0.55, 6 * inten)
                    elif vtype == "flash":
                        vdur = max(0.1, vfx["end"] - vfx["start"])
                        vp = 1.0 - ((src_t - vfx["start"]) / vdur)
                        alpha_f = max(0.0, min(0.85, vp * inten))
                        white_f = np.full_like(canvas_bgr, 255)
                        canvas_bgr = cv2.addWeighted(canvas_bgr, 1.0 - alpha_f, white_f, alpha_f, 0)
                    elif vtype == "cyber_glow":
                        blur_c = cv2.GaussianBlur(canvas_bgr, (0, 0), 21)
                        cyan_tint = np.zeros_like(canvas_bgr)
                        cyan_tint[:, :, 0] = 255
                        cyan_tint[:, :, 1] = 200
                        canvas_bgr = cv2.addWeighted(canvas_bgr, 1.0, blur_c, inten * 0.40, 0)
                        canvas_bgr = cv2.addWeighted(canvas_bgr, 1.0, cyan_tint, inten * 0.12, 0)
                    elif vtype == "vignette_dark":
                        h_v, w_v = canvas_bgr.shape[:2]
                        Y, X = np.ogrid[:h_v, :w_v]
                        dist = np.sqrt((X - w_v / 2) ** 2 + (Y - h_v / 2) ** 2)
                        max_dist = np.sqrt((w_v / 2) ** 2 + (h_v / 2) ** 2)
                        vign_mask = np.clip(1.0 - (dist / max_dist) * inten * 1.5, 0.25, 1.0)[:, :, None]
                        canvas_bgr = (canvas_bgr * vign_mask).astype(np.uint8)

            # Subtle bottom gradient vignette so subtitles are 100% readable on any background
            vignette_h = int(target_h * 0.24)
            grad = np.linspace(1.0, 0.62, vignette_h, dtype=np.float32)[:, None, None]
            canvas_bgr[target_h - vignette_h:] = (canvas_bgr[target_h - vignette_h:].astype(np.float32) * grad).astype(np.uint8)

            # 3. PIL RGBA Overlay for Hook Banner, Product Pin, and Kinetic Subtitles
            rgb = cv2.cvtColor(canvas_bgr, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb).convert("RGBA")
            ov = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(ov)

            # 3A. Top Hook Pill Banner
            hook_text = project_cfg.get("hookText", "")
            hook_dur = float(project_cfg.get("hookDuration", 999.0))
            if hook_text and timeline_t <= hook_dur:
                f_hook = get_font("mitr" if font_family == "mitr" else "kanit", int(23 * (target_w / 720.0)))
                hw, hh = measure_thai_text(draw, hook_text, f_hook)
                box_w = min(target_w - 40, hw + 76)
                box_h = int(46 * (target_w / 720.0))
                hx = (target_w - box_w) // 2
                hy = int(28 * (target_h / 960.0))
                # Soft shadow
                draw.rounded_rectangle([hx, hy + 4, hx + box_w, hy + box_h + 4], radius=23, fill=(0, 0, 0, 125))
                # White/Frosted pill with colored border
                draw.rounded_rectangle([hx, hy, hx + box_w, hy + box_h], radius=23, fill=(255, 255, 255, 242), outline=(*accent_rgb, 255), width=3)
                draw_sparkle_icon(draw, hx + 22, hy + box_h // 2, 9, (*accent_rgb, 255))
                draw_sparkle_icon(draw, hx + box_w - 22, hy + box_h // 2, 9, (*accent_rgb, 255))
                draw_thai_shaped(draw, (target_w // 2, hy + box_h // 2), hook_text, f_hook, fill=(20, 20, 25, 255), anchor="mm")

            # 3B. Floating Product Pin Tag
            for pin in project_cfg.get("pins", []):
                p_mode = pin.get("timeMode", "source")
                ref_t = timeline_t if p_mode == "timeline" else src_t
                if pin["start"] <= ref_t <= pin["end"]:
                    f_pin = get_font("kanit", int(20 * (target_w / 720.0)))
                    p_title = pin.get("title", "")
                    p_price = pin.get("price", "")
                    tw1, _ = measure_thai_text(draw, p_title, f_pin)
                    tw2, _ = measure_thai_text(draw, p_price, f_pin)
                    pw = tw1 + tw2 + 86
                    ph = 44
                    px = 28
                    py = int(88 * (target_h / 960.0))
                    draw.rounded_rectangle([px, py + 3, px + pw, py + ph + 3], radius=14, fill=(0, 0, 0, 140))
                    draw.rounded_rectangle([px, py, px + pw, py + ph], radius=14, fill=(20, 20, 24, 235), outline=(255, 255, 255, 230), width=2)
                    draw_pin_icon(draw, px + 22, py + ph // 2, 10, (*accent_rgb, 255))
                    draw_thai_shaped(draw, (px + 40, py + ph // 2), p_title, f_pin, fill=(255, 255, 255, 255), anchor="lm")
                    # Price badge
                    pr_x = px + 48 + tw1
                    draw.rounded_rectangle([pr_x, py + 7, px + pw - 10, py + ph - 7], radius=9, fill=(*accent_rgb, 255))
                    draw_thai_shaped(draw, (pr_x + (px + pw - 10 - pr_x)//2, py + ph // 2), p_price, f_pin, fill=(255, 255, 255, 255), anchor="mm")
                    break

            # 3C. Kinetic Word-Highlighted Subtitles
            for sub in project_cfg.get("subtitles", []):
                s_mode = sub.get("timeMode", "source")
                ref_t = timeline_t if s_mode == "timeline" else src_t
                if sub["start"] <= ref_t <= sub["end"]:
                    draw_kinetic_subtitle(draw, target_w, target_h, sub, ref_t, style_cfg)
                    break

            # 3D. Kinetic Viral Stickers & Mascots
            for stk in project_cfg.get("stickers", []):
                s_mode = stk.get("timeMode", "source")
                ref_t = timeline_t if s_mode == "timeline" else src_t
                if stk["start"] <= ref_t <= stk["end"]:
                    draw_kinetic_sticker(ov, target_w, target_h, stk, ref_t)

            comp = Image.alpha_composite(pil_img, ov).convert("RGB")
            pipe.stdin.write(cv2.cvtColor(np.array(comp), cv2.COLOR_RGB2BGR).tobytes())
            timeline_t += dt

    cap.release()
    pipe.stdin.close()
    pipe.wait()

    # 4. Build Mixed Audio & Mux into Final MP4
    build_mixed_audio(in_video, segments, project_cfg.get("sfx", []), temp_wav)
    subprocess.run([
        FFMPEG_EXE, "-y",
        "-i", temp_vid,
        "-i", temp_wav,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        out_mp4_path
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for tf in [temp_vid, temp_wav]:
        if os.path.exists(tf):
            try:
                os.remove(tf)
            except Exception:
                pass
    return out_mp4_path

# --- DEFAULT 3 VIRAL PROJECTS (PRE-CONFIGURED FOR THE 3 UPLOADED VIDEOS) ---
DEFAULT_PROJECTS = {
    "1": {
        "id": "1",
        "title": "คลิป 1: One Day With Me ฉีดน้ำหอมไปเรียน",
        "sourcePath": "source_videos/video1_oneday_vlog.mp4",
        "outputFile": "ผลงานตัดต่อ_วิดีโอ1_OneDayVlog_3x4.mp4",
        "aspectRatio": "3:4",
        "fitMode": "fill",
        "defaultCropY": 0.30,
        "hookText": "One Day With Me  •  ฉีดน้ำหอมไปเรียน",
        "hookDuration": 56.0,
        "style": {
            "preset": "meowmaew_pink",
            "fontFamily": "kanit",
            "fontSize": 43,
            "accentColor": "#FF5A96",
            "subYRatio": 0.83
        },
        "segments": [
            {"id": "s1", "sourceStart": 0.0, "sourceEnd": 14.3, "zoomScale": 1.0, "cropY": 0.28, "label": "ฉีดน้ำหอม Madame Fin ก่อนไปเรียน"},
            {"id": "s2", "sourceStart": 15.1, "sourceEnd": 24.6, "zoomScale": 1.0, "cropY": 0.32, "label": "รีบวิ่งเข้าเรียน & ทำงานกลุ่ม"},
            {"id": "s3", "sourceStart": 24.6, "sourceEnd": 31.6, "zoomScale": 1.0, "cropY": 0.28, "label": "เลิกเรียน ถามเพื่อนว่าตัวหอมไหม"},
            {"id": "s4", "sourceStart": 31.6, "sourceEnd": 45.5, "zoomScale": 1.0, "cropY": 0.32, "label": "กินหมาล่าทั่ง & เดินตลาดนัด"},
            {"id": "s5", "sourceStart": 45.5, "sourceEnd": 55.6, "zoomScale": 1.0, "cropY": 0.30, "label": "กลับห้อง 3 ทุ่มครึ่ง กลิ่นยังติดทน"}
        ],
        "zooms": [
            {"id": "z1", "start": 3.5, "end": 6.8, "scale": 1.24, "timeMode": "source"},
            {"id": "z2", "start": 15.3, "end": 17.8, "scale": 1.25, "timeMode": "source"},
            {"id": "z3", "start": 28.0, "end": 31.4, "scale": 1.26, "timeMode": "source"},
            {"id": "z4", "start": 49.2, "end": 54.5, "scale": 1.25, "timeMode": "source"}
        ],
        "pins": [
            {"id": "p1", "start": 2.5, "end": 11.0, "title": "Madame Fin กลิ่น Shine On", "price": "หอมติดทน", "timeMode": "source"},
            {"id": "p2", "start": 49.0, "end": 55.5, "title": "น้ำหอม Madame Fin", "price": "พิกัดตะกร้า", "timeMode": "source"}
        ],
        "sfx": [
            {"time": 0.3, "type": "pop", "volume": 0.55},
            {"time": 3.5, "type": "sparkle", "volume": 0.65},
            {"time": 14.3, "type": "shutter", "volume": 0.55},
            {"time": 27.5, "type": "sparkle", "volume": 0.65},
            {"time": 31.0, "type": "pop", "volume": 0.50},
            {"time": 48.4, "type": "sparkle", "volume": 0.65}
        ],
        "subtitles": [
            {"id": "sub1", "start": 0.0, "end": 3.5, "text": "*One Day With Me* วันนี้ไปเรียนกัน!"},
            {"id": "sub2", "start": 3.5, "end": 7.0, "text": "ฉีดน้ำหอม *Madame Fin* กลิ่น *Shine On*"},
            {"id": "sub3", "start": 7.0, "end": 10.5, "text": "กลิ่น *หอมสดชื่น* หวานนิดๆ *ฟรุ๊ตตี้*"},
            {"id": "sub4", "start": 10.5, "end": 14.3, "text": "ไม่หวานเลี่ยน *ฉีดได้ทุกวัน* ไปเรียนกัน!"},
            {"id": "sub5", "start": 15.1, "end": 17.8, "text": "ตัดภาพมาคือ *รีบวิ่งมาก!* เพราะจะสายแล้ว"},
            {"id": "sub6", "start": 17.8, "end": 21.2, "text": "*โชคดีที่ยังทัน!* อาจารย์ให้ทำงานกลุ่ม"},
            {"id": "sub7", "start": 21.2, "end": 24.6, "text": "เกือบ *4 โมงเย็น* แล้ว นั่งทำงานต่อยาวๆ"},
            {"id": "sub8", "start": 24.6, "end": 28.0, "text": "เลิกเรียนแล้ว! มาถามเพื่อนว่า *ตัวหอมไหม?*"},
            {"id": "sub9", "start": 28.0, "end": 31.6, "text": "เพื่อนบอก *ตัวหอมมาก!* ฉีดตั้งแต่เช้าแล้วนะ"},
            {"id": "sub10", "start": 31.6, "end": 35.5, "text": "แวะมากิน *หมาล่าทั่ง* ร้านนี้ *อร่อยมากกก*"},
            {"id": "sub11", "start": 35.5, "end": 41.8, "text": "มาเดิน *ตลาดนัด* กันต่อ เกือบ *ทุ่มครึ่งแล้ว*"},
            {"id": "sub12", "start": 41.8, "end": 45.5, "text": "เพื่อนยังทักว่า *ตัวหอมอยู่เลย* ขนาดทั้งวัน!"},
            {"id": "sub13", "start": 45.5, "end": 49.0, "text": "กลับมาถึงห้อง *3 ทุ่มครึ่ง* แล้วทุกคน"},
            {"id": "sub14", "start": 49.0, "end": 52.5, "text": "ตัวยังหอมอยู่เลย *กลิ่นติดทนมาก!*"},
            {"id": "sub15", "start": 52.5, "end": 55.6, "text": "ต้องลอง *Madame Fin* กลิ่น *Shine On* เลย!"}
        ]
    },
    "2": {
        "id": "2",
        "title": "คลิป 2: รีวิวกันแดด Nivea Sun C&E หน้าไบร์ท",
        "sourcePath": "source_videos/video2_nivea_sun.mp4",
        "outputFile": "ผลงานตัดต่อ_วิดีโอ2_NiveaSun_3x4.mp4",
        "aspectRatio": "3:4",
        "fitMode": "fill",
        "defaultCropY": 0.28,
        "hookText": "ป้ายยากันแดดส้มหน้าไบร์ท  •  2 แบงค์เขียวมีทอน!",
        "hookDuration": 36.2,
        "style": {
            "preset": "nivea_beauty",
            "fontFamily": "kanit",
            "fontSize": 43,
            "accentColor": "#FF7A00",
            "subYRatio": 0.85
        },
        "segments": [
            {"id": "s1", "sourceStart": 0.0, "sourceEnd": 7.0, "zoomScale": 1.0, "cropY": 0.25, "label": "Hook โดนแดดบ่อย ลง Nivea Sun C&E"},
            {"id": "s2", "sourceStart": 7.0, "sourceEnd": 17.5, "zoomScale": 1.0, "cropY": 0.25, "label": "เทสต์เนื้อเซรั่ม บางเบา ซึมไว"},
            {"id": "s3", "sourceStart": 17.5, "sourceEnd": 28.0, "zoomScale": 1.0, "cropY": 0.28, "label": "SPF50+ PA++++ ราคา 2 แบงค์เขียวมีทอน"},
            {"id": "s4", "sourceStart": 28.0, "sourceEnd": 36.1, "zoomScale": 1.0, "cropY": 0.28, "label": "สรุปป้ายยากันแดดนีเวียส้ม (ตัด Endscreen ทิ้ง)"}
        ],
        "zooms": [
            {"id": "z1", "start": 3.5, "end": 6.8, "scale": 1.22, "timeMode": "source"},
            {"id": "z2", "start": 9.5, "end": 13.5, "scale": 1.24, "timeMode": "source"},
            {"id": "z3", "start": 24.8, "end": 28.0, "scale": 1.26, "timeMode": "source"}
        ],
        "pins": [
            {"id": "p1", "start": 3.2, "end": 10.5, "title": "Nivea Sun C&E Serum", "price": "SPF50+", "timeMode": "source"},
            {"id": "p2", "start": 24.5, "end": 35.8, "title": "กันแดดนีเวียส้มหน้าไบร์ท", "price": "2 แบงค์เขียวมีทอน", "timeMode": "source"}
        ],
        "sfx": [
            {"time": 0.3, "type": "pop", "volume": 0.55},
            {"time": 3.6, "type": "sparkle", "volume": 0.65},
            {"time": 9.8, "type": "shutter", "volume": 0.50},
            {"time": 18.0, "type": "sparkle", "volume": 0.60},
            {"time": 25.0, "type": "pop", "volume": 0.65},
            {"time": 32.0, "type": "sparkle", "volume": 0.65}
        ],
        "subtitles": [
            {"id": "sub1", "start": 0.0, "end": 3.5, "text": "ช่วงนี้ *โดนแดดบ่อยมาก* กลัวผิวหมองคล้ำ!"},
            {"id": "sub2", "start": 3.5, "end": 7.0, "text": "เลยมาลง *Nivea Sun C&E* กันแดดส้ม *หน้าไบร์ท*"},
            {"id": "sub3", "start": 7.0, "end": 10.5, "text": "เนื้อเซรั่ม *บางเบา ซึมไว* ใช้ได้ทุกวัน"},
            {"id": "sub4", "start": 10.5, "end": 14.0, "text": "*สบายผิวมาก* ช่วยลดจุดดำ *ฝ้าแดด*"},
            {"id": "sub5", "start": 14.0, "end": 17.5, "text": "*ผิวกระจ่างใส* ใน 7 วัน มีไวท์เทนนิ่ง *5 ชนิด*"},
            {"id": "sub6", "start": 17.5, "end": 21.0, "text": "ใช้แล้ว *หน้าใสขึ้นจริง* มี *SPF50+ PA++++*"},
            {"id": "sub7", "start": 21.0, "end": 24.6, "text": "ปกป้องผิวจาก *UVA UVB* และ *แสงสีฟ้า*"},
            {"id": "sub8", "start": 24.6, "end": 28.2, "text": "ราคาหลักสิบ *2 แบงค์เขียวมีทอน!*"},
            {"id": "sub9", "start": 28.2, "end": 31.8, "text": "ใครหากันแดดที่ *ปกป้องผิว* พร้อมบำรุง"},
            {"id": "sub10", "start": 31.8, "end": 36.0, "text": "ต้องลอง *กันแดดนีเวียส้ม* *หน้าไบร์ท* เลย!"}
        ]
    },
    "3": {
        "id": "3",
        "title": "คลิป 3: OOTD ป้ายยาเอี๊ยมยีนส์ Nineties Design",
        "sourcePath": "source_videos/video3_lifestyle_couple.mp4",
        "outputFile": "ผลงานตัดต่อ_วิดีโอ3_CoupleVlog_3x4.mp4",
        "aspectRatio": "3:4",
        "fitMode": "fill",
        "defaultCropY": 0.35,
        "hookText": "OOTD ป้ายยาเอี๊ยมยีนส์สุดคิ้วท์  •  Nineties Design",
        "hookDuration": 21.0,
        "style": {
            "preset": "ootd_pastel",
            "fontFamily": "mitr",
            "fontSize": 42,
            "accentColor": "#FF6B9D",
            "subYRatio": 0.84
        },
        "segments": [
            {"id": "s1", "sourceStart": 0.5, "sourceEnd": 7.2, "zoomScale": 1.0, "cropY": 0.35, "label": "โพสท่าโชว์ทรงเอี๊ยมยีนส์ OOTD"},
            {"id": "s2", "sourceStart": 7.2, "sourceEnd": 14.2, "zoomScale": 1.0, "cropY": 0.40, "label": "ซูมดีเทลสายปรับได้ & กระเป๋าหน้า"},
            {"id": "s3", "sourceStart": 14.2, "sourceEnd": 20.6, "zoomScale": 1.0, "cropY": 0.32, "label": "หมุนตัวโชว์ทรง ใส่แล้วน่ารักมาก (ตัดนิ้วบังกล้องท้ายคลิป)"}
        ],
        "zooms": [
            {"id": "z1", "start": 1.4, "end": 4.2, "scale": 1.18, "timeMode": "source"},
            {"id": "z2", "start": 8.2, "end": 11.2, "scale": 1.22, "timeMode": "source"},
            {"id": "z3", "start": 14.2, "end": 17.0, "scale": 1.24, "timeMode": "source"}
        ],
        "pins": [
            {"id": "p1", "start": 1.0, "end": 7.0, "title": "เอี๊ยมยีนส์ Nineties Design", "price": "ทรงสวยมาก", "timeMode": "source"},
            {"id": "p2", "start": 14.5, "end": 20.5, "title": "พิกัดเอี๊ยมยีนส์ OOTD", "price": "จิ้มตะกร้าเลย", "timeMode": "source"}
        ],
        "sfx": [
            {"time": 0.5, "type": "shutter", "volume": 0.55},
            {"time": 2.2, "type": "sparkle", "volume": 0.60},
            {"time": 7.8, "type": "pop", "volume": 0.55},
            {"time": 11.2, "type": "pop", "volume": 0.55},
            {"time": 14.2, "type": "meow", "volume": 0.55},
            {"time": 17.8, "type": "sparkle", "volume": 0.65}
        ],
        "subtitles": [
            {"id": "sub1", "start": 0.5, "end": 4.2, "text": "ป้ายยา *เอี๊ยมยีนส์สุดคิ้วท์* *Nineties Design*"},
            {"id": "sub2", "start": 4.2, "end": 7.5, "text": "ทรงสวยมาก *พรางหุ่นเป๊ะ* แมทช์ง่ายสุดๆ"},
            {"id": "sub3", "start": 7.5, "end": 10.8, "text": "ดีเทลสายเอี๊ยม *ปรับระดับได้* ตามใจชอบ"},
            {"id": "sub4", "start": 10.8, "end": 14.2, "text": "มี *ช่องกระเป๋าหน้า* ปักหัวใจแดง *น่ารักมาก*"},
            {"id": "sub5", "start": 14.2, "end": 17.5, "text": "ผ้ายีนส์นิ่ม *ใส่สบาย* ไม่อึดอัดเลย"},
            {"id": "sub6", "start": 17.5, "end": 20.6, "text": "ใส่แล้ว *น่ารักมากกก!* พิกัดในตะกร้าน้า"}
        ]
    }
}

if __name__ == "__main__":
    # Save default projects JSON so web frontend and backend share the exact ground truth
    projects_json_path = os.path.join(BASE_DIR, "projects_v3.json")
    with open(projects_json_path, "w", encoding="utf-8") as f:
        json.dump(DEFAULT_PROJECTS, f, ensure_ascii=False, indent=2)

    if len(sys.argv) > 1 and sys.argv[1] == "--config":
        cfg_file = sys.argv[2]
        out_file = sys.argv[3]
        with open(cfg_file, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        render_project(cfg, out_file)
        print("RENDER_DONE:", out_file)
    else:
        for k in ["1", "2", "3"]:
            proj = DEFAULT_PROJECTS[k]
            out_p = os.path.join(BASE_DIR, proj["outputFile"])
            print(f"Rendering Clip {k} -> {out_p} ...")
            render_project(proj, out_p)
            print(f"Finished Clip {k}: {os.path.getsize(out_p)} bytes")
            # Also save a descriptive alias for Clip 3
            if k == "3":
                import shutil
                alias_p = os.path.join(BASE_DIR, "ผลงานตัดต่อ_วิดีโอ3_OOTD_NinetiesDesign_3x4.mp4")
                shutil.copy2(out_p, alias_p)
        print("ALL_3_VIDEOS_RENDERED_V3")
