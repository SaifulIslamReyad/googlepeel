/**
 * Background Service Worker - Auto-trigger extension
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "autoTrigger") {
    chrome.action
      .openPopup()
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error("Failed to open popup:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});
