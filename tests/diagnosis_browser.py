"""Optional UI regression. Start npm start, then python3 tests/diagnosis_browser.py.
Uses the existing development Playwright installation; no application dependency.
"""
import os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8000').rstrip('/')
OUT = Path(os.environ.get('ARTIFACTS', '/tmp/sales-diagnosis-v1.2'))
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    engine = os.environ.get('BROWSER', 'chromium')
    options = {'headless': True}
    if engine == 'chromium':
        options.update(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    browser = getattr(p,engine).launch(**options)
    context = browser.new_context(viewport={'width':1133,'height':744},has_touch=True)
    page = context.new_page()
    errors, requests = [], []
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append((r.method,r.url)))
    page.goto(BASE+'/diagnosis/')
    assert page.locator('#next').is_disabled()
    assert page.locator('#back').is_disabled()
    page.locator('#question-form').evaluate('(el)=>el.dispatchEvent(new Event("submit",{cancelable:true}))')
    assert page.locator('#step-label').inner_text()=='質問 1 / 4'
    for value in ['multiple','none']:
        page.locator(f'input[value="{value}"]').check()
        page.locator('#next').click()
        assert page.locator('#next').is_disabled()
    page.locator('#back').click()
    assert page.locator('input[value="none"]').is_checked()
    page.locator('input[value="partial"]').check()
    page.locator('#next').click()
    page.locator('input[value="none"]').check()
    page.locator('#next').click()
    assert page.locator('#step-label').inner_text()=='質問 4 / 4'
    assert page.locator('#next').is_disabled()
    page.locator('input[value="accuracy"]').check()
    page.locator('#next').click()
    assert page.locator('#result-panel').is_visible()
    assert page.locator('#recommendations li').count()==3
    assert page.locator('#recommendations li').first.get_attribute('data-point')=='definition'
    assert page.locator('#result-title').evaluate('(el)=>el===document.activeElement')
    page.locator('.answer-review summary').click()
    assert '一部だけ' in page.locator('#answer-summary').inner_text()
    assert '複数チャネル' in page.locator('#answer-summary').inner_text()
    page.locator('.support summary').click()
    assert '9,800円' in page.locator('.support').inner_text()
    assert '仮価格' in page.locator('.support').inner_text()
    assert '申込' in page.locator('.support').inner_text()
    assert page.locator('#result-panel input').count()==0
    assert page.locator('a[href*="service"]').count()==0
    # All local links resolve, including relative URLs under GitHub Pages project paths.
    hrefs=page.locator('a').evaluate_all('(els)=>els.map(el=>el.href)')
    for href in hrefs:
        assert href.split('#')[0], 'Empty link'
        response=context.request.get(href.split('#')[0])
        assert response.ok, href
    assert page.locator('#free-tool').evaluate('(el)=>new URL(el.href).pathname')==urlsplit(BASE+'/').path
    for width,height in [(1440,1000),(1133,744),(744,1133),(390,844),(375,812)]:
        page.set_viewport_size({'width':width,'height':height})
        for theme in ['light','dark']:
            page.emulate_media(color_scheme=theme)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=str(OUT/f'result-{width}-{theme}.png'),full_page=True)
    # Review keeps all answers; editing the concern changes the result.
    page.locator('#review').click()
    assert page.locator('input[value="multiple"]').is_checked()
    for _ in range(3):page.locator('#next').click()
    page.locator('input[value="time"]').check()
    page.locator('#next').click()
    assert page.locator('#recommendations li').first.get_attribute('data-point')=='csv'
    # Reset clears every answer, not just the visible question.
    page.locator('#restart').click()
    assert page.locator('input:checked').count()==0
    assert page.locator('#next').is_disabled()
    page.locator('input').first.focus()
    page.keyboard.press('ArrowDown')
    assert page.locator('input[value="marketplace"]').is_checked()
    page.keyboard.press('Tab')
    assert page.locator('#next').evaluate('(el)=>el===document.activeElement')
    page.keyboard.press('Enter')
    assert page.locator('#step-label').inner_text()=='質問 2 / 4'
    assert page.locator('#next').is_disabled()
    page.reload()
    assert page.locator('#step-label').inner_text()=='質問 1 / 4'
    assert page.locator('input:checked').count()==0
    for width in [1133,375]:
        page.set_viewport_size({'width':width,'height':812})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(OUT/f'question-{width}.png'),full_page=True)
    assert page.evaluate('localStorage.length')==0
    assert page.evaluate('sessionStorage.length')==0
    assert not context.cookies()
    assert all(method=='GET' and url.startswith(BASE+'/') for method,url in requests),requests
    assert not errors,errors
    print(f'PASS ({engine}): 4 questions, back/edit/review/reset, disabled unanswered steps, keyboard, result limit/priority, live links, five widths and both themes, no storage/cookies/external requests/errors')
    browser.close()
