const resource = [
  /* --- CSS --- */
  '/assets/css/jekyll-theme-chirpy.css',

  /* --- PWA --- */
  '/app.js',
  '/sw.js',

  /* --- HTML --- */
  '/index.html',
  '/404.html',

  
    '/categories/',
  
    '/tags/',
  
    '/archives/',
  
    '/about/',
  

  /* --- Favicons & compressed JS --- */
  
  
    '/assets/img/favicons/android-chrome-192x192.png',
    '/assets/img/favicons/android-chrome-512x512.png',
    '/assets/img/favicons/apple-touch-icon.png',
    '/assets/img/favicons/favicon-16x16.png',
    '/assets/img/favicons/favicon-32x32.png',
    '/assets/img/favicons/favicon.ico',
    '/assets/img/favicons/mstile-150x150.png',
    '/assets/js/dist/categories.min.js',
    '/assets/js/dist/commons.min.js',
    '/assets/js/dist/home.min.js',
    '/assets/js/dist/misc.min.js',
    '/assets/js/dist/modules/components/back-to-top.js',
    '/assets/js/dist/modules/components/category-collapse.js',
    '/assets/js/dist/modules/components/clipboard.js',
    '/assets/js/dist/modules/components/img-loading.js',
    '/assets/js/dist/modules/components/img-popup.js',
    '/assets/js/dist/modules/components/locale-datetime.js',
    '/assets/js/dist/modules/components/mode-watcher.js',
    '/assets/js/dist/modules/components/search-display.js',
    '/assets/js/dist/modules/components/sidebar.js',
    '/assets/js/dist/modules/components/toc.js',
    '/assets/js/dist/modules/components/tooltip-loader.js',
    '/assets/js/dist/modules/layouts.js',
    '/assets/js/dist/modules/layouts/basic.js',
    '/assets/js/dist/modules/layouts/sidebar.js',
    '/assets/js/dist/modules/layouts/topbar.js',
    '/assets/js/dist/modules/plugins.js',
    '/assets/js/dist/page.min.js',
    '/assets/js/dist/post.min.js',
    '/assets/js/dist/_copyright'
];

/* The request url with below domain will be cached */
const allowedDomains = [
  

  'localhost:4000',

  
    'chirpy-img.netlify.app',
  

  'fonts.gstatic.com',
  'fonts.googleapis.com',
  'cdn.jsdelivr.net',
  'polyfill.io'
];

/* Requests that include the following path will be banned */
const denyUrls = [];

