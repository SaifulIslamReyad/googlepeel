/**
 * Professor URL Collector - Content Script
 * Extracts and filters faculty/professor-related URLs from Google search results
 *
 * This script runs in the context of the Google search results page
 * and returns an array of filtered, deduplicated URLs.
 */

(function () {
  "use strict";

  // ============================================
  // CONFIGURATION: Keyword Lists for Filtering
  // ============================================

  /**
   * Positive keywords - URL must contain at least one of these
   * These indicate faculty/professor/academic directory pages
   */
  const GOOD_KEYWORDS = [
    "faculty",
    "professor",
    "academic",
    "staff",
    "department",
    "people",
    "directory",
    "our people",
    "faculty directory",
    "staff directory",
    "research staff",
    "teaching staff",
  ];

  /**
   * Negative keywords - URL must NOT contain any of these
   * These indicate student-focused or non-relevant pages
   */
  const BAD_KEYWORDS = [
    "student",
    "admission",
    "apply",
    "fees",
    "scholarship",
    "hostel",
    "notice",
    "event",
  ];

  // ============================================
  // URL FILTERING FUNCTIONS
  // ============================================

  /**
   * Check if a URL contains at least one positive keyword
   * @param {string} url - The URL to check (lowercase)
   * @returns {boolean} - True if URL contains a positive keyword
   */
  function hasPositiveKeyword(url) {
    return GOOD_KEYWORDS.some((keyword) => url.includes(keyword.toLowerCase()));
  }

  /**
   * Check if a URL contains any negative keywords
   * @param {string} url - The URL to check (lowercase)
   * @returns {boolean} - True if URL contains a negative keyword (should be excluded)
   */
  function hasNegativeKeyword(url) {
    return BAD_KEYWORDS.some((keyword) => url.includes(keyword.toLowerCase()));
  }

  /**
   * Check if a URL is a Google internal link (should be excluded)
   * @param {string} url - The URL to check
   * @returns {boolean} - True if URL is a Google internal link
   */
  function isGoogleInternalLink(url) {
    const googlePatterns = [
      "google.com",
      "google.co.",
      "gstatic.com",
      "googleapis.com",
      "youtube.com",
      "youtu.be",
      "/search?",
      "accounts.google",
      "support.google",
      "policies.google",
      "maps.google",
    ];
    return googlePatterns.some((pattern) => url.includes(pattern));
  }

  /**
   * Check if a URL is valid for collection
   * @param {string} url - The URL to validate
   * @returns {boolean} - True if URL is valid HTTP(S) link
   */
  function isValidUrl(url) {
    return url && (url.startsWith("http://") || url.startsWith("https://"));
  }

  /**
   * Normalize a URL by removing trailing slashes and fragments
   * This helps with deduplication
   * @param {string} url - The URL to normalize
   * @returns {string} - Normalized URL
   */
  function normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      // Remove fragment (hash)
      urlObj.hash = "";
      // Get the URL string
      let normalized = urlObj.toString();
      // Remove trailing slash (except for root domains)
      if (normalized.endsWith("/") && urlObj.pathname !== "/") {
        normalized = normalized.slice(0, -1);
      }
      return normalized;
    } catch (e) {
      // If URL parsing fails, return original with basic cleanup
      return url.replace(/\/$/, "").split("#")[0];
    }
  }

  // ============================================
  // URL EXTRACTION FUNCTIONS
  // ============================================

  /**
   * Extract organic search result URLs from Google search page
   * Uses multiple selectors to capture results from different Google layouts
   * @returns {string[]} - Array of extracted URLs
   */
  function extractOrganicResultUrls() {
    const urls = [];

    // Selector strategies for Google organic results
    // Google frequently changes their DOM structure, so we use multiple approaches

    // Strategy 1: Main search result links (most common)
    // These are typically in divs with data-ved attribute, containing <a> tags with href
    const mainResults = document.querySelectorAll('#search a[href^="http"]');

    // Strategy 2: Result containers with specific structure
    const resultContainers = document.querySelectorAll('div.g a[href^="http"]');

    // Strategy 3: Cite elements often contain the display URL
    // But we want the actual link href, not the displayed text
    const citeParentLinks = document.querySelectorAll("div.g cite");

    // Collect from main results
    mainResults.forEach((link) => {
      const href = link.getAttribute("href");
      if (href) {
        urls.push(href);
      }
    });

    // Collect from result containers
    resultContainers.forEach((link) => {
      const href = link.getAttribute("href");
      if (href) {
        urls.push(href);
      }
    });

    // Also check for links in the main content area
    // This catches results that might use different markup
    const mainContent =
      document.querySelector("#main") || document.querySelector("#center_col");
    if (mainContent) {
      const contentLinks = mainContent.querySelectorAll('a[href^="http"]');
      contentLinks.forEach((link) => {
        const href = link.getAttribute("href");
        if (href) {
          urls.push(href);
        }
      });
    }

    return urls;
  }

  /**
   * Filter URLs based on inclusion/exclusion criteria
   * @param {string[]} urls - Array of URLs to filter
   * @returns {string[]} - Filtered array of URLs
   */
  function filterUrls(urls) {
    return urls.filter((url) => {
      // Convert to lowercase for case-insensitive matching
      const lowerUrl = url.toLowerCase();

      // Must be a valid HTTP(S) URL
      if (!isValidUrl(url)) {
        return false;
      }

      // Exclude Google internal links
      if (isGoogleInternalLink(lowerUrl)) {
        return false;
      }

      // Must contain at least one positive keyword
      if (!hasPositiveKeyword(lowerUrl)) {
        return false;
      }

      // Must NOT contain any negative keywords
      if (hasNegativeKeyword(lowerUrl)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Deduplicate URLs after normalization
   * @param {string[]} urls - Array of URLs (may contain duplicates)
   * @returns {string[]} - Array of unique URLs
   */
  function deduplicateUrls(urls) {
    const seen = new Set();
    const unique = [];

    urls.forEach((url) => {
      const normalized = normalizeUrl(url);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(normalized);
      }
    });

    return unique;
  }

  // ============================================
  // MAIN EXECUTION
  // ============================================

  /**
   * Main function to collect professor/faculty URLs
   * @returns {string[]} - Array of filtered, deduplicated URLs
   */
  function collectProfessorUrls() {
    // Step 1: Extract all URLs from organic search results
    const rawUrls = extractOrganicResultUrls();
    console.log(
      `[Professor URL Collector] Extracted ${rawUrls.length} raw URLs`
    );

    // Step 2: Filter URLs based on keywords
    const filteredUrls = filterUrls(rawUrls);
    console.log(
      `[Professor URL Collector] Filtered to ${filteredUrls.length} matching URLs`
    );

    // Step 3: Deduplicate URLs
    const uniqueUrls = deduplicateUrls(filteredUrls);
    console.log(
      `[Professor URL Collector] Final ${uniqueUrls.length} unique URLs`
    );

    return uniqueUrls;
  }

  // Execute and return the result
  // This value is returned to the popup script via chrome.scripting.executeScript
  return collectProfessorUrls();
})();
