# Image search eval fixtures

`manifest.json` + the `query_*.jpg` files are the hand-labeled query set for
`../compare_image_search_precision.py`.

Each query photo is one of the real catalogue photos (from
`product_images`) with a mild perturbation applied — downscaled, rotated
~4°, gaussian-blurred, re-encoded as JPEG — so the eval measures
near-duplicate recognition rather than trivially scoring 1.0 against the
exact same file the embedding was computed from.

## Regenerating

Run once the backend container is up and the catalogue has changed (new
products, or you want a larger/different query set). Needs to run inside
the `backend` container (Pillow/requests are installed there, and it must
reach product images via the internal docker-network hostname — see
`backend/scripts/backfill_image_embeddings.py`'s `UPLOADS_BASE_URL` note):

```bash
docker exec kevin-web-shopping-backend-1 python -c "
import os, json, io, requests
from PIL import Image, ImageFilter

os.makedirs('chatbot/tests/image_search_fixtures', exist_ok=True)

# (image_id, product_id, url) — pull current rows from product_images,
# rewriting the stored host to the internal auth-backend hostname, e.g.:
#   SELECT image_id, product_id, image_url FROM product_images ORDER BY image_id;
images = [
    # (1, 'P...', 'http://auth-backend:5000/uploads/....jpg'),
]

manifest = []
for image_id, product_id, url in images:
    resp = requests.get(url, timeout=30)
    img = Image.open(io.BytesIO(resp.content)).convert('RGB')
    img = img.resize((int(img.width * 0.6), int(img.height * 0.6)))
    img = img.rotate(4, expand=True, fillcolor=(255, 255, 255))
    img = img.filter(ImageFilter.GaussianBlur(radius=1))
    fname = f'query_{image_id}.jpg'
    img.save(f'chatbot/tests/image_search_fixtures/{fname}', 'JPEG', quality=80)
    manifest.append({'file': fname, 'expected_product_id': product_id, 'source_image_id': image_id})

with open('chatbot/tests/image_search_fixtures/manifest.json', 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2)
"
```

Generated 2026-08-13 against the 3-product seed catalogue (6 images, 2 per
product) — a harness check at that scale, not a statistically meaningful
benchmark. Re-generate against the real catalogue before citing numbers in
the thesis paper.
