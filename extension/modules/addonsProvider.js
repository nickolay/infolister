/* addonsProvider.js
 * Read the Extension Manager datasource and remote update.rdf if needed.
 * Requires: common.js
 *
 * Part of InfoLister by Nickolay Ponomarev <asqueella@gmail.com>
 * Copyright (c) 2004-2005, Nickolay Ponomarev.
 * See the license.txt included in this package for licensing information.
 */

var addonsProvider = {};
var exports = addonsProvider;
var EXPORTED_SYMBOLS = ["addonsProvider"];

Components.utils.import("resource://infolister/common.js", this); /* ILHelpers, ILPrefs */
const components = Components;

// Gecko 1.9.2?
const oldEM = ("@mozilla.org/extensions/manager;1" in components.classes);

const XMLNS_EM = "http://www.mozilla.org/2004/em-rdf#";

var gRDF = ILHelpers.getService("rdf/rdf-service;1", "nsIRDFService");
var gDSHolder = {
  get extensionDS() {
    return ILHelpers.getService("extensions/manager;1", "nsIExtensionManager").datasource;
  }
};

// available extensions.rdf arcs
var emArcs = {name: "", version: "",
              disabled: "", appDisabled: "",  userDisabled: "", /* disabled was used in 1.5; two other arcs replaced it in 2.0 */
              internalName: "",
              homepageURL: "", description: "", creator: "", type: "",
              updateURL: "", appManaged: ""};

// attributes to set on XML node (must be subset of emArcs' keys)
var addonAttributes = {version: "", disabled: "", appDisabled: "", 
              userDisabled: "", internalName: "", homepageURL: "",
              description: "", creator: "", updateURL: "", 
              appManaged: ""};

// Get RDF arcs available for each addon
for(var attr in emArcs)
  emArcs[attr] = gRDF.GetResource(XMLNS_EM + attr);

var typeArc = gRDF.GetResource(XMLNS_EM + "type");


// read the (literal) value pointed to by |aArcName| arc from |aNode|
function getValue(aNode, aArcName) {
  var target = gDSHolder.extensionDS.GetTarget(aNode, emArcs[aArcName], true);
  try {
    return ILHelpers.QI(target, "nsIRDFLiteral").Value;
  } catch(e) {}
  return "";
}

// Get the enumerator for element in a specified container. Throws an 
// exception if no such container exists.
function getItemsOfType(aType) {
  var root = gRDF.GetResource("urn:mozilla:" + aType + ":root");
  var container = ILHelpers.createInstance("rdf/container;1", "nsIRDFContainer");
  container.Init(gDSHolder.extensionDS, root);
  return container.GetElements();
}



// Returns "ext" if the given RDF item's type arc says it's an extension,
// "theme" if it's a theme.
function getItemType(aNode) {
  var target = gDSHolder.extensionDS.GetTarget(aNode, typeArc, true);
  var type = ILHelpers.QI(target, "nsIRDFInt").Value;
  switch(type) {
    case 2: return "ext";
    case 4: return "theme";
  }
  return "";
}


// In earlier versions we used Torisugari's code here. Big thanks to him.

var gAddonsProvider = {
  // read the items list from EM datasource to two arrays of [Node]s -
  // this.extensions[] and this.themes[]

  // This function is quite slow, mainly because of the large number of calls to 
  // getValue(). We try to work around the problem by caching results, basing on 
  // the fact that the datasource isn't likely to change before app restart.
  readDatasourceCallbacks: [],
  readDatasource: function(callback) {
    var extensions = [];
    var themes = [];
    var self = this;

    self.readDatasourceCallbacks.push(callback);
    if (self.readDatasourceCallbacks > 1) {
      // another call in progress. It will take care of notifying the callback
      // we just added.
      return;
    }
    function done() {
      while (self.readDatasourceCallbacks.length > 0) {
        try {
          (self.readDatasourceCallbacks.pop())(
              {extensions: extensions, themes: themes});
        } catch(e) {
          components.utils.reportError(e);
        }
      }
    }

    var excludeList = ILPrefs.getUnicharPrefDef("exclude", "");
    if(excludeList)
      excludeList = new RegExp(excludeList);

    function getItemsFromRDF() { // Gecko 1.9.2
      // remember selected theme
      try {
        var selectedTheme = ILPrefs.prefSvc.getCharPref("general.skins.selectedSkin");
      } catch(e) {}

      var elements = getItemsOfType("item"); //urn:mozilla:item:root container
      // note: keep in sync with gIDTest in nsExtensionManager.js
      var idTest = /^(\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}|[a-z0-9-\._]*\@[a-z0-9-\._]+)\/?$/i;
      // enumerate all addons of given type
      while(elements.hasMoreElements())
      {
        var element = elements.getNext();
        try {
          ILHelpers.QI(element, "nsIRDFResource");

          var addonJSON = {
            name: getValue(element, "name"),
            type: getItemType(element), // "ext" or "theme"
            id: element.Value.replace("urn:mozilla:item:", "")
          };

          if((addonJSON.type != "ext" && addonJSON.type != "theme") ||
             !idTest.test(addonJSON.id)) { // don't include items with invalid IDs - thanks cewood
            continue; 
          }

          // read data from RDF arcs
          for (attr in addonAttributes) {
            addonJSON[attr] = getValue(element, attr);
          }

          if(addonJSON.type == "theme") {
            if(addonJSON.internalName == selectedTheme)
              addonJSON.selected = true;
          }

          yield addonJSON;
        } catch(e) {
          components.reportError(e);
        }
      }
    }
    
    function getItemsFromAddonManager(amAddons) {
      for each (addon in amAddons) {
        var addonJSON = {name: addon.name, id: addon.id};
        if (addon.type == "extension")
          addonJSON.type = "ext";
        else if (addon.type == "theme")
          addonJSON.type = "theme";
        else
          continue;

        for (attr in addonAttributes) {
          if (attr == "appManaged") {
            if (addon.scope == AddonManager.SCOPE_APPLICATION)
              addonJSON[attr] = "true";
            else
              addonJSON[attr] = "false";
          } else if (attr == "internalName") {
            // skip: not easily obtainable via the AM API, and I doubt anyone needs it.
          } else if (attr == "updateURL") {
            if ("_infoListerInternal" in addon)
              addonJSON[attr] = addon._infoListerInternal.updateURL;
          } else if (attr == "disabled") {
            // skip: calculated below
          } else
            addonJSON[attr] = addon[attr];
        }

        if(addonJSON.type == "theme") {
          if(!addonJSON.userDisabled)
            addonJSON.selected = true;
        }
        
        yield addonJSON;
      }
    }

    var map = {ext: extensions, theme: themes};
    if (!oldEM) { // Mozilla 2+
      // Have to do this to gain access to AddonInternal from XPIProvider,
      // which has the updateURL property.
      var xp;
      try {
        xp = components.utils.import("resource://gre/modules/addons/XPIProvider.jsm");
      } catch (e) {
        xp = components.utils.import("resource://gre/modules/XPIProvider.jsm");
      }
      function InfoLister_createWrapper(addonInternal) {
        var wrapper = arguments.callee.originalFn.call(xp, addonInternal);
        wrapper._infoListerInternal = addonInternal;
        return wrapper;
      }
      InfoLister_createWrapper.originalFn = xp.createWrapper;
      xp.createWrapper = InfoLister_createWrapper;

      components.utils.import("resource://gre/modules/AddonManager.jsm")
      AddonManager.getAllAddons(
        function(amAddons) {
          if ("originalFn" in xp.createWrapper) {
            xp.createWrapper = xp.createWrapper.originalFn;
          }
          haveDataFromAM(getItemsFromAddonManager(amAddons));
        });
    } else { // Mozilla 1.9.2
      haveDataFromAM(getItemsFromRDF());
    }

    function haveDataFromAM(addons) {
      for (var addonJSON in addons) {
        if(excludeList && excludeList.test(addonJSON.name))
          continue;
  
        // we put the name in a text node inside the elt.
        var addon = makeNodeWithText(addonJSON.type, addonJSON.name);
  
        // copy data from JSON to |addon|'s attributes
        for (attr in addonAttributes) {
          if(attr in addonJSON && addonJSON[attr] != "" && addonJSON[attr] != null) {
            addon.setAttribute(attr, addonJSON[attr]);
            if(attr == "userDisabled" || attr == "appDisabled") {
              addon.setAttribute("disabled", addonJSON[attr]); // for backwards compat
            }
          }
        }
  
        addon.setAttribute("id", addonJSON.id);
        if (addonJSON.selected)
          addon.setAttribute("selected", "true");
  
        map[addonJSON.type].push(addon);
      }
      done();
    }
  },

  // Fills the given node with items from the Addon Manager datasource
  // (via readDatasource()).
  process: function(aNode, done) {
    if(aNode.firstChild) {
      done(); // do not re-collect info, if there's something in XML already
      return;
    }
    //clearContents(aNode);

    if (aNode.localName != "extensions" && aNode.localName != "themes")
      throw "Unexpected node to fill: <" + aNode.localName + ">!";

    var self = this;
    this.readDatasource(function(data) {
      self.haveDSData(aNode, data[aNode.localName], done);
    });
  },

  haveDSData: function(aNode, source, done) {
    if(ILPrefs.getBoolPref("sort")) {
      source.sort(
        function (a, b) {
          return a.firstChild.nodeValue.toUpperCase() > 
                  b.firstChild.nodeValue.toUpperCase() 
                  ? 1 : -1;
        }
      );
    }
    for(var n in source) {
      aNode.appendChild(source[n]);
      insertLinebreak(aNode);
    }
    done();
  }
};

exports.extensions = gAddonsProvider;
exports.themes = gAddonsProvider;
var insertLinebreak;
exports.init = function(aInsertLinebreak, aMakeNodeWithText)  {
  insertLinebreak = aInsertLinebreak;
  makeNodeWithText = aMakeNodeWithText;
}
