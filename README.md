# Professor URL Collector

A lightweight Chrome extension (Manifest V3) that collects professor/faculty-related URLs from Google search result pages.

## Features

- ✅ Runs only on Google Search result pages
- ✅ Extracts organic result URLs (excludes ads and Google internal links)
- ✅ Filters URLs using academic/faculty keywords
- ✅ Removes false positives using negative keywords
- ✅ Deduplicates URLs automatically
- ✅ Copy to clipboard for external use

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `professor-url-collector` folder
5. The extension icon will appear in your toolbar

## Usage

1. Go to Google and run a search query like:

   ```
   site:harvard.edu ("faculty" OR "professor" OR "academic staff")
   ```

2. Click the extension icon in your Chrome toolbar

3. Click **🔍 Collect URLs** to extract faculty-related links

4. Click **📋 Copy to Clipboard** to copy all URLs

5. Paste into your BAT file or scraping pipeline

## Keyword Filtering

### Positive Keywords (URL must match at least one)

- faculty, professor, academic, staff
- department, people, directory
- our people, faculty directory, staff directory
- research staff, teaching staff

### Negative Keywords (URLs with these are excluded)

- student, admission, apply, fees
- scholarship, hostel, notice, event

## Project Structure

```
professor-url-collector/
├── manifest.json    # Extension configuration
├── popup.html       # Popup UI
├── popup.js         # Popup logic
├── content.js       # URL extraction script
└── README.md        # This file
```

## Notes

- This extension is **manual-triggered only** (no automated crawling)
- Does NOT automate pagination
- Does NOT store data remotely
- Human-assisted and safe for use

## License

MIT License - Free to use and modify
