/* collect.js
 * Collect various information about the application into in-memory XML.
 *
 * Part of InfoLister by Nickolay Ponomarev <asqueella@gmail.com>
 * Copyright (c) 2004-2005, Nickolay Ponomarev.
 * See the license.txt included in this package for licensing information.
 */

var doc;      // the XML document where we collect information
var infoElt;  // The root <info> element for current application

// The only public method: collectData()
// Collects data, return an XML document
function collectData(aRootElt, aForceRefresh) {
  infoElt = aRootElt;
  doc = infoElt.ownerDocument;

  // Process all the child nodes of infoElt by finding an appropriate
  // handler and asking it to provide the required info.
  for(var node=infoElt.firstChild; node; node=node.nextSibling)
  {
    if(!(node.localName in gInfoProviders)) continue;

    try {
      gInfoProviders[node.localName].process(node);
      // xxx make the collection process interruptible -- if a pref is changed,
      // stop generating data and just return -- to make instantapply more responsive.
    } catch(e) {
      Components.reportError(e);
    }
  }

  return doc;
}


/**** Info providers ********************************************************/
var pluginsProvider = {
  process: function(aRootNode) {
    if(aRootNode.firstChild) return; // do not update info, if there's something already
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
  }
};

// This is a hash of objects ("info providers") that atm all implement a single
// function |process(aNode)|, adding the information they collect as a child of aNode
var gInfoProviders = {
  lastupd: {
    process: function(aRootNode) {
      clearContents(aRootNode);
      appendTextNode(aRootNode, new Date().toGMTString());
    }
  },

  useragent: {
    process: function(aRootNode) {
      clearContents(aRootNode);
      appendTextNode(aRootNode, InfoListerWindows.anyWindow.navigator.userAgent);
    }
  },

  plugins: pluginsProvider
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
