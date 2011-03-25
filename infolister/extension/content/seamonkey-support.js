InfoListerOverlay.initSuite = function () {
  InfoListerWindows.urls[InfoListerWindows.Browser] = getBrowserURL();

  if ("openUILink" in window && "function" == typeof openUILink)
    return;

  openUILink = function openUILink( url, e, ignoreButton, ignoreAlt, allowKeywordFixup, postData ) {
    var where = whereToOpenLink(e, ignoreButton, ignoreAlt);
    openUILinkIn(url, where, allowKeywordFixup, postData);
  };

  whereToOpenLink = function whereToOpenLink( e, ignoreButton, ignoreAlt ) {
    if (!e)
      e = { shiftKey:false, ctrlKey:false, metaKey:false, altKey:false, button:0 };

    var shift = e.shiftKey;
    var ctrl =  e.ctrlKey;
    var meta =  e.metaKey;
    var alt  =  e.altKey && !ignoreAlt;

    // ignoreButton allows "middle-click paste" to use function without always opening in a new window.
    var middle = !ignoreButton && e.button == 1;
    var middleUsesTabs = ILPrefs.prefSvc.getBoolPref("browser.tabs.opentabfor.middleclick", true);

    // Don't do anything special with right-mouse clicks.  They're probably clicks on context menu items.

    if (ctrl || (middle && middleUsesTabs)) {
      if (shift)
        return "tabshifted";
      else
        return "tab";
    }
    else if (alt) {
      return "save";
    }
    else if (shift || (middle && !middleUsesTabs)) {
      return "window";
    }
    else {
      return "window";
    }
  };

  openUILinkIn = function openUILinkIn( url, where, allowThirdPartyFixup, postData ) {
    if (!where || !url)
      return;

    if (where == "save") {
      saveURL(url, null, null, true);
      return;
    }

    var w = getTopWin();

    if (!w || where == "window") {
      openDialog(getBrowserURL(), "_blank", "chrome,all,dialog=no", url,
         null, null, postData, allowThirdPartyFixup);
      return;
    }
    var browser = w.document.getElementById("content");
    var loadInBackground = ILPrefs.prefSvc.getBoolPref("browser.tabs.loadInBackground", "false");

    switch (where) {
    case "current":
      browser.loadURI(url);
      w.content.focus();
      break;
    case "tabshifted":
      loadInBackground = !loadInBackground;
      // fall through
    case "tab":
//      browser.loadOneTab(url, null, null, null, loadInBackground,
//             allowThirdPartyFixup || false);
      browser.addTab(url, null, null, !loadInBackground);
      break;
    }
  };
}
