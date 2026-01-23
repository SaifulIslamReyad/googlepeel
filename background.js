/**
 * Background Service Worker - Auto-trigger extension
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "autoStart") {
    // Get the tab that sent the message
    const tabId = sender.tab.id;

    console.log("Auto-start collection triggered for tab:", tabId);

    // Start the collection process
    startAutoCollection(tabId)
      .then((result) => {
        sendResponse({ success: true, ...result });
      })
      .catch((error) => {
        console.error("Auto-collection error:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep message channel open for async response
  }
});

/**
 * Start automatic collection process
 */
async function startAutoCollection(tabId) {
  let allUrls = [];
  let pageCount = 0;
  const maxPages = 10; // Collect from up to 10 pages

  try {
    // Set status to working
    await setPageStatus(tabId, "working");

    // Collect from multiple pages
    for (let i = 0; i < maxPages; i++) {
      pageCount++;
      console.log(`Collecting from page ${pageCount}...`);

      // Collect URLs from current page
      const urls = await collectUrlsFromPage(tabId);
      allUrls = allUrls.concat(urls);

      console.log(
        `Page ${pageCount}: Found ${urls.length} URLs (Total: ${allUrls.length})`,
      );

      // Try to go to next page
      const hasNext = await goToNextPage(tabId);
      if (!hasNext) {
        console.log("No more pages found");
        break;
      }

      // Wait for next page to load
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Download the results
    if (allUrls.length > 0) {
      await downloadUrls(allUrls);
    } else {
      console.log("No matching faculty/professor URLs found.");
    }

    // Set status to done
    await setPageStatus(tabId, "done");

    // Close the tab after a short delay
    setTimeout(() => {
      chrome.tabs.remove(tabId).catch((err) => {
        console.log("Tab already closed or error closing:", err);
      });
    }, 1000);

    return {
      urlCount: allUrls.length,
      pageCount: pageCount,
    };
  } catch (error) {
    await setPageStatus(tabId, "nothing");
    throw error;
  }
}

/**
 * Collect URLs from a single page
 */
async function collectUrlsFromPage(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"],
    });
    return results[0]?.result || [];
  } catch (error) {
    console.error("Error collecting URLs:", error);
    return [];
  }
}

/**
 * Navigate to next page
 */
async function goToNextPage(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        const nextForm = document.querySelector(
          'form[aria-label="go to page Next"]',
        );
        if (nextForm) {
          nextForm.submit();
          return true;
        }

        const allForms = document.querySelectorAll(
          ".pagination form, .pagination-container form",
        );
        for (const form of allForms) {
          const button = form.querySelector("button");
          if (button && button.textContent.toLowerCase().trim() === "next") {
            form.submit();
            return true;
          }
        }

        return false;
      },
    });
    return results[0]?.result || false;
  } catch (error) {
    console.error("Error navigating to next page:", error);
    return false;
  }
}

/**
 * Set status in localStorage
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
    console.error("Error setting status:", error);
  }
}

/**
 * Download URLs to a file
 */
async function downloadUrls(urls) {
  const content = urls.join("\n");
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const filename = `faculty-urls-${timestamp}.txt`;

  await chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true,
  });

  // Clean up the blob URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
