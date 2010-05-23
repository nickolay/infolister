/* xpiLinks.js
 * Queries remote update.rdf to find the links to the XPIs installed on this system
 * Requires: common.js, addonsProvider.js, collect.js
 *
 * Part of InfoLister by Nickolay Ponomarev <asqueella@gmail.com>
 * Copyright (c) 2004-2006, Nickolay Ponomarev.
 * See the license.txt included in this package for licensing information.
 *
 * Initial version of this code has been contributed by "zeniko".
 * Improved code for parsing update manifests was contributed by "Dr. Evil".
 */

/**
 * This module 'exports' two useful functions - gLinksCollector.collect and cancel.
 * The rest  of objects are supposed to be private, although it may not be so now. 
 * The  result is 'saved' to xpiLinksCache object defined in main component file.
 *
 * The flow of control is like this (in the most interesting case):
 *
 * collect fills   ->  _processNext    ->  UpdateRDFSinkObserver    -> Necko
 * itemsToProcess      takes the top        a new instance is 
 *                     element from         created, if necessary,
 *                     itemsToProcess       _processNext returns
 *
 * Necko  ->  UpdateRDFSinkObserver.   ->  gUpdateManifestParser.  -> gXPILinksProgress.
 *                  onEndLoad                onDatasourceLoaded    ->   doneProcessing
 *        \                                                       /
 *         \_        -> UpdateRDFSinkObserver.onError ->        _/
 */

var gRDF;
/** 
 * Host application ID and version.
 */
var appID, appVersion;

var gLinksCollector = {
  /**
   * An array of |Node|s corresponding to items to find XPI links for.
   */
  itemsToProcess: [],

  /** 
   * Collect links to XPI files for each extension and theme in addons.
   * @param {Array}     addons     An array of nodes corresponding to items to check.
   * @param {Function}  onProgress A callback invoked after each addon is processed.
   *                               The function should accept a single param - 
   *                               the progress value from 0 to 100.
   * @param {Function}  onDone     Invoked after all addons are processed or if
   *                               the user cancels processing. The only argument
   *                               indicates whether operation was cancelled.
   */
  collect: function (addons, onProgress, onDone) {
    // XXX what happens if this gets called twice?
    LOG_xpiLinks("== Start collecting XPI links ==");
    gRDF = ILHelpers.getService("rdf/rdf-service;1", "nsIRDFService");

    // xpiLinksCache is defined in the main component file and will hold the 
    // id -> xpilink hash after we're finished collecting.
    try {
      xpiLinksCache = eval(ILPrefs.getUnicharPrefDef("xpiLinksCache", "({})"));
    } catch(e) {
      Components.reportError(e);
      ILPrefs.clearUserPref("xpiLinksCache");
      xpiLinksCache = {};
    }

    gUpdateManifestParser.init();

    gXPILinksProgress.init(addons.length, onProgress, onDone);
    if(addons.length == 0) {
      gXPILinksProgress.done();
      return;
    }
    this.itemsToProcess = addons;

    // process 2 items at a time
    this._processNext();
    this._processNext();
  },
  
  cancel: function() {
    gXPILinksProgress.cancel();
  },

  /**
   * Process the next pending item in this.itemsToProcess array.
   * 
   * This function returns quickly and calls itself when its async callback 
   * is finished executing.
   */
  _processNext: function() {
    if(this.itemsToProcess.length == 0)
      return false;
    var addon = this.itemsToProcess.pop();
    var itemID = addon.getAttribute("id");
    gXPILinksProgress.startProcessing(itemID);
  
    if(itemID in xpiLinksCache) { // cached?
      gXPILinksProgress.doneProcessing(itemID);
      return true;
    }
    if(addon.getAttribute("appManaged") == "true") {
      // XXX  the XPIs for app-managed items cannot be found via update mechanism
      gXPILinksProgress.doneProcessing(itemID);
      return true;
    }
    var itemType = addon.localName;
    if(itemType == "ext") itemType = "extension";
  
    try {
      // ---- cf. RDFItemUpdater.checkForUpdates() in nsExtensionManager.js ----
  
      // Look for a custom update URI: 1) supplied by a pref, 2) supplied by the
      // install manifest, 3) the default configuration
      dsURI = null;
      try {
        var dsURI = ILPrefs.prefSvc.getComplexValue(
          "extensions.%UUID%.update.url".replace(/%UUID%/, itemID), 
          CI.nsIPrefLocalizedString).data;
      } catch (e) {}
  
      if (!dsURI) {
        dsURI = addon.getAttribute("updateURL");
        LOG_xpiLinks("getting updateURL: " + dsURI, itemID)
      } if (!dsURI) {
        // Account for the change made in mozilla bug 416416 between 2.0.0.x
        // and 3.0.
        if (ILHelpers.comparePlatformVersion("1.9.0") >= 0) {
          dsURI = ILPrefs.prefSvc.getCharPref("extensions.update.url");
        } else {
          dsURI = ILPrefs.prefSvc.getComplexValue("extensions.update.url",
            CI.nsIPrefLocalizedString).data;
        }
      }
  
      var xulappInfo = ILHelpers.getService("xre/app-info;1", "nsIXULAppInfo");
      appID = xulappInfo.ID.toString();
      appVersion = xulappInfo.version;
  
      // we cheat on %ITEM_MAXAPPVERSION%, and %ITEM_VERSION%
      // the rest is as in nsRdfItemUpdater.checkForUpdates
      dsURI = dsURI.replace(/%ITEM_ID%/g, itemID);
      dsURI = dsURI.replace(/%ITEM_VERSION%/g, "0.0.0");
      dsURI = dsURI.replace(/%ITEM_MAXAPPVERSION%/g, appVersion);
      dsURI = dsURI.replace(/%APP_ID%/g, appID);
      dsURI = dsURI.replace(/%APP_VERSION%/g, appVersion);
      dsURI = dsURI.replace(/%REQ_VERSION%/g, 1);
      dsURI = dsURI.replace(/%APP_OS%/g, ILHelpers.appInfo.OS);
      try {
        dsURI = dsURI.replace(/%APP_ABI%/g, ILHelpers.appInfo.XPCOMABI);
      } catch(e) {
        // XPCOM ABI information might not be available
      }
  
      LOG_xpiLinks("reading update.rdf at " + dsURI, itemID);
      var ds = gRDF.GetDataSource(dsURI);
      ds.QueryInterface(CI.nsIRDFRemoteDataSource)
      if(ds.loaded) {
        LOG_xpiLinks("ds.loaded!", itemID)
        gUpdateManifestParser.onDatasourceLoaded(ds, itemID, itemType);
        gXPILinksProgress.doneProcessing(itemID);
      }
      else {
        var sink = ds.QueryInterface(CI.nsIRDFXMLSink);
        sink.addXMLSinkObserver(new UpdateRDFSinkObserver(itemID, itemType));
      }
    } catch(e) {
      LOG_xpiLinks("There was an error loading the update datasource at URI=" + 
        dsURI + ", \r\nerror: " +
        ("message" in e ? e.message : e), itemID);
      gXPILinksProgress.doneProcessing(itemID);
    }
    return true;
  }
};


var gUpdateManifestParser = {
  XMLNS_EM: "http://www.mozilla.org/2004/em-rdf#",

  init: function() {
    // cache resources corresponding to arcs
    if(!this.emArcs) {
      this.emArcs = {updates: null, updateLink: null, version: null, 
                     targetApplication: null, id: null};
      for(var i in this.emArcs)
        this.emArcs[i] = gRDF.GetResource(this.XMLNS_EM + i);
    }
  },

  uninit: function() {
    delete this.emArcs;
  },
  
  /**
   * Parses the RDF datasource of the update manifest for a particular addon,
   * extracting the XPI link corresponding to the latest compatible version
   * of extension.
   *
   * The results are placed into xpiLinksCache object.
   *
   * This function is called when an update manifest is finished loading, whether
   * the loading was synchronous or asynchronous.
   *
   * @param {nsIRDFDataSource} datasource The datasource object for the manifest.
   * @param {string}           itemID     The ID of the addon
   * @param {string}           itemType   The type of the addon ("theme"/"extension")
   */
  onDatasourceLoaded: function(datasource, itemID, itemType) {
    var self = this;

    function getTarget(/*nsIRDFResource*/aResource, /*string*/aArc) {
      return datasource.GetTarget(aResource, self.emArcs[aArc], true);
    }
    function valueOf(aResource) {
      try {
        return aResource.QueryInterface(CI.nsIRDFLiteral).Value;
      } catch(e) {}
      return "";
    }
  
    try {
      var extensionRes = gRDF.GetResource("urn:mozilla:" + itemType + ":" + itemID);
      var updates = getTarget(extensionRes, "updates");
    
      if (!updates)
      { // maybe we found an old update.rdf (for Firefox v0.9)
        var updateLinkResource = getTarget(extensionRes, "updateLink");
        return valueOf(updateLinkResource);
      }
    
      var updatesCont = CC["@mozilla.org/rdf/container;1"].createInstance(CI.nsIRDFContainer);
      updatesCont.Init(datasource, updates.QueryInterface(CI.nsIRDFResource));
    
      // find the highest version of this extension:
      var versionComparator = CC["@mozilla.org/xpcom/version-comparator;1"]
                              .getService(CI.nsIVersionComparator);
      var highestVersion = "0.0";
      var updateLink = "";
      var version = updatesCont.GetElements();
      while(version.hasMoreElements())
      {
        var versionInfo = version.getNext().QueryInterface(CI.nsIRDFResource);
        var currentVersion = valueOf(getTarget(versionInfo, "version"));
        LOG_xpiLinks("version " + currentVersion + "; comparing with " + highestVersion, itemID);
        if(versionComparator.compare(currentVersion, highestVersion) > 0)
        {
          // is it compatible with this app?
          var targetApps = datasource.GetTargets(versionInfo, this.emArcs.targetApplication, true);
          while (targetApps.hasMoreElements())
          {
            var targetAppInfo = targetApps.getNext().QueryInterface(CI.nsIRDFResource);
            var targetAppID = valueOf(getTarget(targetAppInfo, "id"));
            if (targetAppID != appID)
              continue;
  
            updateLink = valueOf(getTarget(targetAppInfo, "updateLink"));
            LOG_xpiLinks(updateLink, itemID);
          }
        }
      }
    } catch(e) {
      LOG_xpiLinks("Exception in onDatasourceLoaded: " + e, itemID);
    }
  
    LOG_xpiLinks("Found updateLink (" + itemType  + "): " + updateLink, itemID);
    if(updateLink)
      xpiLinksCache[itemID] = updateLink;
  }
};

/**
 * An instance of this class is created for each item which has its update 
 * manifest being loaded asynchronously.
 */
// XXX need manual timeouts that make sure that each item is processed no 
// longer than X seconds, probably (once got a window that didn't close)
function UpdateRDFSinkObserver(itemID, itemType) {
  this.itemID = itemID;
  this.itemType = itemType;
}

UpdateRDFSinkObserver.prototype = {
  _doneProcessing: function(aSink) {
    try {
      aSink.removeXMLSinkObserver(this);
    }
    catch (e) {
      LOG_xpiLinks("updateRDFSinkObserver:onError: Failure during " +
                   "removeXMLSinkObserver call\n" + e, this.itemID);
    }
    gXPILinksProgress.doneProcessing(this.itemID);
  },

  // nsIRDFXMLSinkObserver
  onBeginLoad: function(aSink) {},
  onInterrupt: function(aSink) {},
  onResume: function(aSink) {},

  onEndLoad: function(aSink) {
    try {
      gUpdateManifestParser.onDatasourceLoaded(
        aSink.QueryInterface(CI.nsIRDFDataSource), this.itemID, this.itemType);
    } catch (e) { 
      LOG_xpiLinks("updateRDFSinkObserver:onEndLoad " + e, this.itemID);
    }
    this._doneProcessing(aSink);
  },

  onError: function(aSink, aStatus, aErrorMsg) {
    LOG_xpiLinks("updateRDFSinkObserver:onError: There was an error loading \n" + 
      "the update manifest, status=" + aStatus + 
      "\nerror=" + aErrorMsg, this.itemID);
    this._doneProcessing(aSink);
  }
};

/**
 * This object is responsible for managing progress info.
 */
var gXPILinksProgress = {
  // An array of IDs of items being processed
  processing: [],
  processedAddons: 0,
  totalAddons: 0,
  cancelled: false,

  init: function(totalAddons, onProgress, onDone) {
    this.totalAddons = totalAddons;
    this.onProgress = onProgress;
    this.onDone = onDone;
    this.onProgress(0);
  },

  cancel: function() {
    this.cancelled = true;
    this.done();
  },

  startProcessing: function(itemID) {
    LOG_xpiLinks("started processing ", itemID);
    this.processing.push(itemID);
  },

  doneProcessing: function(itemID) {
    LOG_xpiLinks("doneProcessing", itemID);
    var idx = this.processing.indexOf(itemID);
    if(idx == -1) {
      LOG_xpiLinks("oops! item is not in processing="+this.processing.toSource(), itemID);
      return;
    }

    this.processing[idx] = this.processing[this.processing.length-1];
    -- this.processing.length;

    if(!this.cancelled)
      this.onProgress(100 * (++this.processedAddons) / this.totalAddons);
    if(this.processedAddons == this.totalAddons) {
      if(this.processing.length != 0)
        LOG_xpiLinks("oops! processing=" + this.processsing.toSource() + ", but processedAddons=totalAddons");
      this.done();
    } else if(!this.cancelled) {
      gLinksCollector._processNext();
    }
  },

  done: function() {
    gUpdateManifestParser.uninit();

    var cacheStr = xpiLinksCache.toSource();
    LOG_xpiLinks("== Done collecting XPI links: " + cacheStr);
    ILPrefs.setUnicharPref("xpiLinksCache", cacheStr);
    if(this.onDone)
      this.onDone(this.cancelled);
  }
};

/**
 * Helper logging function.
 */
function LOG_xpiLinks(aMsg, aItemID) {
  var self = arguments.callee;
  if(!("enabled" in self))
    self.enabled = ILPrefs.getBoolPref("logging.xpi_links"); // XXX write a pref listener
  if(self.enabled)
    LOG("xpi:" + (aItemID || "") + " " + aMsg);
}
