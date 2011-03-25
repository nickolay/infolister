
function loadTemplatesList() {
  try {
    var req = new XMLHttpRequest();
    req.open("GET", "chrome://infolister/locale/templates/list", false); 
    req.overrideMimeType("text/plain");
    req.send(null);
    return req.responseText.split("\n");
  } catch(e) {
    Components.reportError(e);
  }
  return [];
}

function onPatternPaneLoad() {
  setTimeout(onPatternPaneLoadDelayed, 0);
}

function onPatternPaneLoadDelayed() {
  function LOG(aMsg) {
    //ILHelpers.dump(aMsg);
  }

  var XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  try {
    // initialize the templates drop-down
    var templates = loadTemplatesList();
    var templatesContainer = el("templatesContainer");

    for(var i in templates) {
      var uri = templates[i];
      var t = InfoListerService.formatter.loadTemplate(uri);

      var item = document.createElementNS(XUL_NS, "menuitem");
      templatesContainer.appendChild(item);
      item.value = uri;
      item.label = t.name;
      LOG(uri + "|" + t.name);
    }

    item = document.createElementNS(XUL_NS, "menuitem");
    templatesContainer.appendChild(item);
    item.label = getStr("xml");
    item.value = "xml";

    item = document.createElementNS(XUL_NS, "menuitem");
    templatesContainer.appendChild(item);
    item.label = getStr("xmlxslt");
    item.value = "xml-xslt";

    item = document.createElementNS(XUL_NS, "menuseparator");
    templatesContainer.appendChild(item);

    item = document.createElementNS(XUL_NS, "menuitem");
    templatesContainer.appendChild(item);
    item.label = getStr("custom_template");
    item.value = "custom";

    // hack#15: since we populate the menulist onload, its initial height
    // is smaller than it will be when onload event handler finishes.
    // Now the problem is, the stupid prefwindow animation code assumes
    // this can't happen and gets totally messed up. So we need a 
    // temporary item in the menulist so that it is sized "correctly"
    // before the animation starts. See bug 303947.
    templatesContainer.removeChild(el("hack15"));

    // Update the selection in templates dropdown, based on the value read from prefs
    var p = el("pref_template.uri");
    p.updateElements();
    el("template").value = el("template").value;

    onTemplateSelected();
  } catch(e) {
    Components.reportError(e); // workaround for prefs bug that swallows all exceptions we throw
    ILHelpers.dump(e);
  }
}

// Show/hide the custom template selection box, as needed
function onTemplateSelected()
{
  var template = el("template").value;
  switch(template) {
    case "custom":
      var idx = 1;
      break;
    case "xml-xslt":
      idx = 2;
      break;
    case "chrome://infolister/locale/templates/xpilist.template":
      idx = 3;
      break;
    default:
      idx = 0;
  }
  for(var i = 0; i < 3; i++)
    el("contextDeck" + i).selectedIndex = idx;
}

function reloadXPILinks() {
  ILPrefs.clearUserPrefSafe("xpiLinksCache");
  // XXX make this reload InfoLister info window
  InfoListerService.getXPILinks(null);
}
