/**
 * Visitor Traffic & IP Tracker
 * Automatically logs pageviews, visitor IPs, and session metrics.
 */
(function() {
  'use strict';

  const STORAGE_KEY_TRAFFIC = 'local_visitor_traffic_log';
  const STORAGE_KEY_BACKEND = 'admin_backend_url';

  function getBackendUrl() {
    return localStorage.getItem(STORAGE_KEY_BACKEND) || '';
  }

  function logLocalVisit(ip) {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY_TRAFFIC) || '[]');
      const newEntry = {
        id: Date.now(),
        ip_address: ip || 'Local / Direct',
        path: window.location.pathname || '/',
        referrer: document.referrer || 'Direct Visit',
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };
      existing.unshift(newEntry);
      // Keep most recent 250 records
      if (existing.length > 250) existing.length = 250;
      localStorage.setItem(STORAGE_KEY_TRAFFIC, JSON.stringify(existing));
    } catch (e) {
      console.warn('Traffic local log error:', e);
    }
  }

  async function trackVisit() {
    const payload = {
      path: window.location.pathname || '/',
      referrer: document.referrer || '',
      user_agent: navigator.userAgent
    };

    const backendUrl = getBackendUrl();
    const endpointsToTry = [];

    // 1. Configured backend
    if (backendUrl) {
      endpointsToTry.push(backendUrl.replace(/\/$/, '') + '/api/track');
    }
    // 2. Relative endpoint (if served via Flask directly)
    endpointsToTry.push('/api/track');

    let backendSuccess = false;
    for (const url of endpointsToTry) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          backendSuccess = true;
          break;
        }
      } catch (err) {
        // Continue to fallback
      }
    }

    // Client-side fallback logging for static GitHub Pages
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      if (res.ok) {
        const data = await res.json();
        logLocalVisit(data.ip);
      } else {
        logLocalVisit('Unknown IP');
      }
    } catch (_) {
      logLocalVisit('127.0.0.1');
    }
  }

  // Execute after window load so it does not block canvas or circuit initialization
  if (document.readyState === 'complete') {
    trackVisit();
  } else {
    window.addEventListener('load', trackVisit);
  }
})();
