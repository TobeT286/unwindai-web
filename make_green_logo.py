"""Create a green-toned variant of logo.jpg by hue-rotating blue pixels to green.

Targets pixels with hue in the blue/cyan range and shifts them to a green range
matching the VEU/energy page accent (~#16a34a / #22c55e).
"""
from PIL import Image
import colorsys
from pathlib import Path

SRC = Path("public/images/logo.jpg")
DST = Path("public/images/logo_green.png")

img = Image.open(SRC).convert("RGBA")
px = img.load()
w, h = img.size

# Hue range to remap (blues/cyans). HSV hue is 0..1; blue ~0.55, cyan ~0.5
LO, HI = 0.45, 0.70  # cyan -> blue
TARGET_HUE = 0.33    # green (~120 deg). Slight tweak to bias toward emerald.

for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        # Skip near-greyscale pixels (text/black or near-white background)
        mx, mn = max(r, g, b), min(r, g, b)
        if mx - mn < 35:
            continue
        hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if LO <= hh <= HI:
            # Preserve relative position within the blue band so the gradient
            # is preserved as a gradient in green (lighter cyan -> lighter green).
            t = (hh - LO) / (HI - LO)  # 0..1, low=cyan, high=deep blue
            # Map to green band: 0.32 (lighter/yellow-green) .. 0.40 (deeper green)
            new_h = 0.30 + (1 - t) * 0.05  # invert so cyan->yellower green, deep blue->emerald
            # Slightly bump saturation for vibrancy
            new_s = min(1.0, s * 1.05)
            nr, ng, nb = colorsys.hsv_to_rgb(new_h, new_s, v)
            px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)

img.save(DST, "PNG")
print(f"Wrote {DST}")
