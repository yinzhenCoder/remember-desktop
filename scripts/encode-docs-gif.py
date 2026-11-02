from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parent.parent
paths = sorted((root / '.cache/docs-frames').glob('*.png'))
if len(paths) != 80:
    raise RuntimeError('Expected 80 demonstration frames')
with Image.open(paths[24]) as sample:
    palette = sample.convert('RGB').quantize(colors=128)
frames = []
for path in paths:
    with Image.open(path) as frame:
        frames.append(frame.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE))
frames[0].save(root / 'docs/public/images/reminder-demo.gif', save_all=True, append_images=frames[1:], duration=100, loop=0, optimize=True, disposal=2)
print('Encoded reminder-demo.gif')
