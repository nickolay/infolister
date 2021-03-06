/*
 * InfoLister XPCOM components: 
 *  - InfoLister service
 *  - InfoLister upload job (for use with upload.xul)
 *  - about:info provider.
 *  - InfoLister channel (which is returned by the about:info handler)
 *
 * Part of InfoLister by Nickolay Ponomarev <asqueella@gmail.com>
 * Copyright (c) 2004-2005 Nickolay Ponomarev.
 * See the license.txt included in this package for more information.
 */

var globalObject = this;

var loadedScripts = {};

/**
 * Ensures that the specified script is loaded. Loads it if necessary.
 * Used for lazy loading of the scripts we need.
 *
 * @param {string} aScript The script URI (relative to chrome://infolister/content/)
 */
function requires(aScript) {
  if(aScript in loadedScripts) return;

  loadedScripts[aScript] = true;
  CC["@mozilla.org/moz/jssubscript-loader;1"]
    .getService(CI.mozIJSSubScriptLoader)
    .loadSubScript("chrome://infolister/content/" + aScript);
}

function loadILModule(module) {
  Components.utils.import("resource://infolister/" + module + ".js", globalObject);
  return globalObject[module];
}

/**
 * Writes a JS (unicode) string to a stream, converting it to the 
 * specified charset (optional) first.
 */
function writeToStream(aOutputStream, aData, aCharset) {
  try {
    var charset = aCharset || ILPrefs.getLocalizedUnicharPref("charset");
  } catch(e) {}

  try {
    var os = CC["@mozilla.org/intl/converter-output-stream;1"]
               .createInstance(CI.nsIConverterOutputStream);
    charset = charset ? charset : "UTF-8";
    os.init(aOutputStream, charset, 0, "?".charCodeAt(0));
    os.writeString(aData);
    os.flush();
    os.close();
  } catch(e) {
    Components.reportError(e);
  }
}

/**
 * Creates an input stream containing aData converted to the specified 
 * charset.
 */
function createInputStreamFromString(aData, aCharset)
{
  var storageStream = CC["@mozilla.org/storagestream;1"].createInstance(CI.nsIStorageStream);
  storageStream.init(8192, -1, null);
  var outputStream = storageStream.getOutputStream(0);
  writeToStream(outputStream, aData, aCharset);
  outputStream.close();
  return storageStream.newInputStream(0);
}

/**
 * Hash values for collected data (serialized XML) and formatting prefs.
 * Used to make a decision - whether we should re-upload the data file on exit.
 */
var gHashValues = { data: "", format: "" };

/**
 * A cache of XPI links. This is a dictionary of id - link pairs.
 * @see content/components/xpiLinks.js
 */
var xpiLinksCache = {};

/* InfoLister service implementation
 * Implements InfoLister service that is responsible for generating the info.
 * The service lazily loads various scripts from 
 * chrome://infolister/content/components/... and calls functions defined there
 * to do the real job.
 */
function InfoListerServiceImpl() {
  try {
    this.wrappedJSObject = this;
    this.prefObserver = prefObserver; // make prefObserver available to infolister.js (lazyness)
    
    if ("@mozilla.org/login-manager;1" in Components.classes) {
      requires("loginmanager/utils.js");
      if (!ILPrefs.getBoolPrefDef("migrated_to_login_manager", false)) {
        requires("loginmanager/migrate.js");
        ILMigrateToLoginManager();
        ILPrefs.setBoolPref("migrated_to_login_manager", true);
      }
    }
  } catch (e) {
    LOG_ERROR(e);
  }
}
InfoListerServiceImpl.prototype = {
  classID: Components.ID("{55b75ad5-a4dd-445e-91a0-4ef9a6c24cfe}"),
  contractID: "@mozilla.doslash.org/infolister/service;1",
  classDescription: "InfoLister service",

  /** Returns a formatter object which is responsible for producing an output 
      text from in-memory XML tree */
  _formatter: null,
  get formatter() {
    if(!this._formatter) {
      this._formatter = loadILModule("format").gFormatter;
    }
    return this._formatter;
  },

  get infoProviders() {
    return gInfoProviders;
  },

  /** Returns the XML tree with collected information */
  getDataAsXML: function(haveXMLDataCallback) {
    requires("hash.js");
    var collect = loadILModule("collect");

    prefObserver.register();   // listen for pref changes

    var requiredElements = [];
    var xmlprefs = ILPrefs.getSubBranch("XML.");
    function appendElt(aNodeName, aPrefName) {
      if(!xmlprefs.getBoolPref(aPrefName + "bool"))
        return;
      requiredElements.push(aNodeName);
    }

    appendElt("lastupd", "lastupd");
    appendElt("useragent", "ua");
    appendElt("extensions", "extension");
    appendElt("themes", "theme");
    appendElt("plugins", "plugin");

    var self = this;
    collect.collectData(prefObserver.needRecollect, requiredElements,
      function haveData(rv) {
        [self._data, self._infoElt] = rv;
        // calculate the hash of the collected data, without "last updated" field
        var lastupdElt = self._infoElt.getElementsByTagName("lastupd");
        if(lastupdElt.length > 0) {
          lastupdElt = lastupdElt[0];
          var nextElt = lastupdElt.nextSibling;
          self._infoElt.removeChild(lastupdElt);
        } else
          lastupdElt = null;
    
        // xxx multiple <app> elts; store the hash value right in the XML?
        var data = (new InfoListerWindows.anyWindow.XMLSerializer)
          .serializeToString(self._data);
        var hash = new CryptoHash();
        hash.update2(data);
        gHashValues.data = hash.finish();
        //LOG(gHashValues.data);
    
        if(lastupdElt)
          self._infoElt.insertBefore(lastupdElt, nextElt);
    
        prefObserver.needRecollect = false;
        prefObserver.needReformat = true;
        haveXMLDataCallback();
      });
  },

  /* 
   * Here's the story: by default we don't collect the XPI links, because
   * it is a network-dependent operation that takes noticeable time.
   * If we find out (in formatData) that we actually need the links, we
   * return the temporary results (without any links) immediately and 
   * run getXPILinks(). It notifies us (via a callback) when it's done,
   * and we re-generate the output, now with links included. Then we 
   * run the callback with the final output as a parameter.
   *
   * This function provides common interface for the two cases. The 
   * callback is invoked immediately if we don't need to collect any 
   * links, or, if we do need the links, it's called when the links are 
   * collected and a final output is generated.
   *
   * Additional difficulcy is that this can be called while an asynchronous 
   * collection is in progress. To handle this case we store the number of 
   * active operations and only invoke callbacks when it goes to 0.
   */
  _callbacks: [],
  _invokationNum: 0,
  getFormattedDataWithCallback: function(aCallback) {
    var self = this; // make us available to the closure
    this.getFormattedData(
      function haveFormattedData(output, needXPILinks) {
        if(needXPILinks.value &&
          // don't run this twice per session, unless forced (by a caller in the Options dialog)
          // XXX also if last collection was cancelled
           (!("components/xpiLinks.js" in loadedScripts)))
        {
          self._invokationNum ++;
          self._callbacks.push(aCallback);
          self.getXPILinks(
            function() {
              self._invokationNum --;
              LOG("callback in getFormattedDataWithCallback: callbacks.length=" + 
                self._callbacks.length + "; aCallback=" + aCallback.toString().substring(0,30) 
                + "..." + "\r\ninvokationNum=" + self._invokationNum);
              if(self._invokationNum > 0)
                return;
              getInfoListerService().getFormattedData(
                function haveFormattedDataWithXPILinks(output) {
                  for(var i in self._callbacks) {
                    LOG("callback invoked asynchronously: " + self._callbacks[i].toString().substring(0,30) + "...");
                    self._callbacks[i](output);
                  }
                  self._callbacks.length = 0;
                });
            }
          );
        } else {
          LOG("callback invoked synchronously: " + aCallback.toString().substring(0,30) + "...");
          aCallback(output);
        }
      });
  },

  getXPILinks: function(aCallback) {
    requires("components/xpiLinks.js");

    var self = this;
    if(!this._data)
      this.getDataAsXML(haveXMLDataCallback);
    else
      haveXMLDataCallback();
    
    function haveXMLDataCallback() {
      var exts = self._infoElt.getElementsByTagName("ext");
      var themes = self._infoElt.getElementsByTagName("theme");
      var addons = [];
      for(var i=0; i<exts.length; i++) addons.push(exts.item(i));
      for(var i=0; i<themes.length; i++) addons.push(themes.item(i));
  
      try {
        // xxx anyWindow
        var progressDialog = InfoListerWindows.anyWindow.openDialog(
          "chrome://infolister/content/progress.xul", "", 
          "chrome, centerscreen", 
          function(aProgressCallback) { 
            gLinksCollector.collect(addons, aProgressCallback,
              function() {
                if(progressDialog && !progressDialog.closed)
                  progressDialog.close();
                if(aCallback instanceof Function) {
                  //require("timer").setTimeout(aCallback, 0);
                  globalObject.tmpTimer = ILHelpers.createInstance("timer;1", "nsITimer");
                  globalObject.tmpTimerCallback = {observe: function() {
                    delete globalObject.tmpTimer;
                    aCallback();
                  }};
                  globalObject.tmpTimer.init(globalObject.tmpTimerCallback, 0, CI.nsITimer.TYPE_ONE_SHOT);
                }
              }
            );
          },
          function() { gLinksCollector.cancel(); }
        );
      } catch(e) {
        ILHelpers.dumpException(e);
      }
    }
  },

  /**
   * This function formats the XML data into text. It also sets 
   * aNeedXPILinks.value to true, if the selected template needs XPI links 
   * information.
   */
  getFormattedData: function(haveFormattedDataCallback) {
    // FIXME: clean this up. This used to be non-async, and there's a ...withCallback variant of this...
    var needXPILinks = {value: false};
    var self = this;
    this.getDataAsXML(function haveXMLData() {
      var hash = new CryptoHash();
      var output = self.formatter.formatInfo(self._infoElt, xpiLinksCache, hash, needXPILinks);
      gHashValues.format = hash.finish();
      //LOG(gHashValues.format);
  
      haveFormattedDataCallback(output, needXPILinks);
    });
  },

  /**
   * @param {string} aFlag may be one of the following:
   *  "silent":        don't do anything in case of error
   *  "from options":  show an alert, in case the Upload prefs are not set
   *  anything else:   show a message with "Setup options now" type of button.
   */
  uploadInfo: function(aFlag) {
    const SILENT_FLAG = "silent";
    if(ILPrefs.getUnicharPrefDef("ftp.host", "") == "" ||
       ILPrefs.getUnicharPrefDef("ftp.path", "") == "") {

      if(aFlag == SILENT_FLAG)
        return;

      var sb = ILHelpers.stringBundle;
      var titleText = sb.GetStringFromName("infolister");
      var msgText = sb.GetStringFromName("setup_now_msg1");
      var setupNowText = sb.GetStringFromName("setup_now_btn");

      var ps = ILHelpers.getService("embedcomp/prompt-service;1", "nsIPromptService");
      var rv = 0;
      if(aFlag == "from options") {
        // xxx we should ask user if he wants to apply the changes instead
        ps.alert(null, titleText, msgText  + "\n\n" + sb.GetStringFromName("setup_now_msg3"));
      } else {
        rv = ps.confirmEx(null, titleText, msgText + "\n\n" + sb.GetStringFromName("setup_now_msg2"),
          ps.BUTTON_TITLE_IS_STRING * ps.BUTTON_POS_0 +
          ps.BUTTON_TITLE_CANCEL    * ps.BUTTON_POS_1, setupNowText, null, null,
          "", {value:false});
      }

      if(rv == 0) { // setup now
        var prefsWindow = InfoListerWindows.openPreferences("paneUpload");
        // XXX this causes wrong height to be set if "general" pane is lastsel
      }
      return;
    }

    if(ILPrefs.getCharPrefDef("last_uploaded_hash", "") == gHashValues.toSource())
    {
      // nothing has changed; no need to reupload
      if(aFlag == SILENT_FLAG)
        return;
      else
        LOG("The hash value for last-uploaded data hasn't changed; " +
            "re-uploading the same data per user request.");
    }

    function doUpload(aData) {
      try {
        UploadJob._data = aData; // save the data to upload for the UploadJob.
        InfoListerWindows.anyWindow.openDialog(
          "chrome://infolister/content/upload.xul", "", "chrome", 
          "@mozilla.doslash.org/infolister/uploadjob;1", aFlag == SILENT_FLAG);
      } catch(e) {
        ILHelpers.dumpException(e);
      }
    }
    this.getFormattedDataWithCallback(doUpload);
  },

  /**
   * Saves formatted data to a file.
   * @param {nsIFile or string} aFile The file to save to
   */
  saveToFile: function(aFile) {
    try {
      ILHelpers.QI(aFile, "nsILocalFile");
    } catch(e) {
      var file = ILHelpers.createInstance("file/local;1", "nsILocalFile");
      file.initWithPath(aFile);
      aFile = ILHelpers.QI(file, "nsILocalFile");
    }

    this.getFormattedDataWithCallback( function doSaveToFile(data)
    {
      // change '\n' line-breaks used in DOM to platform-specific line-breaks
      function fixLineBreaks(aText) {
        var platform = InfoListerWindows.anyWindow.navigator.platform.toLowerCase();
        if(platform.indexOf("win") > -1)
          return aText.replace(/\n/mg, "\r\n");
        return aText;
      }
      data = fixLineBreaks(data);
      var perm = 0666;
      try {
        aFile.create(CI.nsIFile.NORMAL_FILE_TYPE, perm); // creates all parent dirs too
      } catch(e) {
        if(e.result != CR.NS_ERROR_FILE_ALREADY_EXISTS)
          Components.reportError(e);
      }

      var stream = ILHelpers.createInstance("network/file-output-stream;1",
        "nsIFileOutputStream");
      stream.init(aFile, 0x02 | 0x20, perm, 0); // wronly + truncate

      writeToStream(stream, data);
      stream.close();
    });
  },
  
  get loginPrefObserver() {
    // register pref observer that listens to the changes in user preferences
    // (e.g. username/host) to update the login info in the login manager.
    requires("loginmanager/observer.js");

    // make the pref observer available to the world
    delete this.__proto__.loginPrefObserver;
    return this.__proto__.loginPrefObserver = loginPrefObserver;
  },

  /* @returns {nsILocalFile} a file to save info to
  makeLocalFile: function() {
    try {
      return ILPrefs.getFilePref("file");
    } catch(e) {
      // if no filename specified, generate a file in user_profile/chrome
      var file = ILHelpers.getService("file/directory_service;1", 
        "nsIProperties").get("UChrm", CI.nsILocalFile);
      file.append("infolister.txt");
      return file;
    }
  },
  */

  // nsISupports
  QueryInterface: function(aIID) {
    if(!aIID.equals(CI.nsISupports))
      throw CR.NS_ERROR_NO_INTERFACE;
    return this;
  }
};

/**
 * Listens to changes in userprefs and regenerates/reformats data as needed.
 */
var prefObserver = {
  /**
   * Whether the infolister.* prefs affecting data collection have changed 
   * since last update, more precisely, since the last time the update timer
   * was scheduled.
   */
  needRecollect: false,

  /**
   * Similar to needRecollect, only for prefs that affect formatting.
   */
  needReformat: false,

  _registered: false,

  register: function() {
    if(this._registered) return;
    ILPrefs.addObserver("", this, false);
    this._registered = true;
  },

  unregister: function() {
    if(!this._registered) return;
    ILPrefs.removeObserver("", this);
    this._registered = false;
  },

  observe: function(aSubject, aTopic, aData)
  {
    if(aTopic == "nsPref:changed") {
      // aSubject is the nsIPrefBranch we're observing
      // aData is the modified pref's name

      // extract the string up until the first '.'
      var delimIdx = aData.indexOf(".");
      delimIdx = delimIdx == -1 ? aData.length : delimIdx;
      var branch = aData.substring(0, delimIdx);

      this.needRecollect |= branch == "XML" || aData == "sort";
      this.needReformat |= this.needRecollect || (aData == "template.uri") ||
        (aData == "template.custom" && ILPrefs.getCharPref("template.uri") == "custom") ||
        (branch == "XSLT" && ILPrefs.getCharPref("template.uri") == "xml-xslt") ||
        aData == "charset" || aData == "sort";

      if(this.needReformat) {
        this.needReformat = false;
        // create or restart a timer. This also helps us when OK button in
        // Options is pressed with Instant apply off -- we don't regenerate
        // data for each pref that has been changed.
        if("_timer" in this)
          this._timer.cancel();
        else
          this._timer = ILHelpers.createInstance("timer;1", "nsITimer");
        this._timer.init(this, 400, CI.nsITimer.TYPE_ONE_SHOT);
      }
      
      
      if(branch == "logging") {
        var f;
        if(aData == "logging.enabled")
          f = LOG;
        else if(aData == "logging.xpi_links" && "LOG_xpiLinks" in globalObject)
          f = LOG_xpiLinks;
        if(f)
          f.enabled = ILPrefs.getBoolPref(aData);
      }
    } else if(aTopic == "timer-callback") {
        delete this._timer;
        var os = ILHelpers.getService("observer-service;1", "nsIObserverService");
        os.notifyObservers(null, "infolister-prefchanged", branch);
    }
  }
};

/*
 * Provides data and target URI to upload to.
 */
function UploadJob() {
  this.wrappedJSObject = this;
}
UploadJob.prototype = {
  classID: Components.ID("{55b75ad5-a6dd-445e-91a0-4ef9a6c24cfe}"),
  contractID: "@mozilla.doslash.org/infolister/uploadjob;1",
  classDescription: "InfoLister upload job",

  /** @returns {nsIURI} the URI to upload to */
  get targetURI() {
    var prefs = ILPrefs.getSubBranch("ftp.");
    var URI = ILHelpers.createInstance("network/standard-url;1", "nsIURI");

    var host = prefs.getUnicharPref("host");
    var path = prefs.getUnicharPref("path");
    var username = prefs.getUnicharPref("username");
    var protocol = prefs.getUnicharPref("protocol");//xxx ascii
    var password = "";

    if(!host || !path) return null; //xxx

    if(path[0] != "/") // xxx?
      path = "/" + path;

    try {
      var out_host = { value : "" };
      var out_username = { value : "" };
      var out_password = { value : "" };
      if (lmUtils.useLoginManager) {
        // Fx3+
        var login = lmUtils.getLogin();
        if (login) {
          username = login.username;
          password = login.password;
          host = login.hostname;
        }
      } else {
        // Fx2
        var pm = ILHelpers.getService("passwordmanager;1", "nsIPasswordManagerInternal");
        pm.findPasswordEntry(host, username, "", out_host, out_username, out_password);
        username = out_username.value;
        password = out_password.value;
        host = out_host.value;
      }
    } catch(e) {
      //xxx ask for password now
    }

    URI.spec = protocol + "://" + username + ":" + password + "@" + host + path;
    //LOG("job.targetURI=" + URI.spec);
    return URI;
  },

  /**
   * @returns {nsIInputStream} the stream to upload
   * @note this method can only return immediately because it uses the data
   *       collected in InfoListerService.uploadInfo. It must be only called
   *       a single time from chrome://infolister/content/upload.js, which
   *       must only be called from InfoListerService.uploadInfo.
   */
  get streamToUpload() {
    if (!UploadJob._data) throw "Internal error: No data to upload.";
    var stream = createInputStreamFromString(UploadJob._data);
    delete UploadJob._data;
    return stream;
  },

  get contentType() {
    return "text/xml"; //?
  },

  onUploaded: function() {
    ILPrefs.setCharPref("last_uploaded_hash", gHashValues.toSource());
  },

  // nsISupports
  QueryInterface: function(aIID) {
    if(!aIID.equals(CI.nsISupports))
      throw CR.NS_ERROR_NO_INTERFACE;
    return this;
  }
};

/**
 * Implements the "about:info" hook
 *
 * (Thanks to momokatte for his FireSomething extension, where I learned this from.)
 */
// xxx moz bug: returning null from newChannel crashes
function AboutInfo() {
}
AboutInfo.prototype = {
  classID: Components.ID("{2ee2ad53-be3a-2b41-7a75-12533ba32165}"),
  contractID: "@mozilla.org/network/protocol/about;1?what=info",
  classDescription: "InfoLister about:info implementation component",

  // nsIAboutModule
  newChannel: function(aURI) {
    return new InfoListerChannel(aURI);
  },

  getURIFlags: function() {
    // don't need scripts and can't be linked to from the web
    return 0;
  },

  // nsISupports
  QueryInterface: function(aIID) {
    if(!aIID.equals(CI.nsISupports) && !aIID.equals(CI.nsIAboutModule))
      throw CR.NS_ERROR_NO_INTERFACE;
    return this;
  }
};

/**
 * Implements access to InfoLister data through nsIChannel interface.
 *
 * @note We're not implementing nsIChannel absolutely correctly, but it seems to work.
 */
function InfoListerChannel(aURI)
{
  this.URI = aURI;
  this.originalURI = aURI;
}

InfoListerChannel.prototype = {
  // nsIChannel
  get name() {
    return "about:info";
  },
  loadAttributes:         null,
  contentType:            "text/plain",
  contentCharset:         "UTF-8",
  contentLength:          -1,
  owner:                  null,
  loadGroup:              null,
  notificationCallbacks:  null,
  securityInfo:           null,
  
  open: function ()
  {
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
  },

  asyncOpen2: function (aObserver) {
    this.asyncOpen(aObserver, null);
  },
  
  asyncOpen: function (aObserver, aContext)
  {
    try {
      var channel = this;
      var ILService = getInfoListerService();
      //LOG("channel - asyncOpen");
      ILService.getFormattedDataWithCallback(
        function onDataAvailable(aData) {
          try {
            channel.contentType = ILService.formatter.contentType;
            aObserver.onStartRequest(channel, aContext);
            //LOG("on data available callback: data length=" + aData.length + "; content type=" + channel.contentType);
            var inputStream = createInputStreamFromString(aData, channel.contentCharset);
            //LOG(inputStream.available());
            aObserver.onDataAvailable(channel, aContext, inputStream, 0, inputStream.available());
            aObserver.onStopRequest(channel, aContext, this.status);
            //LOG("done");
          } catch(e) {
            LOG_ERROR(e);
          }
        }
      );
    } catch(e) {
      LOG_ERROR(e);
    }
  },

  // nsIRequest
  isPending: function () 
  {
    return true;
  },
  
  get status() {
    return this._status;
  },

  _status: Components.results.NS_OK,
  cancel: function (aStatus) { 
    this._status = aStatus; 
  },

  suspend: function() {
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
  },
  
  resume: function() {
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
  },

  // nsISupports
  QueryInterface: function (aIID) {
    if (!aIID.equals(CI.nsIChannel) && !aIID.equals(CI.nsIRequest) && 
        !aIID.equals(CI.nsISupports))
      throw CR.NS_ERROR_NO_INTERFACE;
    return this;
  }
};


function LOG(aMsg) {
  var self = arguments.callee;
  if(!("enabled" in self))
    self.enabled = ILPrefs.getBoolPref("logging.enabled");
  if(self.enabled) {
    dump("InfoLister: " + aMsg + "\n");
    ILHelpers.dump(aMsg);
  }
}

function LOG_ERROR(e) {
  dump("InfoLister error: " + e + "\n");
  Components.utils.reportError(e);
}

// constructors for objects we want to XPCOMify
var objects = [InfoListerServiceImpl, UploadJob, AboutInfo];


/*
 * Common registration code.
 */

const CI = Components.interfaces, CC = Components.classes, CR = Components.results;
var NSGetFactory;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
if ("generateNSGetFactory" in XPCOMUtils) { // Gecko 2
  NSGetFactory = XPCOMUtils.generateNSGetFactory(objects);
}

function NSGetModule(compMgr, fileSpec) { // Gecko 1.9.2
  return XPCOMUtils.generateModule(objects);
}

XPCOMUtils.defineLazyGetter(this, "commonModule", function() {
  // replace the globalObject.commonModule with the object
  // containing EXPORTED_SYMBOLS from common.js
  let commonModule = {};
  Components.utils.import("resource://infolister/common.js", commonModule);
  return globalObject.commonModule = commonModule;
});
XPCOMUtils.defineLazyGetter(this, "InfoListerWindows", () => commonModule.InfoListerWindows);
XPCOMUtils.defineLazyGetter(this, "ILHelpers", () => commonModule.ILHelpers);
XPCOMUtils.defineLazyGetter(this, "ILPrefs", () => commonModule.ILPrefs);
function getInfoListerService() {
  return Components.classes["@mozilla.doslash.org/infolister/service;1"].
    getService(Components.interfaces.nsISupports).wrappedJSObject;
}
