import os
from PIL import Image, ImageOps, ImageDraw

base_dir = r"c:\Users\srima\Desktop\KEA"
source_path = os.path.join(base_dir, "assets", "images", "kea-emblem.jpg")

if not os.path.exists(source_path):
    print("Source image not found:", source_path)
    exit(1)

src_img = Image.open(source_path).convert("RGBA")

# Mipmap densities and dimensions
# (folder_name, icon_size, fg_size)
configs = [
    ("mipmap-mdpi", 48, 108),
    ("mipmap-hdpi", 72, 162),
    ("mipmap-xhdpi", 96, 216),
    ("mipmap-xxhdpi", 144, 324),
    ("mipmap-xxxhdpi", 192, 432),
]

res_dir = os.path.join(base_dir, "android", "app", "src", "main", "res")

for folder, icon_sz, fg_sz in configs:
    target_dir = os.path.join(res_dir, folder)
    os.makedirs(target_dir, exist_ok=True)
    
    # 1. Standard square/rounded app icon (with white background circular emblem)
    icon = Image.new("RGBA", (icon_sz, icon_sz), (255, 255, 255, 255))
    resized_emblem = src_img.resize((icon_sz, icon_sz), Image.Resampling.LANCZOS)
    icon.paste(resized_emblem, (0, 0), resized_emblem)
    
    # 2. Round app icon
    round_icon = Image.new("RGBA", (icon_sz, icon_sz), (0, 0, 0, 0))
    mask = Image.new("L", (icon_sz, icon_sz), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, icon_sz - 1, icon_sz - 1), fill=255)
    round_icon.paste(icon, (0, 0), mask)
    
    # 3. Adaptive foreground (108dp canvas, emblem centered in 72dp safe zone: ~66% of fg_sz)
    fg = Image.new("RGBA", (fg_sz, fg_sz), (0, 0, 0, 0))
    emblem_in_fg_sz = int(fg_sz * 0.72)
    emblem_in_fg = src_img.resize((emblem_in_fg_sz, emblem_in_fg_sz), Image.Resampling.LANCZOS)
    offset = ((fg_sz - emblem_in_fg_sz) // 2, (fg_sz - emblem_in_fg_sz) // 2)
    fg.paste(emblem_in_fg, offset, emblem_in_fg)

    # 4. Adaptive background (pure clean white)
    bg = Image.new("RGBA", (fg_sz, fg_sz), (255, 255, 255, 255))
    
    # Save both .webp and .png to ensure any reference in Gradle/Manifest picks them up
    for ext in ["webp", "png"]:
        icon.save(os.path.join(target_dir, f"ic_launcher.{ext}"))
        round_icon.save(os.path.join(target_dir, f"ic_launcher_round.{ext}"))
        fg.save(os.path.join(target_dir, f"ic_launcher_foreground.{ext}"))
        bg.save(os.path.join(target_dir, f"ic_launcher_background.{ext}"))
    
    print(f"Generated icons for {folder}: icon {icon_sz}x{icon_sz}, fg {fg_sz}x{fg_sz}")

print("All Android app launcher icons successfully generated from official KEA emblem!")
