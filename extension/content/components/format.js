/* format.js
 *
 *
 * Part of InfoLister by Nickolay Ponomarev <asqueella@gmail.com>
 * Copyright (c) 2004-2005, Nickolay Ponomarev.
 * See the license.txt included in this package for licensing information.
 */

var gHash;

// "template.uri" pref.  It is either a template URI, or one of the strings:
// "custom", "xml", "xml-xslt"
var templatePref;


var gFormatter = {
  // out param aHash -- hash value of format prefs and, possibly, selected template
  // out param aNeedXPILinks -- whether output template includes the XPI links
  formatInfo: function(aHash, aNeedXPILinks) {
    gHash = aHash;
    if(!infoElt) return "";

    templatePref = ILPrefs.getCharPref("template.uri");
    gHash.update(templatePref);
    if(templatePref == "xml" || templatePref == "xml-xslt") {
      this.contentType = "text/xml"
      return _formatXML();
    }

    var vars = walkTree();

    var uri = this.selectedTemplateURI;
    if(uri == "") {
      var errMsg = getStringBundle().GetStringFromName("select_template");
      var template = { contentType: "text/plain", text: errMsg };
    } else
      template = this.loadTemplate(uri);

    var templ = ("text" in template) ? template.text : "";
    this.contentType = ("contentType" in template) ? template.contentType : "text/plain";

    templ = templ.replace(/\r\n/mg, "\n");
    templ = templ.replace(/\r/mg, "\n");
    gHash.update(uri, templ);

    var needXPILinks = false;
    try {
      var result = process(templ, /\[\[((.|\n)*?)\]\]/mg, processChunk);
    } catch(e) {
      Components.reportError(e);
      return getStringBundle().GetStringFromName("internal_error");
    }

    if(needXPILinks && aNeedXPILinks)
      aNeedXPILinks.value = true;
    // end of main function. now define a few helpers:

    // goes through aStr, calling aCallback for parts of the string separated by given regexp
    function process(aStr, aRe, aCallback) {
      var result = "", lastIndex = 0, r;
      while((r = aRe.exec(aStr))) {
        result += aCallback(aStr.substring(lastIndex, r.index));
        result += aCallback(r, true);
        lastIndex = aRe.lastIndex;
      }
      result += aCallback(aStr.substring(lastIndex));
      return result;
    }

    // processes a "[[ ... ]]" chunk, or simple text when !inRegExp
    function processChunk(r, inRegExp) {
      var matched = false;
      r = inRegExp ? r[1] : r;

      function processList(r, inRegExp) {
        if(!inRegExp) { // outside of {{...}}
          return process(r, /%(.*?)%/g, 
            function processGlobalVar(r, inRegExp) {
              if(!inRegExp) return r;
              r = r[1];
              if(r in vars && !(typeof(vars[r]) == "object"))
              {
                matched = true;
                return vars[r];
              }
              return "";
            }
          );
        }

        function processAttr(r, inRegExp) { // processes %..% attribute
          if(!inRegExp) 
            return r != "" ? "s+='" + r.replace(/\\/mg, "\\\\")
                                        .replace(/'/mg, "\\'")
                                        .replace(/\n/mg,"\\n") + "';" : "";
          if(r[1] == "name")
            return "s+=node.firstChild.data;";
          if(r[1] == "xpiLink") {
            needXPILinks = true;
            return "var id=node.getAttribute('id');s+=(id in xpiLinksCache)?xpiLinksCache[id]:'';";
          }
          // XXX!: handle 'selected'
          return "p=node.getAttribute('" + r[1] + "');s+=p?p:'';";
        }

        var s = ""; // this holds the generated list
        var arrayName = r[1]+"s";
        if(arrayName in vars) {
          // processItem holds the function that generates a string for a given item
          var processItem = "var s='',p;" + process(r[3], /%(.*?)%/g, processAttr) + "return s";
          processItem = new Function("node", processItem);

          vars[arrayName].forEach(
          function(node) {       // need the extra function because processItem 
            s+=processItem(node); // isn't a closure and cannot access 's'.
          } );
          matched = true;
        }
        return s;
      } // function processList

      var result = process(r, /\{\{((.|\n)+?):((.|\n)*?)\}\}/mg, processList);

      return (matched || !inRegExp) ? result : "";
    }
    return result;
  },

  get selectedTemplateURI() {
    var uri = ILPrefs.getCharPref("template.uri");
    if(uri == "custom") {
      try {
        var file = ILPrefs.getFilePrefDef("template.custom", null);
        if(!file)
          return "";
        var ios = ILHelpers.getService("network/io-service;1", "nsIIOService");
        var fileHandler = ios.getProtocolHandler("file");
        ILHelpers.QI(fileHandler, "nsIFileProtocolHandler");
        uri = fileHandler.getURLSpecFromFile(file);
      } catch(e) {
        Components.reportError(e);
      }
    }
    return uri;
  },

  loadTemplate: function(uri) {
    try {
      var req = new InfoListerWindows.anyWindow.XMLHttpRequest();
      req.overrideMimeType("text/plain");
      req.open("GET", uri, false);
      req.send(null);

      var s = req.responseText;
      var metadata = /^(([^;\n]+);([^;\n]+);)/.exec(s);
      var text = s.substr(metadata[1].length);

      return {contentType: metadata[2],
              name: metadata[3],
              text: text
      };
    } catch(e) {
      Components.reportError(e); //xxx for some reason this doesn't work when called from prefs
      LOG(e);
      var errMsg = getStringBundle()
        .formatStringFromName("invalid_template", [uri], 1);
      return { contentType: "text/plain",  text: errMsg };
    }
    return null;
  }
};


// This function walks the DOM tree and builds easier-to-access JS object.
// Hope this won't be needed when we can use e4x.
function walkTree()
{
  var treeWalker = doc.createTreeWalker(infoElt, 1/*NodeFilter.SHOW_ELEMENT*/, null, true);
  var vars = {};
  vars.app = infoElt.getAttribute("app");
  var node = treeWalker.firstChild();
  var disabledText = getStringBundle().GetStringFromName("item_disabled");
  var selectedText = getStringBundle().GetStringFromName("item_selected");

  while(node)
  {
    switch(node.localName)
    {
      case "lastupd":
      case "useragent":
        vars[node.localName] = node.firstChild.data;
        break;
      case "extensions":
      case "themes":
      case "plugins":
        var s = node.localName;
        vars[s] = [];
        var disabled = 0;
        if(!node.firstChild) {
          vars[s + "_count"] = 0;
          node = treeWalker.nextSibling();
          continue;
        }

        node = treeWalker.firstChild();
        while(node) {
          vars[s].push(node);
          if(node.getAttribute("disabled") == "true") {
            node.setAttribute("disabled-text", disabledText);
            disabled++;
          }
          if(node.getAttribute("selected") == "true")
            node.setAttribute("selected-text", selectedText);
          node = treeWalker.nextSibling();
        }
        node = treeWalker.parentNode();

        vars[s + "_count"] = vars[s].length;
        if(s == "extensions") {
          vars["disabled_extensions_count"] = disabled;
          vars["enabled_extensions_count"] = vars[s].length - disabled;
        }
        break;
      default:
        ILHelpers.dump("Warning! Unknown element in generated XML: " + nodeName);
    }
    node = treeWalker.nextSibling();
  }
  return vars;  
}

function _formatXML() {
  var stylesheetURL = ILPrefs.getUnicharPref("XSLT.file");
  //stylesheetURL = "chrome://infolister/content/infolister.xsl";

  var xslt = templatePref == "xml-xslt";
  if(xslt)
    gHash.update(stylesheetURL);

  if(false) { // process ourselves    XXX make a bool pref for that
    try {
      var processor = new XSLTProcessor();

      var testTransform = document.implementation.createDocument("", "test", null);
      //testTransform.addEventListener("load", onload, false);
      testTransform.async = false; // xxx?
      testTransform.load(stylesheetURL);
      processor.importStylesheet(testTransform);
      var result = processor.transformToDocument(doc);
      doc = result; // xxx instead get the text from result when outputmode=text; also set our mode (for about:info f.e.)
    } catch(e) {
      Components.reportError(e);
    }
  }

  if(xslt) { // add PI
    var pi = doc.createProcessingInstruction("xml-stylesheet",
      'type="text/xsl" href="' + stylesheetURL + '"');
    doc.insertBefore(pi, doc.documentElement);
  }
  try {
    return (new InfoListerWindows.anyWindow.XMLSerializer).serializeToString(doc);
  } finally {
    if(xslt)
      doc.removeChild(pi);
  }
  return "";
}

// change '\n' line-breaks used in DOM to platform-specific line-breaks
function fixLineBreaks(aText) {
  var platform = InfoListerWindows.anyWindow.navigator.platform.toLowerCase();
  if(platform.indexOf("win") > -1)
    return aText.replace(/\n/mg, "\r\n");
  return aText;
}
