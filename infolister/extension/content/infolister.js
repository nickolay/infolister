/* infolister.js
 * Scripts for infolister.xul
 * Requires: common.js
 *
 * Part of InfoLister by Nickolay Ponomarev <asqueella@gmail.com>
 * Copyright (c) 2004-2005, Nickolay Ponomarev.
 * See the license.txt included in this package for licensing information.
 */

var InfoLister = {
  onLoad: function() {
    if(this.loaded) return;
    this.loaded = true;

    this._observerWrapper = new ObserverWrapper1("infolister-prefchanged", observe);
    this._observerWrapper.register();

    setTimeout(function() { InfoLister.printInfo(); }, 0);
  },

  onUnload: function() {
    this._observerWrapper.unregister();
  },

  // puts the text generated by IL service to a frame on the window
  printInfo: function(aEvent)
  {
    if("_timer" in InfoListerService.prefObserver) return; // another reload is pending

    var frame = document.getElementById("infoFrame");
    if(ILHelpers.hostApp == ILHelpers.AppGuids.Firefox ||
       ILHelpers.hostApp == ILHelpers.AppGuids.SeaMonkey)
    { // this is what I would like to use:
      frame.webNavigation.loadURI("about:info", 0, null, null, null);
    } else { //... unfortunately that doesn't work in TB :(
      function doPrint(aData) {
        var doc = frame.contentDocument;
        var body = doc.getElementsByTagName("body")[0];

        switch(InfoListerService.formatter.contentType) { // xxx bad
          case "text/xml":
            body.innerHTML = "<div style='font-family: monospace;'>" +
              aData.replace(/<([^>]*)>/g, "<span style='color: #aaa;'>&lt;$1&gt;</span>")
                   .replace(/\n/g, "<br/>\n") // XXX keep in sync with collect.js's insertLineBreak
              + "</div>";
            break;
  
          case "text/html":
            body.innerHTML = aData; // yeah, that's pretty broken, but surprisingly it works (XXX)
            break;

          case "text/plain":
          default:
            body.innerHTML = "<pre>" + aData + "</pre>";
            break;
        }
      }
      InfoListerService.getFormattedDataWithCallback(doPrint);
    }
  },

  // Selects a file, and saves the info there.
  pickAndSave: function()
  {
    var rv = ILHelpers.pickFile(window, "", null);
    if(!rv) return;

    InfoListerService.saveToFile(rv.file);
  },

  // open InfoLister Options window. Just close this window if we were opened 
  // via Tools > Extension Manager > prefs.xul > infolister.xul (because in that
  // case we cannot focus the Options window, as we're opened as a modal dialog)
  openOptions: function() {
    try {
      InfoListerWindows.openPreferences();
    } catch(e) {
      if(opener && opener.location == "chrome://infolister/content/prefs.xul")
        close();
    }
  },

  onFrameClick: function(e) {
    if(e.target.localName.toLowerCase() == "a" && 
      (e.button == 0 || e.button == 1))
    {
      e.preventDefault();
      var url = e.target.href;
      if(url)
        this.openLink(url);
    }
  },

  // open the given link in the browser
  openLink: function(aURL) {
    if(ILHelpers.hostApp == ILHelpers.AppGuids.Firefox ||
       ILHelpers.hostApp == ILHelpers.AppGuids.SeaMonkey)
    {
      var w = InfoListerWindows.open(InfoListerWindows.Browser);
      w.gBrowser.selectedTab = w.gBrowser.addTab(aURL);
      // XXX seamonkey?
    } else {
      var ioService = ILHelpers.getService("network/io-service;1", "nsIIOService");
      var uri = ioService.newURI(aURL, null, null);
      var extProtocolSvc = ILHelpers.getService(
        "uriloader/external-protocol-service;1", "nsIExternalProtocolService");
      extProtocolSvc.loadUrl(uri);
    }
  }
};

// for ObserverWrapper1 above
function observe() {
  InfoLister.printInfo();
}