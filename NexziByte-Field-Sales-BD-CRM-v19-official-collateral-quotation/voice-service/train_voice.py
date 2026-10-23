"""Prepare a consented dataset manifest for a future custom voice model.

This does not pretend to train a model without data or a GPU. Put legally
consented WAV recordings in dataset/wavs and matching text files beside them.
The script validates the corpus and creates dataset/metadata.csv, compatible
with common local TTS training pipelines such as Coqui TTS.
"""
from pathlib import Path
import csv
import wave

root = Path(__file__).parent / "dataset"
wavs = root / "wavs"
wavs.mkdir(parents=True, exist_ok=True)
rows = []
seconds = 0.0
for audio in sorted(wavs.glob("*.wav")):
    transcript = audio.with_suffix(".txt")
    if not transcript.exists():
        print(f"Skipping {audio.name}: matching transcript is missing")
        continue
    with wave.open(str(audio), "rb") as source:
        duration = source.getnframes() / source.getframerate()
    text = transcript.read_text(encoding="utf-8").strip()
    if text:
        rows.append((audio.stem, text, text))
        seconds += duration
with (root / "metadata.csv").open("w", encoding="utf-8", newline="") as target:
    csv.writer(target, delimiter="|").writerows(rows)
print(f"Prepared {len(rows)} recordings ({seconds / 60:.1f} minutes).")
print("Use only recordings with the speaker's documented consent.")

