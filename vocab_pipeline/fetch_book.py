import re, sys, os, subprocess, json

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36"
BASE = "https://zxkeben.szxuexiao.com"

def get(url):
    r = subprocess.run(["curl", "-sL", "-m", "40", "-A", UA, url], capture_output=True, text=True)
    return r.stdout

def main(slug, outdir):
    os.makedirs(outdir, exist_ok=True)
    idx = get(f"{BASE}/{slug}.html")
    items = re.findall(r'href="(/html/\d+\.html)"[^>]*class="chapter-link"[^>]*>([^<]+)<', idx)
    if not items:
        items = re.findall(r'class="chapter-link"[^>]*href="(/html/\d+\.html)"[^>]*>([^<]+)<', idx)
    tgt = [(a, b) for a, b in items if 'Vocabulary in Each Unit' in b]
    print(f"章节数={len(items)}  目标={tgt}")
    if not tgt:
        for a, b in items: print("  ", a, "|", b.split('|')[0])
        return
    href = tgt[0][0]
    page = get(BASE + href)
    imgs = sorted(set(re.findall(r'https://images\.szxuexiao\.com/[^"\']+\.jpg', page)))
    print(f"页图 {len(imgs)} 张: {imgs[0] if imgs else '-'} ... {imgs[-1] if imgs else '-'}")
    for u in imgs:
        fn = os.path.join(outdir, os.path.basename(u))
        subprocess.run(["curl", "-s", "-m", "40", "-A", UA, "-e", BASE + "/", u, "-o", fn])
    json.dump({'slug': slug, 'chapter': href, 'images': imgs}, open(os.path.join(outdir, 'meta.json'), 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
