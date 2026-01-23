/**
 * Auto-trigger Content Script
 * Runs on Startpage search pages with #startpagepeel hash
 */

(function () {
  "use strict";

  // Check if URL has #startpagepeel hash (also support legacy #googlepeel)
  if (
    window.location.hash === "#startpagepeel" ||
    window.location.hash === "#googlepeel"
  ) {
    console.log("StartpagePeel auto-trigger detected");

    // Set initial status
    localStorage.setItem("googlepeel_status", "nothing");

    // Wait a bit for page to fully load
    setTimeout(() => {
      // Send message to background script to open popup
      chrome.runtime.sendMessage({ action: "autoTrigger" }, (response) => {
        console.log("Auto-trigger response:", response);
      });
    }, 1000);
  }
})();
