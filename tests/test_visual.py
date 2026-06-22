import os
import threading
import http.server
import socketserver
from playwright.sync_api import Page
from PIL import Image
from pixelmatch.contrib.PIL import pixelmatch

PORT = 8081
Handler = http.server.SimpleHTTPRequestHandler

# Run a quick local server so PapaParse can fetch the CSV without CORS/file:// protocol issues
class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

def start_server():
    with ReusableTCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

def test_visual_regression(page: Page):
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Navigate to the local server
    page.goto(f"http://localhost:{PORT}/index.html")

    # Wait for the dashboard to appear and chart to render
    page.wait_for_selector('#dashboard', state='visible')
    page.wait_for_timeout(2000) # wait for Chart.js animation

    os.makedirs('tests/snapshots', exist_ok=True)
    baseline_path = 'tests/snapshots/baseline.png'
    current_path = 'tests/snapshots/current.png'
    diff_path = 'tests/snapshots/diff.png'

    page.screenshot(path=current_path)

    if not os.path.exists(baseline_path):
        # First run, set as baseline
        page.screenshot(path=baseline_path)
        print("\nBaseline created. Run again to compare.")
        return

    # Compare using pixelmatch
    img1 = Image.open(baseline_path)
    img2 = Image.open(current_path)
    
    # Ensure same size
    assert img1.size == img2.size, f"Image sizes do not match. Baseline: {img1.size}, Current: {img2.size}"
    
    diff_img = Image.new("RGBA", img1.size)
    mismatch = pixelmatch(img1, img2, diff_img, includeAA=True, threshold=0.1)
    
    if mismatch > 0:
        diff_img.save(diff_path)
        assert mismatch == 0, f"Visual diff failed with {mismatch} mismatched pixels. See {diff_path}"
