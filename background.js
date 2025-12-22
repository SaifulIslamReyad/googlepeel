/**
 * Background Service Worker - Auto-trigger extension
 */

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "autoTrigger") {
    // Open the popup programmatically
    chrome.action.openPopup()
      .then(() => {
        console.log("Popup opened successfully");
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Failed to open popup:", error);
        // Fallback: execute collection directly
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ["popup.js"]
            });
          }
        });
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
});

console.log("GooglePeel background service worker loaded");
