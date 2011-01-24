function el(aID) {
  return document.getElementById(aID);
}

function getPref(aName) {
  return el("pref_" + aName).value;
}
function setPref(aName, aValue) {
  return el("pref_" + aName).value = aValue;
}

function getStr(aStr) {
  return el("strbundle").getString(aStr);
}

function pickFile(pref, load) {
  var rv = ILHelpers.pickFile(window, "", getPref(pref), load);
  if(!rv) return; // cancel
  setPref(pref, rv.file);
}

function clearFile(aPref) {
  // XXX doesn't work ok when instantapply is off. Need support for 'null' file.
  var p = el("pref_" + aPref);
  if(p.hasUserValue)
    p.reset();
}


function onLoad() {
  // workaround for prefs bug
  var anim = ILPrefs.prefSvc.getBoolPref("browser.preferences.animateFadeIn");
  if(!anim) {
    var docEl = document.documentElement;
    docEl.style.height = docEl.getAttribute("fixedheight");
  }

  // hide upload pane in Thunderbird
  if(ILHelpers.hostApp == ILHelpers.AppGuids.Thunderbird) {
    var selector = document.documentElement._selector;
    var u = selector.getElementsByAttribute("pane", "paneUpload");
    selector.removeChild(u[0]);
    u = el("paneUpload");
    u.parentNode.removeChild(u);
  }
}
