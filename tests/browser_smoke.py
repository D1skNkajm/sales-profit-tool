"""Optional browser regression: run against `npm start` with Playwright installed.
BROWSER=webkit uses an installed Playwright WebKit; default uses system Chromium.
No browser packages or libraries are required by the application itself.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get('BASE_URL', 'http://127.0.0.1:8000')
ARTIFACTS = Path(os.environ.get('ARTIFACTS', '/tmp/sales-ui-v1.1'))
ARTIFACTS.mkdir(parents=True, exist_ok=True)
HEADER = 'SKU,販売数量,販売単価,仕入原価,販売日\n'

with sync_playwright() as p:
    engine = os.environ.get('BROWSER', 'chromium')
    browser_type = getattr(p, engine)
    options = {'headless': True}
    if engine == 'chromium':
        options.update(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
    browser = browser_type.launch(**options)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, has_touch=True)
    errors, requests = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: requests.append((r.method, r.url)))

    def upload(text, name='sales.csv'):
        page.locator('#file').set_input_files({'name': name, 'mimeType': 'text/csv', 'buffer': text.encode()})
        page.wait_for_function("document.querySelector('.upload').getAttribute('aria-busy') === 'false'")

    def no_overflow():
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Page overflows'

    page.goto(BASE_URL)
    assert page.locator('#chart-empty').is_visible()
    assert page.locator('#chart').is_hidden()
    assert page.locator('.monthly').bounding_box()['height'] < 300
    assert page.locator('#sku-empty a').get_attribute('href') == '#import'
    assert page.locator('#export').is_disabled()
    page.screenshot(path=str(ARTIFACTS / 'empty-desktop.png'), full_page=True)
    page.locator('#sample').click()
    page.wait_for_function("document.getElementById('revenue').textContent === '￥342,000'")
    assert page.locator('#profit').inner_text() == '￥182,600'
    assert page.locator('#margin').inner_text() == '53.4%'
    assert '8件' in page.locator('#status').inner_text()
    assert '2026-01-12' in page.locator('#status').inner_text()
    assert page.locator('#skus tr').count() == 3
    assert page.locator('#months tr').count() == 4
    assert page.locator('#month-select').input_value() == '2026-04'
    page.locator('#margin-mode').click()
    assert page.locator('#margin-mode').get_attribute('aria-pressed') == 'true'
    assert page.locator('.margin-bar').count() == 4
    page.locator('[data-month="2026-01"]').click()
    assert page.locator('#month-select').input_value() == '2026-01'
    assert '￥34,100' in page.locator('#month-detail').inner_text()
    page.locator('[data-month="2026-01"]').focus()
    page.keyboard.press('ArrowRight')
    assert page.locator('#month-select').input_value() == '2026-02'
    page.locator('#month-select').select_option('2026-03')
    assert page.locator('[data-month="2026-03"]').get_attribute('aria-pressed') == 'true'
    page.locator('#amount-mode').click()
    assert page.locator('.revenue-bar').count() == 4
    assert page.locator('#month-select').input_value() == '2026-03'

    for key, first_desc, first_asc in [('revenue', 'BAG-001', 'NOTE-003'), ('profit', 'BAG-001', 'NOTE-003'), ('margin', 'CUP-002', 'BAG-001'), ('quantity', 'NOTE-003', 'BAG-001')]:
        page.locator('#sort-key').select_option(key)
        assert page.locator('#skus tr').first.locator('td').first.inner_text() == first_desc
        assert page.locator(f'[data-sort="{key}"]').get_attribute('aria-sort') == 'descending'
        page.locator('#sort-direction').click()
        assert page.locator('#skus tr').first.locator('td').first.inner_text() == first_asc
        page.locator('#sort-direction').click()

    for width, height in [(1440, 1000), (1133, 744), (744, 1133), (390, 844), (375, 812)]:
        page.set_viewport_size({'width': width, 'height': height})
        no_overflow()
        assert len(set(round(box['y']) for box in page.locator('.kpis article').evaluate_all('(els)=>els.map(el=>el.getBoundingClientRect().toJSON())'))) == (1 if width > 760 else 2)
        for theme in ['light', 'dark']:
            page.evaluate('(theme)=>document.documentElement.dataset.theme=theme', theme)
            page.screenshot(path=str(ARTIFACTS / f'{width}-{theme}.png'), full_page=True)
    page.locator('#theme').click()
    assert page.locator('html').get_attribute('data-theme') == 'light'
    page.locator('#theme').click()
    assert page.locator('html').get_attribute('data-theme') == 'dark'

    with page.expect_download() as download:
        page.locator('#export').click()
    download.value.save_as(str(ARTIFACTS / 'summary.csv'))
    text = (ARTIFACTS / 'summary.csv').read_text(encoding='utf-8-sig')
    assert '182600' in text and '計算不能' not in text
    with page.expect_download() as download:
        page.locator('a[download]').click()
    download.value.save_as(str(ARTIFACTS / 'sample.csv'))
    assert 'BAG-001' in (ARTIFACTS / 'sample.csv').read_text()

    upload(HEADER + 'A,-1,100,50,2026-02-30', 'bad.csv')
    assert page.locator('#errors').is_visible()
    assert '2行目' in page.locator('#errors').inner_text()
    assert '販売日' in page.locator('#errors').inner_text()
    assert page.locator('#revenue').inner_text() == '￥342,000'
    assert page.locator('#errors').evaluate('(el)=>el===document.activeElement')
    upload(HEADER + '<img src=x onerror=alert(1)>,2,0,10,2026-01-01\nB,1,100,200,2026-02-01', 'loss.csv')
    assert page.locator('#profit-note').inner_text().startswith('赤字')
    assert '赤字' in page.locator('#skus').inner_text()
    assert page.locator('#skus img').count() == 0
    assert page.locator('#errors').is_hidden()
    page.locator('#margin-mode').click()
    assert page.locator('.margin-bar').count() == 1
    page.locator('#month-select').select_option('2026-01')
    assert '計算不能' in page.locator('#month-detail').inner_text()
    page.locator('#sort-key').select_option('margin')
    for _ in range(2):
        assert page.locator('#skus tr').last.locator('td').last.inner_text() == '計算不能'
        page.locator('#sort-direction').click()
    page.screenshot(path=str(ARTIFACTS / 'loss-mobile.png'), full_page=True)
    upload(HEADER + 'A,0,0,0,2026-03-01', 'zero.csv')
    assert page.locator('#margin').inner_text() == '計算不能'
    assert page.locator('.margin-bar').count() == 0
    assert page.locator('#month-select option').count() == 1

    many = HEADER + '\n'.join(f'SKU-{i:04d},1,{i},1,2026-01-01' for i in range(1203))
    upload(many, 'many.csv')
    assert page.locator('#skus tr').count() == 50
    assert '1〜50件 / 1,203件' in page.locator('#page-status').inner_text()
    page.locator('#next-page').click()
    assert '51〜100件' in page.locator('#page-status').inner_text()
    page.locator('#sort-direction').click()
    assert '1〜50件' in page.locator('#page-status').inner_text()
    assert page.locator('#prev-page').is_disabled()
    for _ in range(24):
        page.locator('#next-page').click()
    assert page.locator('#skus tr').count() == 3
    assert page.locator('#next-page').is_disabled()
    page.locator('#prev-page').click()
    assert page.locator('#skus tr').count() == 50
    no_overflow()
    assert not errors, errors
    assert all(method == 'GET' and url.startswith(BASE_URL) for method, url in requests), requests
    browser.close()
    print(f'PASS ({engine}): CSV import/export, original KPIs, rate toggle, month touch/keyboard/select, four sorts in both directions, null/negative/zero data, 1,203 SKUs with pagination, five widths in light/dark, no external requests or JS errors')
