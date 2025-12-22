/**
 * Auto-trigger Content Script
 * Runs on Google search pages with #googlepeel hash
 */

(function () {
  "use strict";

  // Check if URL has #googlepeel hash
  if (window.location.hash === "#googlepeel") {
    console.log("GooglePeel auto-trigger detected");

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
