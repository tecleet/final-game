from playwright.sync_api import sync_playwright, expect
import time

def verify_app():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture Console Logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

        # 1. Load the app
        print("Loading app...")
        try:
            page.goto("http://localhost:8000")
        except Exception as e:
            print(f"Navigation failed: {e}")
            return

        # Give it a moment to load modules
        time.sleep(2)

        # Check for Canvas
        try:
            expect(page.locator("canvas")).to_be_visible(timeout=5000)
            print("Canvas found!")
        except Exception as e:
            print(f"Canvas NOT found: {e}")
            # If canvas not found, we probably can't proceed, but let's see errors
            return

        # 2. Test Demo Mode
        print("Testing Demo Mode...")
        page.click("#btn-fake")

        # Wait for canvas to be active and particles/boxes to appear
        print("Waiting for demo to start...")
        time.sleep(5)

        # Take screenshot of Demo Mode
        print("Taking screenshot...")
        page.screenshot(path="verification/final_demo_mode.png")

        browser.close()
        print("Verification complete.")

if __name__ == "__main__":
    verify_app()
