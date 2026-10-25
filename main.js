/* South Park TV prototype. Original site and player; no media proxy. */
(function () {
  'use strict';
  var AD_HOSTS = ['doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adnxs.com', 'adsrvr.org'];
  function safeURL(raw, base) {
    try {
      var u = new URL(raw, base);
      return u.protocol === 'https:' && u.hostname === 'www.southpark.de' && !u.port && !u.username && !u.password ? u.href : null;
    } catch (_) { return null; }
  }
  function blockedHost(raw) {
    try {
      var host = new URL(raw, 'https://www.southpark.de').hostname;
      return AD_HOSTS.some(function (d) { return host === d || host.slice(-(d.length + 1)) === '.' + d; });
    } catch (_) { return false; }
  }
  function chooseDirection(rects, current, direction) {
    if (!rects.length) return -1;
    var a = rects[current] || rects[0], best = current, score = Infinity;
    var ax = a.x + a.width / 2, ay = a.y + a.height / 2;
    rects.forEach(function (b, index) {
      if (index === current) return;
      var dx = b.x + b.width / 2 - ax, dy = b.y + b.height / 2 - ay;
      var major = direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy;
      var minor = direction === 'right' || direction === 'left' ? Math.abs(dy) : Math.abs(dx);
      if (major <= 2) return;
      var s = major + minor * 4;
      if (s < score) { best = index; score = s; }
    });
    return best;
  }
  if (typeof module !== 'undefined' && module.exports && typeof window === 'undefined') {
    module.exports = { safeURL: safeURL, chooseDirection: chooseDirection, blockedHost: blockedHost };
    return;
  }
  if (location.hostname !== 'www.southpark.de' || window.__SPTV) return;
  var api = window.__SPTV = { version: '0.1.0', blocked: 0, status: 'loading' };
  var filterOn = false;
  try { filterOn = localStorage.getItem('sptv-filter') === 'on'; } catch (_) {}
  // shortcut: fetch/XHR only, not a browser-wide ad blocker; TV playback must be tested.
  if (filterOn && window.fetch) {
    var originalFetch = window.fetch;
    window.fetch = function (input) {
      if (blockedHost(typeof input === 'string' ? input : input && input.url)) {
        api.blocked++;
        return Promise.reject(new TypeError('South Park TV: experimental request filter'));
      }
      return originalFetch.apply(this, arguments);
    };
  }
  if (filterOn && window.XMLHttpRequest) {
    var open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      if (blockedHost(url)) { api.blocked++; throw new Error('South Park TV: experimental request filter'); }
      return open.apply(this, arguments);
    };
  }
  function start() {
    var root = document.createElement('section');
    root.id = 'sptv'; root.setAttribute('aria-label', 'South Park TV Folgenauswahl');
    var style = document.createElement('style');
    style.textContent = '#sptv{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483000;background:#101218;color:#f8fafc;font:26px/1.4 Arial,sans-serif;padding:30px 42px;overflow:auto;box-sizing:border-box;text-align:left}'+
      '#sptv *{box-sizing:border-box}#sptv h1{font-size:38px;margin:0 0 3px;color:#fff}#sptv small{font-size:20px;color:#bac3d2}'+
      '#sptv nav{display:flex;flex-wrap:wrap;margin:20px 0 25px}#sptv button{font:inherit;background:#252b38;color:#f8fafc;border:3px solid transparent;border-radius:9px;min-height:56px;padding:10px 16px;margin:0 12px 12px 0;cursor:pointer;text-align:left}'+
      '#sptv button:focus{outline:4px solid #ffd45a;outline-offset:3px;background:#394454}#sptv-grid{display:flex;flex-wrap:wrap;margin:8px -8px}'+
      '#sptv-grid button{width:calc(33.333% - 20px);margin:10px;padding:0;overflow:hidden}#sptv-grid img{display:block;width:100%;height:145px;object-fit:cover;background:#1d2430}'+
      '#sptv-grid .sptv-label{display:block;padding:14px;min-height:85px;font-size:25px}#sptv-state{font-size:22px;color:#bac3d2;margin:10px 0}'+
      '@media(min-width:1600px){#sptv{font-size:32px;padding:45px 65px}#sptv-grid img{height:210px}#sptv-grid .sptv-label{font-size:32px}}'+
      '@media(max-width:700px){#sptv{padding:20px}#sptv-grid button{width:calc(50% - 20px)}}';
    document.head.appendChild(style); document.body.appendChild(root);
    var mode = 'episodes', signature = '', selected = 0;
    var episodePage = /\/(folgen|episodes)\//.test(location.pathname);
    root.hidden = episodePage;
    function button(text, action) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = action; return b;
    }
    function navigate(url) { var safe = safeURL(url, location.href); if (safe) location.assign(safe); }
    function visible(e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
    function originals(selector) { return Array.prototype.filter.call(document.querySelectorAll(selector), function (e) { return !root.contains(e); }); }
    function cookieButton() {
      return originals('button').filter(function (b) { return /nur essenzielle/i.test(b.textContent || b.getAttribute('aria-label') || '') && visible(b); })[0];
    }
    function records() {
      var links = originals('a[href]'), seen = Object.create(null), out = [];
      if (mode === 'seasons') out.push({url:'https://www.southpark.de/seasons/south-park', label:'Staffel 1'});
      links.forEach(function (a) {
        var url = safeURL(a.getAttribute('href'), location.href);
        var relevant = mode === 'seasons' ? /\/seasons\/south-park\/[^/]+\/staffel-\d+/.test(url || '') : /\/(folgen|episodes)\//.test(url || '');
        if (!relevant || seen[url] || (mode === 'episodes' && /concert/.test(url))) return;
        seen[url] = true;
        var title = a.querySelector('.sub-header, h3'), meta = a.querySelector('.header'), image = a.querySelector('img');
        var label = mode === 'seasons' ? a.textContent.trim() : ((meta ? meta.textContent.trim() + ' · ' : '') + (title ? title.textContent.trim() : a.textContent.trim().slice(0,100)));
        if (!label) return;
        out.push({url:url, label:label, image:image && (image.currentSrc || image.src)});
      });
      return out;
    }
    function controls() { return Array.prototype.filter.call(root.querySelectorAll('button'), visible); }
    function focusAt(i) { var list = controls(); if (!list.length) return; selected = Math.max(0,Math.min(i,list.length-1)); list[selected].focus(); try { list[selected].scrollIntoView({block:'nearest',inline:'nearest'}); } catch (_) {} }
    function show() { root.hidden=false; signature=''; render(); }
    function hide() { root.hidden=true; }
    function render() {
      var data = records(), consent = cookieButton();
      var sig = mode + ':' + data.map(function(x){return x.url;}).join('|') + ':' + !!consent;
      if (sig === signature) return;
      signature = sig;
      while (root.firstChild) root.removeChild(root.firstChild);
      var h = document.createElement('h1'); h.textContent='SOUTH PARK'; root.appendChild(h);
      var sub = document.createElement('small'); sub.textContent='TV-Prototyp · offizieller Inhalt von southpark.de'; root.appendChild(sub);
      var nav = document.createElement('nav'); nav.setAttribute('aria-label','Navigation'); root.appendChild(nav);
      nav.appendChild(button('Folgen',function(){mode='episodes';signature='';render();}));
      nav.appendChild(button('Staffeln',function(){mode='seasons';signature='';render();}));
      nav.appendChild(button('Originalseite / Player',hide));
      nav.appendChild(button('Werbefilter: '+(filterOn?'AN':'AUS'),function(){
        if (!confirm('Experimenteller Filter: blockiert nur ausgewählte Werbeanfragen und kann den Player stören. '+(filterOn?'Ausschalten?':'Einschalten?'))) return;
        try { localStorage.setItem('sptv-filter',filterOn?'off':'on'); location.reload(); } catch (_) { alert('Einstellung konnte nicht gespeichert werden.'); }
      }));
      if (consent) nav.appendChild(button('Nur essenzielle Cookies',function(){consent.click();signature='';setTimeout(render,300);}));
      var status=document.createElement('p');status.id='sptv-state';
      status.textContent=data.length ? (mode==='seasons'?'Staffel auswählen':'Folge auswählen')+' · Pfeile: Auswahl · OK: Öffnen · Zurück: Menü' : 'Folgen werden von der offiziellen Seite geladen. Bei Bedarf „Originalseite / Player“ öffnen.';
      root.appendChild(status);
      var grid=document.createElement('div');grid.id='sptv-grid';root.appendChild(grid);
      data.forEach(function(item){
        var b=button('',function(){navigate(item.url);});
        if(item.image && /^https:\/\//.test(item.image)) { var im=document.createElement('img');im.src=item.image;im.alt='';im.loading='lazy';b.appendChild(im); }
        var label=document.createElement('span');label.className='sptv-label';label.textContent=item.label;b.appendChild(label);grid.appendChild(b);
      });
      if(mode==='episodes') {
        var more=originals('button').filter(function(b){return /mehr folgen anzeigen/i.test(b.textContent);})[0];
        if(more)root.appendChild(button('Weitere Folgen laden',function(){more.click();signature='';setTimeout(render,700);}));
      }
      if(consent)consent.focus();else if(!root.hidden)focusAt(selected);
      api.status='ready';api.count=data.length;api.mode=mode;
    }
    function playPause(force) {
      var vids=originals('video').filter(function(v){return visible(v) && v.readyState>0 && !/^data:/.test(v.currentSrc||'');});
      var v=vids[0];
      if(v) {
        if(force==='pause' || (!v.paused && force!=='play'))v.pause();
        else { var p=v.play();if(p&&p.catch)p.catch(function(){api.status='play-rejected';}); }
        return;
      }
      var play=originals('[aria-label="Abspielen"], [aria-label="Play"]').filter(visible)[0];
      if(play)play.click();else api.status='no-playable-video';
    }
    document.addEventListener('keydown',function(e){
      var key=e.keyCode||e.which;
      var consent = cookieButton();
      if(consent && [13,37,38,39,40].indexOf(key)>=0) {
        var choices=originals('#ketch-banner-button-primary, #ketch-banner-button-secondary, #ketch-banner-button-tertiary').filter(visible);
        if(!choices.length)choices=[consent];
        var active=choices.indexOf(document.activeElement), first=choices.indexOf(consent);
        if(key===13) { if(active>=0)choices[active].click();else consent.focus(); }
        else { var step=key===37||key===38?-1:1;var next=active<0?first:(active+step+choices.length)%choices.length;choices[next].focus(); }
        e.preventDefault();e.stopImmediatePropagation();return;
      }
      if(!root.hidden) {
        if([37,38,39,40].indexOf(key)>=0) {
          var list=controls(),at=list.indexOf(document.activeElement);if(at<0)at=selected;
          var rects=list.map(function(b){var r=b.getBoundingClientRect();return {x:r.left,y:r.top,width:r.width,height:r.height};});
          focusAt(chooseDirection(rects,at,{37:'left',38:'up',39:'right',40:'down'}[key]));
        } else if(key===13) { if(root.contains(document.activeElement))document.activeElement.click(); }
        else if(key===10009||key===27) { if(mode==='seasons'){mode='episodes';signature='';render();}else hide(); }
        else return;
      } else {
        if(key===10009||key===27||key===403){show();}
        else if(key===13||key===10252) { if(cookieButton())return;playPause(); }
        else if(key===415)playPause('play');
        else if(key===19)playPause('pause');
        else if(key===417||key===412) {
          var v=originals('video').filter(function(x){return visible(x)&&x.readyState>0&&isFinite(x.duration);})[0];
          if(v)v.currentTime=Math.max(0,Math.min(v.duration,v.currentTime+(key===417?10:-10)));
        } else return;
      }
      e.preventDefault();e.stopImmediatePropagation();
    },true);
    render();
    var timer=null, observer=new MutationObserver(function(changes){
      if(root.hidden)return;
      var changed=changes.some(function(c){return !root.contains(c.target);});
      if(!changed||timer)return;
      timer=setTimeout(function(){timer=null;render();},300);
    });
    observer.observe(document.body,{childList:true,subtree:true});
    api.show=show;api.hide=hide;api.render=render;
    document.addEventListener('visibilitychange',function(){if(!document.hidden&&!root.hidden){signature='';render();}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
}());
