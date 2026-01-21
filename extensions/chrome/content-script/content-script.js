(function() {
  'use strict';

  const MIMEBOOKMARK_STORAGE_KEY = 'mimeBookmark_pageMetadata';

  function extractMetadata() {
    const metadata = {
      url: window.location.href,
      title: extractTitle(),
      description: extractDescription(),
      images: extractImages(),
      favicon: extractFavicon(),
      lang: document.documentElement.lang || 'en',
      type: determinePageType()
    };

    return metadata;
  }

  function extractTitle() {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      const content = (ogTitle.getAttribute('content') || '').trim();
      if (content) return content;
    }

    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) {
      const content = (twitterTitle.getAttribute('content') || '').trim();
      if (content) return content;
    }

    return document.title || '';
  }

  function extractDescription() {
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      const content = (ogDesc.getAttribute('content') || '').trim();
      if (content) return content;
    }

    const twitterDesc = document.querySelector('meta[name="twitter:description"]');
    if (twitterDesc) {
      const content = (twitterDesc.getAttribute('content') || '').trim();
      if (content) return content;
    }

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      const content = (metaDesc.getAttribute('content') || '').trim();
      if (content) return content;
    }

    return '';
  }

  function extractImages() {
    const images = [];

    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) {
      const src = ogImage.getAttribute('content');
      if (src) {
        images.push({
          src: resolveUrl(src),
          type: 'og'
        });
      }
    }

    const twitterImage = document.querySelector('meta[name="twitter:image"]');
    if (twitterImage) {
      const src = twitterImage.getAttribute('content');
      const resolvedSrc = src ? resolveUrl(src) : null;
      if (resolvedSrc && !images.find(i => i.src === resolvedSrc)) {
        images.push({
          src: resolvedSrc,
          type: 'twitter'
        });
      }
    }

    const twitterPlayer = document.querySelector('meta[name="twitter:player"]');
    if (twitterPlayer) {
      const src = twitterPlayer.getAttribute('content');
      const resolvedSrc = src ? resolveUrl(src) : null;
      if (resolvedSrc && !images.find(i => i.src === resolvedSrc)) {
        images.push({
          src: resolvedSrc,
          type: 'player'
        });
      }
    }

    const linkIcon = document.querySelector('link[rel="icon"]');
    if (linkIcon) {
      const href = linkIcon.getAttribute('href');
      if (href) {
        images.push({
          src: resolveUrl(href),
          type: 'icon'
        });
      }
    }

    const linkAppleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (linkAppleIcon) {
      const href = linkAppleIcon.getAttribute('href');
      const resolvedHref = href ? resolveUrl(href) : null;
      if (resolvedHref && !images.find(i => i.src === resolvedHref)) {
        images.push({
          src: resolvedHref,
          type: 'apple-touch-icon'
        });
      }
    }

    return images;
  }

  function extractFavicon() {
    const favicon32 = document.querySelector('link[rel="icon"][sizes="32x32"]');
    if (favicon32) {
      const href = favicon32.getAttribute('href');
      if (href && href.trim()) {
        return resolveUrl(href);
      }
    }

    const favicon16 = document.querySelector('link[rel="icon"][sizes="16x16"]');
    if (favicon16) {
      const href = favicon16.getAttribute('href');
      if (href && href.trim()) {
        return resolveUrl(href);
      }
    }

    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) {
      const href = favicon.getAttribute('href');
      if (href && href.trim()) {
        return resolveUrl(href);
      }
    }

    const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (appleIcon) {
      const href = appleIcon.getAttribute('href');
      if (href && href.trim()) {
        return resolveUrl(href);
      }
    }

    return `${window.location.origin}/favicon.ico`;
  }

  function resolveUrl(url) {
    if (!url) return '';

    try {
      if (url.startsWith('data:')) return url;
      if (url.startsWith('//')) {
        return `${window.location.protocol}${url}`;
      }
      return new URL(url, window.location.href).href;
    } catch {
      return url;
    }
  }

  function determinePageType() {
    if (isVideoPage()) return 'video';
    if (isImagePage()) return 'image';
    if (isArticlePage()) return 'article';
    if (isProductPage()) return 'product';
    if (isGitHubPage()) return 'repository';
    return 'general';
  }

  function isVideoPage() {
    const videoPatterns = [
      /youtube\.com\/watch/,
      /youtu\.be\//,
      /vimeo\.com\//,
      /dailymotion\.com\//,
      /twitch\.tv\//,
      /bilibili\.com\//
    ];

    if (videoPatterns.some(pattern => pattern.test(window.location.href))) {
      return true;
    }

    // Check for primary video content with stricter heuristics
    const videos = document.querySelectorAll('video');
    for (const video of videos) {
      // Check if video has significant duration (>30s)
      if (video.duration > 30) {
        return true;
      }

      // Check if video is in main content area
      const mainContent = document.querySelector('main, article, [role="main"]');
      if (mainContent && mainContent.contains(video)) {
        // Check if video takes up significant viewport area
        const rect = video.getBoundingClientRect();
        const viewportArea = window.innerWidth * window.innerHeight;
        const videoArea = rect.width * rect.height;
        if (videoArea > viewportArea * 0.25) {
          return true;
        }
      }

      // Check if video has visible controls and is not muted/background
      if (video.controls && !video.muted && video.offsetParent !== null) {
        return true;
      }
    }

    return false;
  }

  function isImagePage() {
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?.*)?$/i;
    if (imageExtensions.test(window.location.href)) return true;

    const imageHostPatterns = [
      /500px\.com\//,
      /unsplash\.com\//,
      /pexels\.com\//,
      /imgur\.com\//
    ];

    if (imageHostPatterns.some(pattern => pattern.test(window.location.href))) {
      return true;
    }

    // Check for large visible srcset images
    const srcsetImages = Array.from(document.querySelectorAll('img[srcset]'));
    const visibleLargeImages = srcsetImages.filter(img => {
      const rect = img.getBoundingClientRect();
      const area = rect.width * rect.height;
      const isVisible = rect.width > 0 && rect.height > 0 &&
                       window.getComputedStyle(img).visibility !== 'hidden' &&
                       window.getComputedStyle(img).display !== 'none';
      return isVisible && (rect.width >= 400 || rect.height >= 400 || area >= 100000);
    });

    const bodyText = document.body ? document.body.textContent.trim() : '';
    const hasMinimalText = bodyText.length < 200;

    return (visibleLargeImages.length === 1) || (visibleLargeImages.length > 0 && hasMinimalText);
  }

  function isArticlePage() {
    const articleIndicators = [
      'article',
      'blog',
      'news',
      'post'
    ];

    const bodyClasses = document.body ? document.body.className.toLowerCase() : '';
    if (articleIndicators.some(indicator => bodyClasses.includes(indicator))) return true;

    const mainElement = document.querySelector('main, article, [role="article"]');
    if (mainElement) {
      const textContent = mainElement.textContent || '';
      const wordCount = textContent.split(/\s+/).length;
      if (wordCount > 300) return true;
    }

    return false;
  }

  function isProductPage() {
    // Primary check: schema markup (most reliable)
    const productSchema = document.querySelector('[itemtype*="Product"]');
    if (productSchema) return true;

    // Secondary check: text heuristics with stricter validation
    const productIndicators = [
      'product',
      'price',
      'add to cart',
      'buy now'
    ];

    const pageText = document.body ? document.body.textContent.toLowerCase() : '';
    const matchCount = productIndicators.filter(indicator =>
      pageText.includes(indicator)
    ).length;

    // Require at least 2 indicators AND a purchase signal
    if (matchCount >= 2) {
      // Check for price pattern (common currency symbols)
      const priceRegex = /[\$\€\£\¥]\s*\d+|USD\s*\d+|EUR\s*\d+|GBP\s*\d+/i;
      const priceRegexFound = priceRegex.test(pageText);

      // Check for visible purchase controls
      const purchaseButtons = document.querySelectorAll('button, input[type="button"], input[type="submit"], a');
      const purchaseButtonFound = Array.from(purchaseButtons).some(el => {
        const text = (el.textContent || el.value || '').toLowerCase();
        return text.includes('add to cart') ||
               text.includes('buy now') ||
               text.includes('add to bag') ||
               text.includes('purchase');
      });

      if (priceRegexFound || purchaseButtonFound) {
        return true;
      }
    }

    return false;
  }

  function isGitHubPage() {
    const hostname = window.location.hostname;
    if (hostname !== 'github.com' && !hostname.endsWith('.github.com')) {
      return false;
    }

    // List of reserved GitHub path segments that are not owner/repo patterns
    const reservedSegments = [
      'settings', 'notifications', 'orgs', 'site', 'issues', 'pulls', 'explore',
      'topics', 'trending', 'collections', 'events', 'marketplace', 'sponsors',
      'about', 'contact', 'pricing', 'blog', 'support', 'security', 'login',
      'join', 'new', 'organizations', 'enterprise', 'nonprofit', 'customer-stories',
      'features', 'search', 'repositories', 'users', 'watching', 'stars', 'following',
      'followers', 'gist', 'codespaces', 'projects', 'dashboard'
    ];

    // GitHub owner/repo name pattern: alphanumeric, hyphens, underscores, dots
    const validSegmentPattern = /^[A-Za-z0-9_.-]+$/;

    // Check if pathname matches owner/repo pattern
    const pathSegments = window.location.pathname.split('/').filter(Boolean);

    // Repository pages have at least two non-empty path segments (owner and repo)
    if (pathSegments.length < 2) {
      return false;
    }

    const owner = pathSegments[0];
    const repo = pathSegments[1];

    // Validate both segments match the pattern and are not reserved
    if (!validSegmentPattern.test(owner) || !validSegmentPattern.test(repo)) {
      return false;
    }

    // Check if owner is a reserved segment
    if (reservedSegments.includes(owner.toLowerCase())) {
      return false;
    }

    return true;
  }

  function storeMetadata(metadata) {
    try {
      localStorage.setItem(MIMEBOOKMARK_STORAGE_KEY, JSON.stringify({
        metadata,
        url: window.location.href,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('MimeBookmark: Failed to store metadata:', e);
    }
  }

  function getStoredMetadata() {
    try {
      const stored = localStorage.getItem(MIMEBOOKMARK_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const oneHour = 60 * 60 * 1000;
        // Validate that the cached entry is for the current page
        if (Date.now() - data.timestamp < oneHour && data.url === window.location.href) {
          return data.metadata;
        }
      }
    } catch (e) {
      console.warn('MimeBookmark: Failed to retrieve stored metadata:', e);
    }
    return null;
  }

  function clearStoredMetadata() {
    try {
      localStorage.removeItem(MIMEBOOKMARK_STORAGE_KEY);
    } catch (e) {
      console.warn('MimeBookmark: Failed to clear stored metadata:', e);
    }
  }

  function exposeToBackgroundScript() {
    window.__mimeBookmark__ = Object.freeze({
      getMetadata: function() {
        return getStoredMetadata() || extractMetadata();
      },
      extractFresh: function() {
        const metadata = extractMetadata();
        storeMetadata(metadata);
        return metadata;
      },
      clearCache: function() {
        clearStoredMetadata();
      }
    });
  }

  function appendNodeSafely(node, prefer = 'head') {
    const targets = {
      head: () => document.head,
      body: () => document.body,
      root: () => document.documentElement,
    };

    const orderedTargets =
      prefer === 'head'
        ? [targets.head, targets.body, targets.root]
        : [targets.body, targets.head, targets.root];

    const tryAppend = () => {
      for (const getTarget of orderedTargets) {
        const target = getTarget();
        if (target) {
          target.appendChild(node);
          return true;
        }
      }
      return false;
    };

    if (tryAppend()) return;

    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          tryAppend();
        },
        { once: true },
      );
    } else {
      tryAppend();
    }
  }

  function injectFloatingButton() {
    const existingButton = document.getElementById('mimebookmark-floating-btn');
    if (existingButton) return;

    const button = document.createElement('button');
    button.id = 'mimebookmark-floating-btn';
    button.type = 'button';
    button.setAttribute('aria-label', 'Save to MimeBookmark');
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    button.title = 'Save to MimeBookmark';

    const style = document.createElement('style');
    style.textContent = `
      #mimebookmark-floating-btn {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      #mimebookmark-floating-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
      }
      #mimebookmark-floating-btn:active {
        transform: scale(0.95);
      }
    `;

    button.addEventListener('click', () => {
      try {
        chrome.runtime.sendMessage({
          action: 'openPopup',
          metadata: window.__mimeBookmark__.extractFresh()
        });
      } catch (error) {
        console.warn('MimeBookmark: Failed to send message to background script:', error);
      }
    });

    appendNodeSafely(style, 'head');
    appendNodeSafely(button, 'body');
  }

  function init() {
    const metadata = extractMetadata();
    storeMetadata(metadata);
    exposeToBackgroundScript();

    try {
      chrome.runtime.sendMessage({
        action: 'metadataReady',
        metadata
      });
    } catch (error) {
      console.warn('MimeBookmark: Failed to send metadataReady message:', error);
    }

    if (shouldShowFloatingButton()) {
      injectFloatingButton();
    }
  }

  function shouldShowFloatingButton() {
    const excludedDomains = [
      'youtube.com',
      'twitter.com',
      'x.com',
      'facebook.com',
      'instagram.com',
      'linkedin.com',
      'mail.google.com'
    ];

    const hostname = window.location.hostname;
    return !excludedDomains.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  const observer = new MutationObserver((mutations) => {
    let shouldReextract = false;

    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        const target = mutation.target;
        if (
          target.tagName === 'META' &&
          (target.getAttribute('property') === 'og:title' || target.getAttribute('name') === 'twitter:title') &&
          mutation.attributeName === 'content'
        ) {
          shouldReextract = true;
          break;
        }
      }
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'META' && (node.getAttribute('property') === 'og:title' || node.getAttribute('name') === 'twitter:title')) {
              shouldReextract = true;
              break;
            }
            if (node.querySelector && node.querySelector('meta[property="og:title"]')) {
              shouldReextract = true;
              break;
            }
          }
        }
      }
      if (shouldReextract) break;
    }

    if (shouldReextract) {
      const metadata = extractMetadata();
      storeMetadata(metadata);

      try {
        chrome.runtime.sendMessage({
          action: 'metadataUpdated',
          metadata
        });
      } catch (error) {
        console.warn('MimeBookmark: Failed to send metadataUpdated message:', error);
      }
    }
  });

  function onDomReady(cb) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cb, { once: true });
    } else {
      cb();
    }
  }

  function attachMetadataObserver() {
    const target = document.head || document.documentElement;
    if (!target) return;
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['content', 'property', 'name']
    });
  }

  onDomReady(attachMetadataObserver);

})();
