var lmUtils = {
  // true for fx3+, where we use nsILoginManager, false for fx2, where we use the
  // older API, nsIPasswordManagerInternal.
  useLoginManager: "@mozilla.org/login-manager;1" in Components.classes,

  get _loginManager() {
    return ILHelpers.getService("login-manager;1", "nsILoginManager");
  },
  
  getLogin: function() {
    var observer = getInfoListerService().loginPrefObserver;
    // initialize the loginPrefObserver, so that we can use its _loginInfo...
    //
    // XXX probably should unregister this observer, but interestingly
    //     Firefox 3 doesn't leak on shutdown even if we don't...
    observer.register();
    return observer._loginInfo;
  },
  
  /**
   * Find login by the hostname specified in preferences (for loginPrefObserver)
   */
  findLogin: function() {
    var host = ILPrefs.getUnicharPref("ftp.host");
    LOG("Getting login for " + host);
    var logins = this._loginManager.findLogins({}, host, "", "InfoLister");
    LOG(logins.length + " found");
    return logins.length > 0 ? logins[0] : null;
  },

  /**
   * Updates the InfoLister's login info (that the loginPrefObserver keeps
   * track of) with the new data.
   * @param newData is an object that may have the following properties:
   *          - username
   *          - hostname
   *          - password
   */
  updateLoginInfo: function(newData) {
    var oldLoginInfo = this.getLogin();
    var data = oldLoginInfo ? {username: oldLoginInfo.username,
                               hostname: oldLoginInfo.hostname,
                               password: oldLoginInfo.password}
                            : {username: ILPrefs.getUnicharPref("ftp.username"),
                               hostname: ILPrefs.getUnicharPref("ftp.host"),
                               password: ""};
    for (var item in data) {
      if (item in newData)
        data[item] = newData[item];
    }

    LOG("updateLoginInfo: " + data.toSource());
    var nsLoginInfo = new Components.Constructor(
      "@mozilla.org/login-manager/loginInfo;1",
      Components.interfaces.nsILoginInfo, "init");
    var loginInfo = new nsLoginInfo(data.hostname, null, "InfoLister",
                                     data.username,
                                     data.password, "", "");

    // can we store a login in the login manager?
    var deleteNewLogin = data.password == "" || 
                         data.hostname == "";

    if (!oldLoginInfo && !deleteNewLogin) {
      this._loginManager.addLogin(loginInfo);
    } else if (oldLoginInfo && deleteNewLogin) {
      this._loginManager.removeLogin(oldLoginInfo);
    } else if (oldLoginInfo && !deleteNewLogin) {
      try {
        this._loginManager.modifyLogin(oldLoginInfo, loginInfo);
      } catch(e) {
        Components.utils.reportError(e);
        this._loginManager.addLogin(loginInfo);
      }
    } else { // !oldLoginInfo && deleteNewLogin - nothing to do.
    }
    getInfoListerService().loginPrefObserver._loginInfo =
      deleteNewLogin ? null : loginInfo;
  }
}
