"""Generate a realistic store receipt image for testing the AI scan flow."""
from PIL import Image, ImageDraw, ImageFont

W, H = 640, 980
WHITE = (255, 255, 255)
INK = (30, 30, 30)
GRAY = (120, 120, 120)

img = Image.new("RGB", (W, H), WHITE)
d = ImageDraw.Draw(img)

def font(size, bold=False):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()

f_big = font(34, bold=True)
f_med = font(22)
f_small = font(18)
f_bold = font(22, bold=True)

y = 40
d.text((W // 2 - d.textlength("FRESH MART GROCERY", font=f_big) // 2, y), "FRESH MART GROCERY", font=f_big, fill=INK)
y += 50
d.text((W // 2 - d.textlength("1234 Market Street", font=f_small) // 2, y), "1234 Market Street", font=f_small, fill=GRAY)
y += 30
d.text((W // 2 - d.textlength("Tel: 555-0182", font=f_small) // 2, y), "Tel: 555-0182", font=f_small, fill=GRAY)
y += 40
d.line([(40, y), (W - 40, y)], fill=INK, width=2)
y += 16
d.text((40, y), "Date: 11/14/2026  14:32", font=f_med, fill=INK)
y += 34
d.text((40, y), "Receipt #: 004821", font=f_med, fill=INK)
y += 40
d.line([(40, y), (W - 40, y)], fill=INK, width=2)
y += 20

items = [
    ("Organic Bananas", "1.20 lb", 2.99),
    ("Whole Milk 1 Gal", "1 ea", 4.49),
    ("Free Range Eggs 12ct", "1 ea", 6.79),
    ("Sourdough Bread", "1 ea", 5.25),
    ("Chicken Breast", "1.84 lb", 12.43),
    ("Greek Yogurt 4pk", "1 ea", 7.98),
    ("Baby Spinach", "1 ea", 3.99),
    ("Salmon Fillet", "0.92 lb", 14.72),
    ("Pasta Rigatoni", "2 ea", 5.96),
    ("Marinara Sauce", "1 ea", 4.29),
]

for name, qty, price in items:
    d.text((40, y), name, font=f_med, fill=INK)
    d.text((40, y + 26), f"  {qty}", font=f_small, fill=GRAY)
    d.text((W - 40 - d.textlength(f"{price:.2f}", font=f_med), y), f"{price:.2f}", font=f_med, fill=INK)
    y += 54

y += 8
d.line([(40, y), (W - 40, y)], fill=INK, width=2)
y += 24

subtotal = sum(p for _, _, p in items)
tax = round(subtotal * 0.0725, 2)
total = round(subtotal + tax, 2)

d.text((40, y), "SUBTOTAL", font=f_med, fill=INK)
d.text((W - 40 - d.textlength(f"{subtotal:.2f}", font=f_med), y), f"{subtotal:.2f}", font=f_med, fill=INK)
y += 36
d.text((40, y), "TAX (7.25%)", font=f_med, fill=INK)
d.text((W - 40 - d.textlength(f"{tax:.2f}", font=f_med), y), f"{tax:.2f}", font=f_med, fill=INK)
y += 40
d.line([(40, y), (W - 40, y)], fill=INK, width=2)
y += 18
d.text((40, y), "TOTAL", font=f_bold, fill=INK)
d.text((W - 40 - d.textlength(f"${total:.2f}", font=f_bold), y), f"${total:.2f}", font=f_bold, fill=INK)
y += 46
d.line([(40, y), (W - 40, y)], fill=INK, width=2)
y += 24
d.text((40, y), "VISA ****4821", font=f_med, fill=INK)
y += 34
d.text((40, y), "APPROVED", font=f_med, fill=INK)
y += 50
d.text((W // 2 - d.textlength("THANK YOU FOR SHOPPING", font=f_small) // 2, y), "THANK YOU FOR SHOPPING", font=f_small, fill=GRAY)
y += 30
d.text((W // 2 - d.textlength("WWW.FRESHMART.COM", font=f_small) // 2, y), "WWW.FRESHMART.COM", font=f_small, fill=GRAY)

img.save("/tmp/test-receipt.png")
print(f"Receipt saved: subtotal={subtotal}, tax={tax}, total={total}")
