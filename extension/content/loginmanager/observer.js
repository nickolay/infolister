/* loginmanager/observer.js
 *
 * A pref observer that listens to the changes in user preferences
 * (e.g. username/host) to update the login info in the login manager.
 *
 * Part of InfoLister by Nickolay Ponomarev <asqueella@gmail.com>
 * Copyright (c) 2004-2008, Nickolay Ponomarev.
 * See the license.txt included in this package for more information.
 */

var loginPrefObserver = {
  _loginInfo: null,
  _registered: false,

  register: function() {
    if(this._registered) return;
    this._loginInfo = lmUtils.findLogin();
    ILPrefs.addObserver("ftp.", this, false);
    this._registered = true;
  },

  unregister: function() {
    if(!this._registered) return;
    ILPrefs.removeObserver("ftp.", this);
    this._registered = false;
  },

  observe: function(aSubject, aTopic, aData)
  {
    if(aTopic == "nsPref:changed") {
      // aSubject is the nsIPrefBranch we're observing
      // aData is the modified pref's name
      var updateInfo = {};
      // aData -> property name for updateLoginInfo mapping
      var prefs2props = {"ftp.host": "hostname",
                         "ftp.username": "username"};
      if (!(aData in prefs2props)) return;
      
      updateInfo[prefs2props[aData]] = ILPrefs.getUnicharPref(aData);
      lmUtils.updateLoginInfo(updateInfo);
    }
  }
};
