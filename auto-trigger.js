/**
 * Auto-trigger Content Script
 * Runs on Startpage search pages with ext=googlepeel parameter or hash
 */

(function () {
  "use strict";

  // Check if URL has ext=googlepeel query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const hasExtParam = urlParams.get("ext") === "googlepeel";

  // Also support legacy hash triggers
  const hasHashTrigger =
    window.location.hash === "#startpagepeel" ||
    window.location.hash === "#googlepeel";

  if (hasExtParam || hasHashTrigger) {
    console.log(
      "StartpagePeel auto-trigger detected via",
      hasExtParam ? "query param" : "hash",
    );

    // Set initial status
    localStorage.setItem("googlepeel_status", "working");

    // Wait a bit for page to fully load
    setTimeout(() => {
      // Send message to background script to start auto-collection
      chrome.runtime.sendMessage({ action: "autoStart" }, (response) => {
        if (response && response.success) {
          console.log("Auto-collection started:", response);
        } else {
          console.error("Auto-collection failed:", response);
        }
      });
    }, 1500);
  }
})();
