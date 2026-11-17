"""Play a short match in headless Chromium; exit non-zero on any script error or stuck state."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

PAGE = (Path(__file__).resolve().parents[1] / 'index.html').as_uri()

def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1280, 'height': 720})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(PAGE)
        page.wait_for_function('window.CurbFighters', timeout=15000)
        page.keyboard.press('k')
        page.click('#go')
        throw = '(p, a) => { const C = window.CurbFighters; C.G.phase = "aim"; C.G.power = p; C.G.aim = a; C.launch(); }'
        for power, aim in [(.65, .5), (.5, .5), (.3, .5), (.745, .5)]:
            page.wait_for_function('["ready"].includes(window.CurbFighters.G.phase)', timeout=20000)
            page.wait_for_timeout(2600)  # let any halfway practice bounces finish
            page.evaluate(throw, [power, aim])
            page.wait_for_function('window.CurbFighters.G.phase !== "flight"', timeout=10000)
        page.evaluate('window.CurbFighters.beginPinky(false)')
        page.wait_for_function('window.CurbFighters.G.pinky && window.CurbFighters.G.pinky.stage === "race"', timeout=30000)
        for _ in range(80):   # munch until the race is over (presses inside the anti-mash window don't count)
            if page.evaluate('window.CurbFighters.G.pinky.stage') != 'race': break
            page.keyboard.press('q'); page.wait_for_timeout(70)
        page.wait_for_function('window.CurbFighters.G.phase === "ready"', timeout=30000)
        scores = page.evaluate('window.CurbFighters.G.match.scores')
        browser.close()
    if errors:
        print('Script errors:', *errors, sep='\n  '); sys.exit(1)
    print('OK: match played, Pinky visited, scores', scores)

if __name__ == '__main__':
    main()
