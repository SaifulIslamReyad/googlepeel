/**
 * Professor URL Collector - Content Script
 * Extracts and filters faculty/professor-related URLs from Startpage search results
 *
 * This script runs in the context of the Startpage search results page
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
   * Check if a URL is a Startpage internal link (should be excluded)
   * @param {string} url - The URL to check
   * @returns {boolean} - True if URL is a Startpage internal link
   */
  function isStartpageInternalLink(url) {
    const startpagePatterns = [
      "startpage.com",
      "startmail.com",
      "/sp/search",
      "/do/search",
      "google.com",
      "google.co.",
      "youtube.com",
      "youtu.be",
    ];
    return startpagePatterns.some((pattern) => url.includes(pattern));
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
   * Extract organic search result URLs from Startpage search page
   * Uses multiple strategies to find all external links
   * @returns {string[]} - Array of extracted URLs
   */
  function extractOrganicResultUrls() {
    const urls = [];

    // Strategy 1: Target specific Startpage result link selectors
    const resultSelectors = [
      "a.result-title.result-link", // Main result title links
      "a.result-link", // Result links
      "a.wgl-display-url", // Display URL links
      'a[data-testid="gl-title-link"]', // Title links with test ID
      'a[data-testid="result-favicon"]', // Favicon links (also have URLs)
      '.result a[href^="http"]', // Any http links inside result divs
      '.w-gl a[href^="http"]', // Links inside web results container
    ];

    // Try each selector
    resultSelectors.forEach((selector) => {
      try {
        const links = document.querySelectorAll(selector);
        links.forEach((link) => {
          const href = link.getAttribute("href");
          if (href && href.startsWith("http")) {
            const lowerHref = href.toLowerCase();
            if (
              !lowerHref.includes("startpage.com") &&
              !lowerHref.includes("startmail.com") &&
              !lowerHref.includes("browse.startpage.com")
            ) {
              urls.push(href);
            }
          }
        });
      } catch (e) {
        console.log(`Selector ${selector} failed:`, e);
      }
    });

    // Strategy 2: Fallback - Get ALL links on the page that start with http
    const allLinks = document.querySelectorAll('a[href^="http"]');

    console.log(
      `[Startpage Collector] Total links found on page: ${allLinks.length}`,
    );

    allLinks.forEach((link) => {
      const href = link.getAttribute("href");
      if (href) {
        // Skip startpage internal links at extraction level
        const lowerHref = href.toLowerCase();
        if (
          !lowerHref.includes("startpage.com") &&
          !lowerHref.includes("startmail.com") &&
          !lowerHref.includes("browse.startpage.com")
        ) {
          urls.push(href);
        }
      }
    });

    // Log for debugging
    console.log(`[Startpage URL Collector] Found ${urls.length} external URLs`);

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

      // Exclude Startpage internal links
      if (isStartpageInternalLink(lowerUrl)) {
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
      `[Professor URL Collector] Extracted ${rawUrls.length} raw URLs`,
    );

    // Step 2: Filter URLs based on keywords
    const filteredUrls = filterUrls(rawUrls);
    console.log(
      `[Professor URL Collector] Filtered to ${filteredUrls.length} matching URLs`,
    );

    // Step 3: Deduplicate URLs
    const uniqueUrls = deduplicateUrls(filteredUrls);
    console.log(
      `[Professor URL Collector] Final ${uniqueUrls.length} unique URLs`,
    );

    return uniqueUrls;
  }

  // Execute and return the result
  // This value is returned to the popup script via chrome.scripting.executeScript
  return collectProfessorUrls();
})();
