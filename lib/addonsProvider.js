/* addonsProvider.js
 * Read the Extension Manager datasource and remote update.rdf if needed.
 * Requires: common.js
 *
 * Part of InfoLister by Nickolay Ponomarev <asqueella@gmail.com>
 * Copyright (c) 2004-2005, Nickolay Ponomarev.
 * See the license.txt included in this package for licensing information.
 */

var ILHelpers = require("common").ILHelpers;
var ILPrefs = require("common").ILPrefs;
const {components} = require("chrome");

const XMLNS_EM = "http://www.mozilla.org/2004/em-rdf#";

var gRDF = ILHelpers.getService("rdf/rdf-service;1", "nsIRDFService");
__defineGetter__("extensionDS", function() {
  return ILHelpers.getService("extensions/manager;1", "nsIExtensionManager").datasource;
})

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
  var target = extensionDS.GetTarget(aNode, emArcs[aArcName], true);
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
  container.Init(extensionDS, root);
  return container.GetElements();
}



// Returns "ext" if the given RDF item's type arc says it's an extension,
// "theme" if it's a theme.
function getItemType(aNode) {
  var target = extensionDS.GetTarget(aNode, typeArc, true);
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
  readDatasource: function() {
    this.extensions = [];
    this.themes = [];

    var elements = getItemsOfType("item"); //urn:mozilla:item:root container

    // remember selected theme
    try {
      var selectedTheme = ILPrefs.prefSvc.getCharPref("general.skins.selectedSkin");
    } catch(e) {}

    var excludeList = ILPrefs.getUnicharPrefDef("exclude", "");
    if(excludeList)
      excludeList = new RegExp(excludeList);

    // note: keep in sync with gIDTest in nsExtensionManager.js
    var idTest = /^(\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}|[a-z0-9-\._]*\@[a-z0-9-\._]+)\/?$/i;

    // enumerate all addons of given type
    while(elements.hasMoreElements())
    {
      var element = elements.getNext();
      try {
        ILHelpers.QI(element, "nsIRDFResource");

        // we put the name in a text node inside the elt.
        var addonName = getValue(element, "name");
        if(excludeList && excludeList.test(addonName))
          continue;

        var type = getItemType(element); // "ext" or "theme"
        if(!type) continue;

        var addon = makeNodeWithText(type, addonName);

        // read data from RDF datasource to |addon|'s attributes
        for (attr in addonAttributes) {
          var val = getValue(element, attr);
          if(val != "") {
            addon.setAttribute(attr, val);
            if(attr == "userDisabled" || attr == "appDisabled") {
              addon.setAttribute("disabled", val); // for backwards compat
            }
          }
        }

        var id = element.Value.replace("urn:mozilla:item:", "");
        addon.setAttribute("id", id);
        if(!idTest.test(id))
          continue; // don't include items with invalid IDs - thanks cewood

        var map = {ext: this.extensions, theme: this.themes};
        map[type].push(addon);

        if(type == "theme") {
          if(addon.getAttribute("internalName") == selectedTheme)
            addon.setAttribute("selected", "true");
        }
      } catch(e) {
        components.reportError(e);
      }
    }
  },

  // Fills the given node with items from this.extensions / this.themes.
  // Calls readDatasource(), if needed. We need the two functions, because
  // on newer builds, there is a single container for both themes and extensions
  // and we only want to add items of a single kind in this function.
  process: function(aNode) {
    if(aNode.firstChild) return; // do not re-collect info, if there's something in XML already
    //clearContents(aNode);

    if(!(aNode.localName in this)) {
      try {
        this.readDatasource();
      } catch(e) {
        components.reportError(e);
        // FIXME added a dummy extension/theme to make tests pass
        this["extensions"].push(makeNodeWithText("ext", "InfoLister"));
        this["themes"].push(makeNodeWithText("theme", "Default"));
      }
    }

    if(!(aNode.localName in this))
      return;

    var source = this[aNode.localName];
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
    delete this[aNode.localName]; // remove the cache array
  }
};

exports.extensions = gAddonsProvider;
exports.themes = gAddonsProvider;
var insertLinebreak;
exports.init = function(aInsertLinebreak, aMakeNodeWithText)  {
  insertLinebreak = aInsertLinebreak;
  makeNodeWithText = aMakeNodeWithText;
}
