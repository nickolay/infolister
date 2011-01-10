/* overlay.js
 * Script for use in main app window overlay. Writes the info file on startup.
 * Uploads info at shutdown.
 * Requires: common.js
 *
 * Part of InfoLister by Nickolay Ponomarev <asqueella@gmail.com>
 * Copyright (c) 2004-2005, Nickolay Ponomarev.
 * See the license.txt included in this package for licensing information.
 */

// XXX need about:info to listen to notifications too.
var InfoListerOverlay = {
  // "load" handler: save to the specified file on startup
  onLoad: function() {
    try {
      var filename = ILPrefs.getFilePref("file");
      if(ILPrefs.getBoolPref("autosave"))
        InfoListerService.saveToFile(filename);
    } catch(e) {} // invalid file or no file set

    this.menuitem = this.el("infolister-menuitem");
    if(this.menuitem) {
      ILPrefs.addObserver("hide_menu_item", this, false);
      this.observe(ILPrefs.branch, "nsPref:changed", "hide_menu_item");
    }

    if(ILHelpers.hostApp == ILHelpers.AppGuids.SeaMonkey) {
      Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                .getService(Components.interfaces.mozIJSSubScriptLoader)
                .loadSubScript("chrome://infolister/content/seamonkey-support.js");
      this.initSuite();
    }
  },

  // "unload" handler: upload on app exit (when last window is closed)
  onUnload: function() {
    if(!ILPrefs.getBoolPref("ftp.autoupload")) return;//xxx can the prefs be unset now?

    var type = document.documentElement.getAttribute("windowtype");
    var wm = InfoListerWindows.windowMediator;
    if(wm.getMostRecentWindow(type)) return; // this is not the last window
    InfoListerService.uploadInfo("silent");
  },

  // the handler for Firefox's toolbar button
  onToolbarButtonCommandFx: function(event) {
    var where = whereToOpenLink(event, false, true);
    switch(where) {
      case "current":
      case "window":
        InfoListerWindows.open(InfoListerWindows.Info);
        break;
      default:
        openUILinkIn("about:info", where);
    }
  },

  // the handler for our toolbar button in apps other than Firefox
  openInfoLister: function(event) {
    InfoListerWindows.open(InfoListerWindows.Info);
  },

  observe: function(aSubject, aTopic, aData) {
    if(aTopic != "nsPref:changed") return;
    // aSubject is the nsIPrefBranch we're observing
    // aData is the name of the pref that's been changed (relative to aSubject)
    if(this.menuitem && aData == "hide_menu_item")
      this.menuitem.hidden = ILPrefs.getBoolPref(aData);
  },

  el: function(aID) {
    return document.getElementById(aID);
  }
};

window.addEventListener("load", function() {InfoListerOverlay.onLoad();}, false);
window.addEventListener("unload", function() {InfoListerOverlay.onUnload();}, false);
