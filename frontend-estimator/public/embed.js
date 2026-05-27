(function () {
  'use strict';

  // Derive base URL from the script tag itself — survives domain changes automatically
  var BASE_URL = (function () {
    try {
      var s = document.currentScript || (function () {
        var tags = document.getElementsByTagName('script');
        return tags[tags.length - 1];
      })();
      return new URL(s.src).origin;
    } catch (e) {
      return 'https://estimate.coatingpro360.com';
    }
  })();

  function init() {
    var container = document.getElementById('cp360-estimator');
    if (!container) return;

    var company = container.getAttribute('data-company');
    if (!company) return;

    // Build iframe src with UTM passthrough from the host page
    var src = new URL(BASE_URL);
    src.searchParams.set('company', company);

    var utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    var pageParams = new URLSearchParams(window.location.search);
    utmKeys.forEach(function (k) {
      var v = pageParams.get(k) || sessionStorage.getItem('cp360_' + k);
      if (v) src.searchParams.set(k, v);
    });

    // Create and inject iframe
    var iframe = document.createElement('iframe');
    iframe.id = 'cp360-iframe';
    iframe.src = src.toString();
    iframe.width = '100%';
    iframe.height = '600';
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    iframe.style.cssText = 'border:0; border-radius:14px; display:block; width:100%;';
    container.appendChild(iframe);

    // Listen for messages from the estimator
    window.addEventListener('message', function (e) {
      if (!e.data) return;

      // Auto-height: estimator reports its scroll height
      if (e.data.cp360Height) {
        iframe.style.height = e.data.cp360Height + 'px';
        return;
      }

      // Conversion pixel: fire Microsoft event code if present
      if (e.data.event === 'estimator_conversion' && e.data.microsoftEventCode) {
        try { new Function(e.data.microsoftEventCode)(); } catch (err) {}
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
