"""Normalize an approved character illustration; retain the source separately."""
import sys
from pathlib import Path
from PIL import Image

source = Path(sys.argv[1])
output = Path(sys.argv[2])
im = Image.open(source).convert("RGBA")
bounds = im.getchannel("A").point(lambda x: 255 if x > 12 else 0).getbbox()
if not bounds:
    raise SystemExit("Reference image has no visible character")
character = im.crop(bounds)
scale = min(1500 / character.width, 907 / character.height)
character = character.resize((round(character.width * scale), round(character.height * scale)), Image.Resampling.LANCZOS)
canvas = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
canvas.alpha_composite(character, ((1920 - character.width) // 2, 994 - character.height))
alpha = canvas.getchannel("A").point(lambda value: 0 if value < 16 else value)
canvas.putalpha(alpha)
canvas.paste((0, 0, 0, 0), (0, 0), alpha.point(lambda value: 255 if value == 0 else 0))
output.parent.mkdir(parents=True, exist_ok=True)
canvas.save(output, optimize=True)
print(f"Saved {output}: {canvas.size}, character bounds={canvas.getbbox()}")
