
(function(){
  // Resolve base path of this script (i18n folder)
  var current = document.currentScript && document.currentScript.src || "";
  var base = current ? current.substring(0, current.lastIndexOf("/") + 1) : "i18n/";
  var LANGS = (window.__I18N_LANGS__ && Array.isArray(window.__I18N_LANGS__)) ? window.__I18N_LANGS__ : [
    {code: "en", label: "English"},
    {code: "hi", label: "हिन्दी"}
  ];

  function getDefaultLang(){
    var saved = localStorage.getItem("lang");
    if(saved) return saved;
    var nav = (navigator.language || navigator.userLanguage || "en").slice(0,2).toLowerCase();
    return LANGS.some(l => l.code === nav) ? nav : "en";
  }

  var currentLang = getDefaultLang();

  function fetchJSON(url){
    return fetch(url, {cache:"no-store"}).then(function(r){
      if(!r.ok) throw new Error("HTTP "+r.status);
      return r.json();
    });
  }

  function applyTranslations(dict){
    // Elements with innerText keys
    var nodes = document.querySelectorAll("[data-i18n]");
    nodes.forEach(function(el){
      var key = (el.getAttribute("data-i18n") || "").trim();
      if(!key) return;
      var val = (dict && dict[key]) || key;
      // Only replace textContent to avoid nuking child elements
      el.textContent = val;
    });
    // Attribute-based keys
    var attrs = ["placeholder","title","alt","aria-label","value"];
    attrs.forEach(function(attr){
      var nodes = document.querySelectorAll("[data-i18n-"+attr+"]");
      nodes.forEach(function(el){
        var key = (el.getAttribute("data-i18n-"+attr) || "").trim();
        if(!key) return;
        var val = (dict && dict[key]) || key;
        el.setAttribute(attr, val);
      });
    });
  }

  function loadAndApply(lang){
    currentLang = lang;
    localStorage.setItem("lang", lang);
    if(lang === "en"){
      // English is identity: we can rebuild from the data-i18n keys
      // Attempt to load en.json (optional)
      fetchJSON(base + "en.json").then(function(en){
        applyTranslations(en);
      }).catch(function(){
        applyTranslations(null);
      });
    }else{
      // Try language file, fallback to English
      fetchJSON(base + lang + ".json").then(function(dict){
        applyTranslations(dict);
      }).catch(function(){
        console.warn("Missing language file: "+lang+", falling back to English");
        loadAndApply("en");
      });
    }
  }

  function buildSwitcher(){
    var wrapper = document.createElement("div");
    wrapper.id = "langSwitcher";
    wrapper.style.position = "fixed";
    wrapper.style.right = "16px";
    wrapper.style.bottom = "16px";
    wrapper.style.background = "rgba(0,0,0,0.6)";
    wrapper.style.color = "#fff";
    wrapper.style.padding = "8px 10px";
    wrapper.style.borderRadius = "10px";
    wrapper.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
    wrapper.style.zIndex = "9999";
    wrapper.style.backdropFilter = "blur(6px)";
    wrapper.style.boxShadow = "0 4px 14px rgba(0,0,0,0.2)";

    var label = document.createElement("label");
    label.textContent = "Language: ";
    label.style.marginRight = "6px";

    var select = document.createElement("select");
    select.id = "langSelect";
    select.style.padding = "4px 6px";
    select.style.borderRadius = "8px";
    select.style.border = "1px solid rgba(255,255,255,0.3)";
    select.style.background = "rgba(255,255,255,0.1)";
    select.style.color = "#fff";

    LANGS.forEach(function(l){
      var opt = document.createElement("option");
      opt.value = l.code;
      opt.textContent = l.label;
      if(l.code === currentLang) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener("change", function(e){
      loadAndApply(e.target.value);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    document.body.appendChild(wrapper);
  }

  document.addEventListener("DOMContentLoaded", function(){
    buildSwitcher();
    loadAndApply(currentLang);
  });
})();
