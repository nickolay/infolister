/* collect.js
 * Collect various information about the application into in-memory XML.
 *
 * Part of InfoLister by Nickolay Ponomarev <asqueella@gmail.com>
 * Copyright (c) 2004-2005, Nickolay Ponomarev.
 * See the license.txt included in this package for licensing information.
 */

var EXPORTED_SYMBOLS = ["collect"];
var collect = {};
var exports = collect;

Components.utils.import("resource://infolister/common.js", this); /* InfoListerWindows, ILHelpers, ILPrefs */
Components.utils.import("resource://infolister/addonsProvider.js", this); /* addonsProvider */
const Cc = Components.classes, Ci = Components.interfaces, components = Components;

var doc;      // the XML document where we collect information
var infoElt;  // The root <info> element for current application


// The only public method: collectData()
// Collects data, return an XML document
exports.collectData = function collectData(needRecollect, requiredElements, haveDataCallback) {
  if(!doc) {
    // XXX if we need to aggregate data, load the file now
    var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]  
             .createInstance(Components.interfaces.nsIDOMParser);
    doc = parser.parseFromString("<infolister/>", "text/xml");  
    insertLinebreak(doc.documentElement);
  }

  // we store app information in <info app="Whatever"/> element, a direct
  // child of root <infolister/> element. This allows us combine info from
  // different applications in a single XML file.

  if(infoElt && needRecollect) {
    doc.documentElement.removeChild(infoElt.nextSibling); // remove the linebreak
    doc.documentElement.removeChild(infoElt);
    infoElt = null;
  }

  if(!infoElt) {
    infoElt = doc.createElement("info");
    infoElt.setAttribute("app", ILHelpers.appName);
    doc.documentElement.appendChild(infoElt);
    insertLinebreak(doc.documentElement);
    insertLinebreak(infoElt);
    
    for (var nodeName of requiredElements) {
      var elt = doc.createElement(nodeName);
      infoElt.appendChild(elt);
      insertLinebreak(infoElt);
    }
  }

  // Process all the child nodes of infoElt by finding an appropriate
  // handler and asking it to provide the required info.
  var pendingCallbacks = 1;
  for(var node=infoElt.firstChild; node; node=node.nextSibling)
  {
    if(!(node.localName in gInfoProviders)) continue;

    try {
      pendingCallbacks++;
      gInfoProviders[node.localName].process(node, finished);
      // xxx make the collection process interruptible -- if a pref is changed,
      // stop generating data and just return -- to make instantapply more responsive.
    } catch(e) {
      components.reportError(e);
    }
  }
  
  function finished() {
    pendingCallbacks--;
    if (pendingCallbacks == 0)
      haveDataCallback([doc, infoElt]);
  }
  
  finished();
}


/**** Info providers ********************************************************/
var pluginsProvider = {
  process: function(aRootNode, done) {
    if(aRootNode.firstChild) {
      done(); // do not update info, if there's something already
      return;
    }
    //clearContents(aRootNode);
    insertLinebreak(aRootNode);

    var plugins = [];
    var nav = InfoListerWindows.anyWindow.navigator;
    nav.plugins.refresh(false);
    var numPlugins = nav.plugins.length;
    for (var i=0; i<numPlugins; i++)
    {
      var plugin = nav.plugins[i];
      if (plugin)
      {
        var title = plugin.name;
        var duplicate = false;
        for(var j=0; j<plugins.length; j++) { // yes it's O(n^2). Kill me.
          if(plugins[j] == title) {
            duplicate = true;
            break;
          }
        }

        //plugin.filename;
        //plugin.description;
        if(!duplicate)
          plugins.push(title);
      }
    }

    if(ILPrefs.getBoolPref("sort")) {
      plugins.sort( function (a, b) { // XXX yes, this means multiple toUpperCase calls on every item :-/
        return a.toUpperCase() > b.toUpperCase() ? 1 : -1; 
        } );
    }

    for(i in plugins) {
      var node = makeNodeWithText("plugin", plugins[i]);
      aRootNode.appendChild(node);
      insertLinebreak(aRootNode);
    }
    done();
  }
};

// This is a hash of objects ("info providers") that atm all implement a single
// function |process(aNode)|, adding the information they collect as a child of aNode
var gInfoProviders = {
  lastupd: {
    process: function(aRootNode, done) {
      clearContents(aRootNode);
      appendTextNode(aRootNode, new Date().toGMTString());
      done();
    }
  },

  useragent: {
    process: function(aRootNode, done) {
      clearContents(aRootNode);
      appendTextNode(aRootNode, InfoListerWindows.anyWindow.navigator.userAgent);
      done();
    }
  },

  plugins: pluginsProvider,
  extensions: addonsProvider.extensions,
  themes: addonsProvider.themes
};

/**** DOM helpers ***********************************************************/
function clearContents(aNode) {
  while(aNode.firstChild)
    aNode.removeChild(aNode.firstChild);
}

// return a node of form: <aElemName>aText</aElemName>
function makeNodeWithText(aElemName, aText) {
  var dataNode = doc.createElement(aElemName);
  appendTextNode(dataNode, aText);
  return dataNode;
}

function appendTextNode(aNode, aText) {
  return aNode.appendChild(doc.createTextNode(aText));
}

// insert a line break, so that the serialized file looks nice
function insertLinebreak(aRootNode) {
  var node = doc.createTextNode("\n"); //xxx
  aRootNode.appendChild(node);
}

addonsProvider.init(insertLinebreak, makeNodeWithText);
