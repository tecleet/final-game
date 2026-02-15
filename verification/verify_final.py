from playwright.sync_api import sync_playwright, expect
import time

def verify_app():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Load the app
        print("Loading app...")
        page.goto("http://localhost:8000")

        # 2. Test Error Handling (Fake Video ID)
        print("Testing Error Handling...")
        page.fill("#video-id", "INVALID_VIDEO_ID_123")
        page.fill("#api-key", "FAKE_API_KEY")

        # Wait for button to be visible and click it
        page.locator("#btn-connect").click()

        # Give it a moment for the alert (which we ignore in headless usually unless handled)
        # or for UI update
        time.sleep(2)

        # 3. Test Demo Mode
        print("Testing Demo Mode...")
        # Reload to clear state
        page.reload()
        # Wait for reload
        page.wait_for_selector("#btn-fake")

        page.click("#btn-fake")

        # Wait for canvas to be active and particles/boxes to appear
        print("Waiting for demo to start...")
        time.sleep(5) # Give time for boxes to spawn

        # Check if canvas exists
        expect(page.locator("canvas")).to_be_visible()

        # Take screenshot of Demo Mode
        print("Taking screenshot...")
        page.screenshot(path="verification/final_demo_mode.png")

        browser.close()
        print("Verification complete.")

if __name__ == "__main__":
    verify_app()
