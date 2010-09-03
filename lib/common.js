/* common.js
 * Defines: several utility objects:
 *  1) "windows manager" [InfoListerWindows]
 *  2) various helpers [ILHelpers]
 *
 * Part of InfoLister by Nickolay Ponomarev <asqueella@gmail.com>
 * Copyright (c) 2004-2005, Nickolay Ponomarev.
 * See the license.txt included in this package for more information.
 */
const {Cc, Ci, components} = require("chrome");
var InfoListerWindows = {
  // windows we work with
  Info: 0, Prefs: 1, Browser: 2, Mail: 3, Calendar: 4, Any: 5,

  urls: ["chrome://infolister/content/infolister.xul",
         "chrome://infolister/content/prefs/prefs.xul",
         "chrome://browser/content/browser.xul",
         "chrome://messenger/content/messenger.xul",
         "chrome://calendar/content/calendar.xul",
         "chrome://infolister/content/infolister.xul" // this qualifies as "any", right?
         ],
  winTypeStrings: ["infolister:infowindow", "infolister:prefwindow",
  "navigator:browser", "" /* mail */ , "calendarMainWindow" /*calendar*/, "" /* any */],

  get windowMediator() {
    return ILHelpers.getService("appshell/window-mediator;1", "nsIWindowMediator");
  },

  get windowWatcher() {
    return ILHelpers.getService("embedcomp/window-watcher;1", "nsIWindowWatcher");
  },

  open: function(aWindowType) {
    var win = this.get(aWindowType);
    if(win)
      win.focus();
    else
      win = this.windowWatcher.openWindow(null, this.urls[aWindowType], 
        "", "chrome,resizable", null);

    return win;
  },

  // return nsIDOMWindow if a window of given type exists, null otherwise
  get: function(aWindowType) {
    var win;
    if(aWindowType == this.Mail) { // damn Mail window doesn't have a windowtype
      var enumerator = this.windowMediator.getEnumerator("");
      while(enumerator.hasMoreElements())
      {
        win = enumerator.getNext();
        if(win.InfoLister) return win;
      }
    } else
      win = this.windowMediator.getMostRecentWindow(this.winTypeStrings[aWindowType]);
    return win ? win : null;
  },

  openPreferences: function(aPaneID)
  {
    var win = this.get(this.Prefs);
    if(win) {
      win.focus();
      if (aPaneID) {
        var pane = win.document.getElementById(aPaneID);
        win.document.documentElement.showPane(pane);
      }
    }
    else
      this.anyWindow.openDialog(this.urls[this.Prefs], "", 
        "chrome,titlebar,toolbar,centerscreen,dialog=no", aPaneID);
  },

  // This is required for the code in component (where "document"/"window" 
  // are not defined) to work.
  get anyWindow() {
    try {
      return window;
    } catch(e) {}
    return InfoListerWindows.get(InfoListerWindows.Any);
  }
};

/******************************************************************************/
var ILHelpers = {
  // xpcom helpers
  createInstance: function(aCID, aIID) {
    try {
      return Cc["@mozilla.org/"+aCID]
            .createInstance(Ci[aIID]);
    } catch(e) {
      components.reportError("aCID=" + aCID + ", aIID=" + aIID);
      throw e;
    }
  },

  getService: function(aCID, aIID) {
    try {
      return Cc["@mozilla.org/"+aCID]
            .getService(Ci[aIID]);
    } catch(e) {
      components.reportError("aCID=" + aCID + ", aIID=" + aIID);
      throw e;
    }
  },
  
  QI: function(aObj, aIID) {
    return aObj.QueryInterface(Ci[aIID]);
  },

  // debug
  _console: null,
  dumpException: function(e) {
    var msg = "unexpected exception. dev info follows:\n";
    for (var i in e)
      msg += (i + "=" + e[i] + "; ");
    this.dump(msg);
  },

  log: function(msg) {
    var self = arguments.callee;
    if(!("enabled" in self))
      self.enabled = ILPrefs.getBoolPref("logging.enabled");
    if(self.enabled)
      ILHelpers.dump(msg);
  },

  dump: function(msg) {
    if(!this._console)
      this._console = this.getService("consoleservice;1", "nsIConsoleService");
    this._console.logStringMessage("infolister: " + msg);
  },

  // misc
  get appInfo() {
    return ILHelpers.getService("xre/app-info;1", "nsIXULAppInfo")
                     .QueryInterface(Ci.nsIXULRuntime);
  },
  AppGuids: {
    Firefox: "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}",
    Thunderbird: "{3550f703-e582-4d05-9a08-453d09bdfdc6}",
    Sunbird: "{718e30fb-e89b-41dd-9da7-e25a45638b28}",
    SeaMonkey: "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}"
  },
  get hostApp() {
    // In post 1.0 builds nsIXULAppInfo provides application info
    return this.appInfo.ID.toString();
  }, 
  get appName() { // return string
    var appName = this.hostApp;
    for(i in this.AppGuids)
      if(appName == this.AppGuids[i])
        return i;
    return "";
  },

  comparePlatformVersion: function(compareVersion) {
    return this.
      getService("xpcom/version-comparator;1", "nsIVersionComparator").
        compare(this.appInfo.platformVersion, compareVersion);
  },

  pickFile: function(aTitle, aDefaultFile, aLoad)
  { // show filepicker, return selected file name.
    var fp = ILHelpers.createInstance("filepicker;1", "nsIFilePicker");
    fp.init(window, aTitle, aLoad ? fp.modeOpen : fp.modeSave);
    
    if(aDefaultFile) {
      fp.displayDirectory = aDefaultFile.parent;
      fp.defaultString = aDefaultFile.leafName;
    }

    fp.appendFilters(fp.filterAll);
    if (fp.show() == fp.returnCancel)
      return null;

    return { file: fp.file, mode: fp.filterIndex };
  },

  /**
   * The string bundle - read from infolister.properties - that we can get 
   * localized strings from.
   */
  get stringBundle() {
    var ls = ILHelpers.getService("intl/nslocaleservice;1", "nsILocaleService");
    var s = ILHelpers.getService("intl/stringbundle;1", "nsIStringBundleService");
    var bundleURL = "chrome://infolister/locale/infolister-service.properties";
    var _stringBundle = s.createBundle(bundleURL, ls.getApplicationLocale());
    delete this.stringBundle;
    this.stringBundle = _stringBundle;
    return _stringBundle;
  }
};

var IL_Loader = ILHelpers.createInstance("moz/jssubscript-loader;1", "mozIJSSubScriptLoader");
IL_Loader.loadSubScript("chrome://infolister/content/utils/prefutils.js",
                        this); // not specifying targetObj loads the script
                               // into a BackStagePass object as of 2.0b6pre.
IL_Loader = undefined; // ?

var ILPrefs = new PrefsWrapper1("extensions.infolister.");

exports.ILHelpers = ILHelpers;
exports.ILPrefs = ILPrefs;
exports.InfoListerWindows = InfoListerWindows;
