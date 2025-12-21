/**
 * Professor URL Collector - Popup Script
 * Handles UI interactions and communicates with content script
 */

// DOM element references
const downloadBtn = document.getElementById("downloadBtn");
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
 * Set googlepeel_status in localStorage on the Google page
 * @param {number} tabId - The tab ID
 * @param {string} statusValue - Status value: "nothing", "working", or "done"
 */
async function setPageStatus(tabId, statusValue) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (status) => {
        localStorage.setItem("googlepeel_status", status);
      },
      args: [statusValue],
    });
  } catch (error) {
    console.error("Error setting page status:", error);
  }
}

/**
 * Collect URLs from a single page
 * @param {number} tabId - The tab ID to collect from
 * @returns {Promise<string[]>} - Array of collected URLs
 */
async function collectUrlsFromPage(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"],
    });
    return results[0]?.result || [];
  } catch (error) {
    console.error("Error collecting URLs from page:", error);
    return [];
  }
}

/**
 * Navigate to the next page by clicking the "Next" button
 * @param {number} tabId - The tab ID to navigate
 * @returns {Promise<boolean>} - True if navigation succeeded
 */
async function goToNextPage(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        // Try multiple selectors for the Next button
        const selectors = [
          "a#pnnext",
          'a[aria-label="Next page"]',
          'a[aria-label="Next"]',
          'td.b a[href*="start="]',
          'a:has(span:contains("Next"))',
          'a[href*="start="]',
        ];

        let nextButton = null;
        for (const selector of selectors) {
          try {
            if (selector.includes(":contains")) {
              // Manual search for Next text
              const links = document.querySelectorAll("a");
              for (const link of links) {
                if (
                  link.textContent.toLowerCase().includes("next") &&
                  link.href.includes("start=")
                ) {
                  nextButton = link;
                  break;
                }
              }
            } else {
              nextButton = document.querySelector(selector);
            }
            if (nextButton) break;
          } catch (e) {
            continue;
          }
        }

        if (nextButton) {
          nextButton.click();
          return true;
        }
        return false;
      },
    });

    if (results[0]?.result) {
      // Wait for page to load
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error navigating to next page:", error);
    return false;
  }
}

/**
 * Collect URLs from the current Google search results page with pagination
 * Collects from up to 5 pages automatically
 */
async function collectUrls() {
  const MAX_PAGES = 5;
  let allUrls = new Set(); // Use Set to avoid duplicates

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

    // Initialize localStorage status to "nothing" then set to "working"
    await setPageStatus(tab.id, "nothing");
    await setPageStatus(tab.id, "working");

    showStatus("Collecting URLs from page 1/5...", "info");

    // Collect URLs from multiple pages
    for (let page = 1; page <= MAX_PAGES; page++) {
      try {
        // Collect URLs from current page
        const urls = await collectUrlsFromPage(tab.id);

        // Add URLs to set (automatically handles duplicates)
        urls.forEach((url) => allUrls.add(url));

        // Update status with current progress
        showStatus(
          `Collecting URLs from page ${page}/5... (${allUrls.size} URLs so far)`,
          "info"
        );
        updateCount(allUrls.size);

        // If this is not the last page, try to navigate to next
        if (page < MAX_PAGES) {
          const navigated = await goToNextPage(tab.id);

          if (!navigated) {
            // No more pages available
            showStatus(
              `Collected from ${page} page${
                page !== 1 ? "s" : ""
              } (no more pages found)`,
              "info"
            );
            break;
          }

          // Small delay to ensure page is ready
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.error(`Error on page ${page}:`, error);
        // Continue to next page even if current page fails
        if (page < MAX_PAGES) {
          try {
            await goToNextPage(tab.id);
            await new Promise((resolve) => setTimeout(resolve, 1500));
          } catch (navError) {
            console.error("Navigation error, stopping pagination:", navError);
            break;
          }
        }
      }
    }

    // Convert Set to Array
    const finalUrls = Array.from(allUrls);

    if (finalUrls.length === 0) {
      showStatus("No matching faculty/professor URLs found.", "info");
      urlList.value = "";
      updateCount(0);
      return;
    }

    // Display URLs in textarea (one per line)
    urlList.value = finalUrls.join("\n");
    updateCount(finalUrls.length);
    showStatus(
      `Successfully collected ${finalUrls.length} URL${
        finalUrls.length !== 1 ? "s" : ""
      } from up to 5 pages!`,
      "success"
    );

    // Set status to "done"
    await setPageStatus(tab.id, "done");

    // Auto-download CSV after collecting URLs
    downloadCsv();
  } catch (error) {
    console.error("Error collecting URLs:", error);
    showStatus(
      "Error: Could not collect URLs. Make sure you're on a Google search page.",
      "error"
    );
    // Set status to "done" even on error
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab) {
        await setPageStatus(tab.id, "done");
      }
    } catch (statusError) {
      console.error("Error setting final status:", statusError);
    }
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

/**
 * Download URLs as CSV file
 */
function downloadCsv() {
  const urls = urlList.value.trim();

  if (!urls) {
    showStatus(
      "No URLs to download. Please wait for collection to complete.",
      "error"
    );
    return;
  }

  try {
    // Create CSV content with header
    const csvContent = "URL\n" + urls;

    // Create blob and download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "google_urls.csv");
    link.style.display = "none";

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    URL.revokeObjectURL(url);

    showStatus("CSV file downloaded successfully!", "success");
  } catch (error) {
    console.error("Error downloading CSV:", error);
    showStatus("Failed to download CSV file.", "error");
  }
}

// Event listeners
downloadBtn.addEventListener("click", downloadCsv);
copyBtn.addEventListener("click", copyToClipboard);
clearBtn.addEventListener("click", clearUrls);

// Auto-collect URLs when popup opens
window.addEventListener("DOMContentLoaded", () => {
  collectUrls();
});
