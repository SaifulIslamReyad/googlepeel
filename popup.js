/**
 * Professor URL Collector - Popup Script
 * Handles UI interactions and communicates with content script
 */

// DOM element references
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
}

/**
 * Update the URL count display
 * @param {number} count - Number of URLs collected
 */
function updateCount(count) {
  urlCount.textContent =
    count > 0 ? `${count} URL${count !== 1 ? "s" : ""} collected` : "";
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
        // Strategy 1: Find the "Next" pagination form and submit it
        // Startpage uses form submission with POST for pagination
        const nextForm = document.querySelector(
          'form[aria-label="go to page Next"]',
        );
        if (nextForm) {
          console.log("[Startpage] Found Next form, submitting...");
          nextForm.submit();
          return true;
        }

        // Strategy 2: Find form containing a button with "Next" text
        const allForms = document.querySelectorAll(
          ".pagination form, .pagination-container form",
        );
        for (const form of allForms) {
          const button = form.querySelector("button");
          if (button && button.textContent.toLowerCase().trim() === "next") {
            console.log("[Startpage] Found Next button in form, submitting...");
            form.submit();
            return true;
          }
        }

        // Strategy 3: Try button selectors for Next button
        const selectors = [
          'button[data-testid="pagination-button"]',
          "button.next",
          "a.next",
          'button[aria-label="Next"]',
          'a[aria-label="Next"]',
          ".pagination button:last-child",
          ".pagination a:last-child",
          "button.w-gl__pagination-button--next",
        ];

        let nextButton = null;
        for (const selector of selectors) {
          try {
            const buttons = document.querySelectorAll(selector);
            for (const btn of buttons) {
              if (btn.textContent.toLowerCase().trim() === "next") {
                nextButton = btn;
                break;
              }
            }
            if (nextButton) break;
          } catch (e) {
            continue;
          }
        }

        // Strategy 4: Fallback - search for Next text in buttons/links
        if (!nextButton) {
          const elements = document.querySelectorAll("button, a");
          for (const el of elements) {
            if (
              el.textContent.toLowerCase().trim() === "next" ||
              el.textContent.toLowerCase().includes("next page")
            ) {
              nextButton = el;
              break;
            }
          }
        }

        if (nextButton) {
          console.log("[Startpage] Clicking Next button...");
          // Check if button is inside a form
          const parentForm = nextButton.closest("form");
          if (parentForm) {
            parentForm.submit();
          } else {
            nextButton.click();
          }
          return true;
        }

        console.log("[Startpage] No Next button/form found");
        return false;
      },
    });

    if (results[0]?.result) {
      // Wait for page to load - Form submission navigates to new page
      // Need longer wait for full page navigation and DOM load
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Additional check: wait for content to be ready
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            return new Promise((resolve) => {
              // Wait for results to appear
              const checkResults = () => {
                const results = document.querySelector(
                  '.w-gl, .result, [class*="result"]',
                );
                if (results) {
                  resolve(true);
                } else {
                  setTimeout(checkResults, 500);
                }
              };
              checkResults();
              // Timeout after 5 seconds
              setTimeout(() => resolve(true), 5000);
            });
          },
        });
      } catch (e) {
        // Ignore errors, just continue
      }

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

    // Validate that we're on a Startpage search page
    if (!tab.url || !tab.url.includes("startpage.com")) {
      showStatus(
        "Please navigate to a Startpage search results page first.",
        "error",
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

        // Update textarea with current URLs (show progress in real-time)
        urlList.value = Array.from(allUrls).join("\n");

        // Update status with current progress
        showStatus(
          `Collecting URLs from page ${page}/5... (${allUrls.size} URLs so far)`,
          "info",
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
              "info",
            );
            break;
          }

          // Small delay to ensure page content is fully loaded
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
      } catch (error) {
        console.error(`Error on page ${page}:`, error);
        // Continue to next page even if current page fails
        if (page < MAX_PAGES) {
          try {
            await goToNextPage(tab.id);
            await new Promise((resolve) => setTimeout(resolve, 2500));
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

      // Set status to "done" even when no URLs found
      await setPageStatus(tab.id, "done");

      // Close the tab after a short delay
      setTimeout(() => {
        chrome.tabs.remove(tab.id);
      }, 1000);
      return;
    }

    // Display URLs in textarea (one per line)
    urlList.value = finalUrls.join("\n");
    updateCount(finalUrls.length);
    showStatus(
      `Successfully collected ${finalUrls.length} URL${
        finalUrls.length !== 1 ? "s" : ""
      } from up to 5 pages!`,
      "success",
    );

    // Set status to "done"
    await setPageStatus(tab.id, "done");

    // Auto-download CSV after collecting URLs
    downloadCsv();
  } catch (error) {
    console.error("Error collecting URLs:", error);
    showStatus(
      "Error: Could not collect URLs. Make sure you're on a Startpage search page.",
      "error",
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
 * Download URLs as CSV file
 */
function downloadCsv() {
  const urls = urlList.value.trim();

  if (!urls) {
    showStatus(
      "No URLs to download. Please wait for collection to complete.",
      "error",
    );
    return;
  }

  try {
    // Create CSV content with header
    const csvContent = "URL\n" + urls;

    // Create blob and download using Chrome Downloads API with custom path
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    // Download CSV file
    chrome.downloads.download(
      {
        url: url,
        filename: "startpage_urls.csv",
        saveAs: false,
        conflictAction: "overwrite",
      },
      async (downloadId) => {
        URL.revokeObjectURL(url);

        if (chrome.runtime.lastError) {
          console.error("Download error:", chrome.runtime.lastError);
          showStatus("Failed to download CSV file.", "error");
        } else {
          console.log("Download started with ID:", downloadId);
          showStatus("CSV file downloaded successfully!", "success");

          // Close the Chrome tab after successful download
          try {
            const [tab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            if (tab) {
              setTimeout(() => {
                chrome.tabs.remove(tab.id);
              }, 1000);
            }
          } catch (error) {
            console.error("Error closing tab:", error);
          }
        }
      },
    );
  } catch (error) {
    console.error("Error downloading CSV:", error);
    showStatus("Failed to download CSV file.", "error");
  }
}

// Auto-collect URLs when popup opens
window.addEventListener("DOMContentLoaded", () => {
  collectUrls();
});
