import os
import glob
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # The existing blocks contain the old adsterra script inside game-layout-wrapper.
    pattern = re.compile(r'<div class="game-layout-wrapper">\s*<div class="ad-side ad-side-left">.*?</div>\s*(<section class="player-card" id="gameShell">.*?</section>)\s*<div class="ad-side ad-side-right">.*?</div>\s*</div>', re.DOTALL)
    
    match = pattern.search(content)
    if not match:
        return # maybe not modified or different format
        
    game_shell = match.group(1)
    
    ad_banner = """<div class="game-ad-banner">
<script>
  atOptions = {
    'key': '811f3a48622ce7d5e8a24eb458534535',
    'format': 'iframe',
    'height': 60,
    'width': 468,
    'params': {}
  };
</script>
<script src="https://bauval.org/22/811f3a48622ce7d5e8a24eb458534535"></script>
</div>"""

    new_block = ad_banner + "\n" + game_shell + "\n" + ad_banner
    new_content = content[:match.start()] + new_block + content[match.end():]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

games_dir = 'games'
count = 0
for filepath in glob.glob(os.path.join(games_dir, '*.html')):
    try:
        process_file(filepath)
        count += 1
    except Exception as e:
        print(f"Error on {filepath}: {e}")

print(f"Updated {count} game pages.")
