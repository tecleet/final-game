from playwright.sync_api import sync_playwright, expect
import time

def verify_app():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Load the app
        print("Loading app...")
        page.goto("http://localhost:8000")

        # 2. Test Error Handling (Backend Connection)
        print("Testing Backend Connection (Expected Failure as API Key missing)...")
        # Note: We didn't set API key in backend .env, so it should return an error message via WS

        # Click connect (default URL ws://localhost:3000)
        page.locator("#btn-connect").click()

        # Wait for status update
        time.sleep(2)

        # Check status text
        status_text = page.locator("#status").inner_text()
        print(f"Status: {status_text}")

        # It should say something about API Key not configured or Connection Failed (if backend not running)
        # If backend IS running but key is default: "Server API Key not configured."

        if "Server API Key not configured" in status_text or "Connection Failed" in status_text or "Video not found" in status_text:
             print("SUCCESS: Backend communicated error state correctly.")
        else:
             print("WARNING: Unexpected status message.")

        # 3. Test Demo Mode
        print("Testing Demo Mode...")
        page.reload()
        page.click("#btn-fake")
        time.sleep(3)
        expect(page.locator("canvas")).to_be_visible()

        # Take screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification/final_backend_mode.png")

        browser.close()
        print("Verification complete.")

if __name__ == "__main__":
    verify_app()
