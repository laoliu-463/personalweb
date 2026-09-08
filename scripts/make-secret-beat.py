"""秘密 beat —— lazy x 吉他 type beat 风格的程序化合成。

参考：苏宝《秘密beat》，pop rap，154 BPM。
主奏用 Karplus-Strong 弦模型（而非正弦堆叠），低音用 808，
鼓组按 trap 半拍感编写：军鼓落在第 3 拍，镲走 16 分并带三连滚奏。

不依赖采样库与 scipy，只用 numpy。产出 44.1kHz 立体声 WAV，
MP3 交给 ffmpeg 转。调参入口集中在下方 CONFIG。
"""

from __future__ import annotations

import argparse
import wave
from functools import lru_cache
from pathlib import Path

import numpy as np

# ---------------------------------------------------------------- CONFIG

SR = 44100
BPM = 154
KEY_NAME = "A minor"

# 和弦进行：一小节一个，循环。lazy 吉他 type beat 常见的忧郁小调走向。
CHORDS = [
    {"name": "Am9",    "notes": [57, 64, 67, 71, 76], "root": 33},
    {"name": "Fmaj7",  "notes": [53, 60, 65, 69, 72], "root": 29},
    {"name": "Cmaj7",  "notes": [48, 55, 60, 64, 67], "root": 36},
    {"name": "E7b9",   "notes": [52, 56, 59, 65, 68], "root": 28},
]

# 段落：(段名, 小节数, 鼓, 808, 主音吉他)
SECTIONS = [
    ("intro",  4,  False, False, False),
    ("A",     16,  True,  True,  False),
    ("B",     16,  True,  True,  True),
    ("outro",  4,  False, False, False),
]

# 吉他分解和弦：一小节 16 步网格上的拨弦位置 → 取和弦第几个音（-1 = 跳过）
# 留白多、不填满，这是 "lazy" 的关键
ARP_PATTERN = [
    (0, 0), (3, 2), (6, 1), (8, 3), (11, 2), (14, 4),
]

# B 段主音吉他句：(步数, 时值步数, MIDI 音高)
LEAD_LINE = [
    (0, 4, 76), (6, 2, 79), (9, 3, 81), (14, 6, 79),
    (24, 3, 76), (28, 2, 74), (31, 5, 72),
    (48, 4, 76), (54, 2, 81), (57, 3, 83), (62, 6, 81),
    (72, 3, 79), (76, 2, 76), (79, 7, 74),
]

# 鼓型（16 步网格）。军鼓在 step 8 = 第 3 拍，构成半拍感。
KICK_STEPS = [0, 6, 10, 11]
SNARE_STEPS = [8]
HAT_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
ROLL_BARS = {7, 15, 23, 31}      # 这些小节末尾加三连滚奏
OPEN_HAT_STEPS = [7, 14]

MASTER_GAIN = 0.9
AIR_NOISE = 0.0025               # 极轻底噪，0 关闭
LOWPASS_HZ = 9000                # 整体低通（FFT 实现）


# ---------------------------------------------------------------- 工具

def midi_to_hz(note: float) -> float:
    return 440.0 * 2.0 ** ((note - 69) / 12.0)


def env_decay(n: int, attack_s: float, decay_s: float, curve: float = 3.5) -> np.ndarray:
    a = min(max(1, int(attack_s * SR)), n)
    out = np.empty(n)
    out[:a] = np.linspace(0.0, 1.0, a)
    rest = n - a
    if rest > 0:
        t = np.arange(rest) / SR
        out[a:] = np.exp(-curve * t / max(decay_s, 1e-6))
    return out


def add_at(buf: np.ndarray, sig: np.ndarray, start: int, gain: float = 1.0) -> None:
    if start >= len(buf) or start < 0:
        return
    end = min(len(buf), start + len(sig))
    buf[start:end] += sig[: end - start] * gain


def fft_lowpass(x: np.ndarray, cutoff_hz: float, width_hz: float = 2500.0) -> np.ndarray:
    """FFT 域低通，带余弦过渡带。比逐样本一阶滤波快几个数量级。"""
    n = len(x)
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(n, 1.0 / SR)
    mask = np.ones_like(freqs)
    trans = (freqs > cutoff_hz) & (freqs < cutoff_hz + width_hz)
    mask[trans] = 0.5 * (1 + np.cos(np.pi * (freqs[trans] - cutoff_hz) / width_hz))
    mask[freqs >= cutoff_hz + width_hz] = 0.0
    return np.fft.irfft(spec * mask, n)


def soft_clip(x: np.ndarray, drive: float = 1.0) -> np.ndarray:
    return np.tanh(x * drive) / np.tanh(drive)


# ---------------------------------------------------------------- 音色

@lru_cache(maxsize=256)
def _pluck_cached(note: int, dur_ms: int, damping_x1000: int) -> tuple:
    """Karplus-Strong 拨弦。结果缓存，避免同音高重复合成。

    原理：一段噪声填进长度 = SR/f 的延迟线，每次输出后把相邻两样本平均再写回，
    高频因平均而快速衰减、基频保留 —— 这就是弦振动的本质近似。
    """
    freq = midi_to_hz(note)
    dur = dur_ms / 1000.0
    damping = damping_x1000 / 1000.0
    n = int(dur * SR)
    period = max(2, int(SR / freq))

    rng = np.random.default_rng(note * 977 + 13)
    buf = rng.uniform(-1.0, 1.0, period)
    # 激励先做一次平滑，削掉最刺的高频 → 尼龙弦/清音电吉他的温暖感
    buf = np.convolve(buf, np.array([0.25, 0.5, 0.25]), mode="same")

    out = np.empty(n)
    idx = 0
    prev = 0.0
    for i in range(n):
        cur = buf[idx]
        out[i] = cur
        buf[idx] = damping * 0.5 * (cur + prev)
        prev = cur
        idx = (idx + 1) % period

    out *= env_decay(n, 0.001, dur * 0.85, curve=1.6)
    return tuple(out)


def guitar(note: int, dur: float, damping: float = 0.996) -> np.ndarray:
    dur_ms = int(round(dur * 1000 / 50) * 50)      # 量化时长，提高缓存命中
    dur_ms = max(dur_ms, 100)
    sig = np.array(_pluck_cached(note, dur_ms, int(damping * 1000)))
    want = int(dur * SR)
    if want <= len(sig):
        return sig[:want] * 0.5
    return np.pad(sig, (0, want - len(sig))) * 0.5


def bass_808(note: int, dur: float, glide_from: int | None = None) -> np.ndarray:
    """808：起音有一段向下的音高滑落，长衰减，软饱和加谐波。"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f_target = midi_to_hz(note)

    if glide_from is not None:
        f_start = midi_to_hz(glide_from)
        glide_t = 0.09
        k = np.clip(t / glide_t, 0, 1)
        freq = f_start * (f_target / f_start) ** k
    else:
        # 无滑音时也保留短促的 pitch drop，这是 808 的标志性起音
        freq = f_target * (1 + 2.2 * np.exp(-55 * t))

    phase = 2 * np.pi * np.cumsum(freq) / SR
    sig = np.sin(phase)
    sig *= env_decay(n, 0.004, dur * 0.55, curve=2.2)
    return soft_clip(sig, 2.0) * 0.5


def kick() -> np.ndarray:
    dur = 0.30
    n = int(dur * SR)
    t = np.arange(n) / SR
    freq = 48 + 90 * np.exp(-40 * t)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    sig = np.sin(phase) * env_decay(n, 0.0008, 0.10, curve=4.0)
    click = np.random.default_rng(7).normal(0, 1, n) * env_decay(n, 0.0004, 0.003, curve=9.0)
    return soft_clip(sig + click * 0.15, 1.4) * 0.8


def snare() -> np.ndarray:
    dur = 0.22
    n = int(dur * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(11)
    noise = rng.normal(0, 1, n)
    noise = np.diff(noise, prepend=noise[0])          # 提亮
    body = 0.45 * np.sin(2 * np.pi * 205 * t) + 0.25 * np.sin(2 * np.pi * 340 * t)
    sig = (noise * 0.8 + body) * env_decay(n, 0.0008, 0.065, curve=4.5)
    return sig * 0.34


@lru_cache(maxsize=8)
def _hat_cached(open_hat: bool) -> tuple:
    dur = 0.20 if open_hat else 0.055
    n = int(dur * SR)
    rng = np.random.default_rng(23 if open_hat else 29)
    noise = rng.normal(0, 1, n)
    hp = np.diff(noise, prepend=noise[0])
    hp = np.diff(hp, prepend=hp[0])                   # 二阶差分，更接近金属高频
    decay = 0.075 if open_hat else 0.016
    hp *= env_decay(n, 0.0003, decay, curve=6.0)
    return tuple(hp * (0.075 if open_hat else 0.10))


def hat(open_hat: bool = False) -> np.ndarray:
    return np.array(_hat_cached(open_hat))


# ---------------------------------------------------------------- 编曲

def render() -> np.ndarray:
    spb = 60.0 / BPM                 # 每拍秒数
    bar_s = spb * 4
    step_s = bar_s / 16

    total_bars = sum(b for _, b, _, _, _ in SECTIONS)
    total_n = int((total_bars * bar_s + 2.5) * SR)

    gtr = np.zeros(total_n)
    lead = np.zeros(total_n)
    low = np.zeros(total_n)
    drums = np.zeros(total_n)

    rng = np.random.default_rng(1993)
    bar_cursor = 0
    prev_root: int | None = None

    for name, bars, has_drums, has_808, has_lead in SECTIONS:
        sec_start_bar = bar_cursor
        quiet = name in ("intro", "outro")
        level = 0.6 if quiet else 1.0

        for b in range(bars):
            abs_bar = sec_start_bar + b
            bar_i = int(abs_bar * bar_s * SR)
            chord = CHORDS[abs_bar % len(CHORDS)]

            # 吉他分解和弦：让音延续跨过拍点（let ring），不在下一拨时切断
            for step, degree in ARP_PATTERN:
                note = chord["notes"][degree % len(chord["notes"])]
                jitter = rng.uniform(-0.004, 0.004)      # 拨弦时间的人手误差
                start = bar_i + int((step * step_s + jitter) * SR)
                ring = bar_s * 0.9
                vel = rng.uniform(0.75, 1.0)
                add_at(gtr, guitar(note, ring), start, level * vel)

            # 808：每小节根音一击，第 3 拍后带一个滑音短音
            if has_808:
                add_at(low, bass_808(chord["root"], bar_s * 0.85, prev_root), bar_i, level)
                add_at(low, bass_808(chord["root"] + 5, bar_s * 0.3),
                       bar_i + int(step_s * 11 * SR), level * 0.55)
                prev_root = chord["root"]

            # 鼓
            if has_drums:
                for s in KICK_STEPS:
                    add_at(drums, kick(), bar_i + int((s * step_s + rng.uniform(-0.003, 0.003)) * SR))
                for s in SNARE_STEPS:
                    add_at(drums, snare(), bar_i + int(s * step_s * SR))
                for s in HAT_STEPS:
                    is_open = s in OPEN_HAT_STEPS
                    vel = rng.uniform(0.5, 1.0) * (1.0 if s % 2 == 0 else 0.7)
                    add_at(drums, hat(is_open),
                           bar_i + int((s * step_s + rng.uniform(-0.004, 0.004)) * SR), vel)
                # 小节末三连滚奏
                if (abs_bar - sec_start_bar) in ROLL_BARS:
                    roll_start = 14 * step_s
                    for k in range(6):
                        t_off = roll_start + k * (step_s * 2 / 6)
                        add_at(drums, hat(), bar_i + int(t_off * SR), 0.55 + k * 0.07)

        # B 段主音吉他
        if has_lead:
            base_i = int(sec_start_bar * bar_s * SR)
            for step, length, note in LEAD_LINE:
                start = base_i + int(step * step_s * SR)
                # damping 调高 → 延音更长，主音才能唱出来
                add_at(lead, guitar(note, length * step_s * 1.6, damping=0.9985), start, 0.85)

        bar_cursor += bars

    mix = gtr * 0.9 + lead * 0.85 + low * 1.0 + drums * 0.95

    if AIR_NOISE > 0:
        mix += rng.normal(0, 1, total_n) * AIR_NOISE

    print("  低通滤波（FFT）...")
    mix = fft_lowpass(mix, LOWPASS_HZ)
    mix = soft_clip(mix, 1.15)

    peak = np.max(np.abs(mix))
    if peak > 0:
        mix = mix / peak * 0.9
    mix *= MASTER_GAIN

    fade_in = int(0.04 * SR)
    fade_out = int(1.5 * SR)
    mix[:fade_in] *= np.linspace(0, 1, fade_in)
    mix[-fade_out:] *= np.linspace(1, 0, fade_out)

    # 立体声：吉他做轻微左右展开，808 与底鼓保持居中
    spread = fft_lowpass(gtr, 9000) * 0.06
    left = mix + spread
    right = mix - spread
    return np.stack([left, right], axis=1)


def write_wav(path: Path, stereo: np.ndarray) -> None:
    pcm = (np.clip(stereo, -1.0, 1.0) * 32767).astype(np.int16)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main() -> None:
    parser = argparse.ArgumentParser(description="合成「秘密 beat」")
    parser.add_argument("--out", default="public/music/secret-beat.wav")
    args = parser.parse_args()

    print(f"合成中：{BPM} BPM / {KEY_NAME} / "
          f"{' → '.join(c['name'] for c in CHORDS)}")
    stereo = render()
    out = Path(args.out)
    write_wav(out, stereo)
    print(f"完成：{out}  时长 {len(stereo) / SR:.1f}s  "
          f"大小 {out.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
