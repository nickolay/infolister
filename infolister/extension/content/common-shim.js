// XXX temporary replacement for common.js, which was moved to a module
(function() {
  // We're also being loaded from the service implementation module -- in the
  // service's factory -- so we have to do this in order to avoid instantiating
  // two services.
  var loadJetpackModule;
  this.getInfoListerService = function() {
    return Components.classes["@mozilla.doslash.org/infolister/service;1"].
      getService(Components.interfaces.nsISupports).wrappedJSObject;
  }
  if(!("InfoListerServiceImpl" in this)) {
    this.InfoListerService = getInfoListerService();
    loadJetpackModule = this.InfoListerService.loadJetpackModule;
  } else {
    loadJetpackModule = this.loadJetpackModule;
  }

  var mod = loadJetpackModule("common");
  this.InfoListerWindows = mod.InfoListerWindows;
  this.ILHelpers = mod.ILHelpers;
  this.ILPrefs = mod.ILPrefs;
})();