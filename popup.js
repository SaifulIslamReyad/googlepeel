/**
 * Professor URL Collector - Popup Script
 * Handles UI interactions and communicates with content script
 */

// DOM element references
const collectBtn = document.getElementById("collectBtn");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");
const urlList = document.getElementById("urlList");
const urlCount = document.getElementById("urlCount");
const status = document.getElementById("status");

/**
 * Display a status message to the user
 * @param {string} message - The message to display
 * @param {string} type - Message type: 'success', 'error', or 'info'
 */
function showStatus(message, type) {
  status.textContent = message;
  status.className = "status " + type;

  // Auto-hide success/info messages after 3 seconds
  if (type !== "error") {
    setTimeout(() => {
      status.className = "status";
    }, 3000);
  }
}

/**
 * Update the URL count display
 * @param {number} count - Number of URLs collected
 */
function updateCount(count) {
  if (count > 0) {
    urlCount.textContent = `${count} URL${count !== 1 ? "s" : ""} collected`;
  } else {
    urlCount.textContent = "";
  }
}

/**
 * Collect URLs from the current Google search results page
 * Injects content script and retrieves filtered URLs
 */
async function collectUrls() {
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Validate that we're on a Google search page
    if (!tab.url || !tab.url.includes("google.com/search")) {
      showStatus(
        "Please navigate to a Google search results page first.",
        "error"
      );
      return;
    }

    showStatus("Collecting URLs...", "info");

    // Inject and execute the content script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    // Extract URLs from the script result
    const urls = results[0]?.result || [];

    if (urls.length === 0) {
      showStatus(
        "No matching faculty/professor URLs found on this page.",
        "info"
      );
      urlList.value = "";
      updateCount(0);
      return;
    }

    // Display URLs in textarea (one per line)
    urlList.value = urls.join("\n");
    updateCount(urls.length);
    showStatus(
      `Successfully collected ${urls.length} URL${
        urls.length !== 1 ? "s" : ""
      }!`,
      "success"
    );
  } catch (error) {
    console.error("Error collecting URLs:", error);
    showStatus(
      "Error: Could not collect URLs. Make sure you're on a Google search page.",
      "error"
    );
  }
}

/**
 * Copy all URLs from the textarea to clipboard
 */
async function copyToClipboard() {
  const urls = urlList.value.trim();

  if (!urls) {
    showStatus("No URLs to copy. Collect URLs first.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(urls);
    showStatus("URLs copied to clipboard!", "success");
  } catch (error) {
    console.error("Error copying to clipboard:", error);
    showStatus("Failed to copy to clipboard.", "error");
  }
}

/**
 * Clear all collected URLs from the textarea
 */
function clearUrls() {
  urlList.value = "";
  updateCount(0);
  status.className = "status";
}

// Event listeners
collectBtn.addEventListener("click", collectUrls);
copyBtn.addEventListener("click", copyToClipboard);
clearBtn.addEventListener("click", clearUrls);
