Components.utils.import("resource://gre/modules/XPCOMUtils.jsm"); /* XPCOMUtils */
Components.utils.import("resource://infolister/common.js", this); /* InfoListerWindows, ILHelpers, ILPrefs */
XPCOMUtils.defineLazyGetter(this, "InfoListerService", function() {
    return  Components.classes["@mozilla.doslash.org/infolister/service;1"].
      getService(Components.interfaces.nsISupports).wrappedJSObject
  });
