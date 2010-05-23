/* migrate_loginmanager.js
 *
 * Migrates the passwords from fx2-style profiles to the format used by
 * newer InfoLister versions.
 *
 * Part of InfoLister by Nickolay Ponomarev <asqueella@gmail.com>
 * Copyright (c) 2004-2008, Nickolay Ponomarev.
 * See the license.txt included in this package for more information.
 */

function ILMigrateToLoginManager() {
  var LOG = ILHelpers.log;
  LOG("Migrating old-style logins to the new format.");

  var loginManager = ILHelpers.getService("login-manager;1", "nsILoginManager");

  var host = ILPrefs.getUnicharPref("ftp.host");
  var username = ILPrefs.getUnicharPref("ftp.username");

  // Find old-style logins (from fx2 signons) with the host specified in
  // preferences.
  LOG("Looking for old-style logins with host=" + host);
  var logins = loginManager.findLogins({}, host, "", null);
  LOG("Found " + logins.length + " logins");

  logins = logins.filter(function(login) {
    return login.username == username;
  });

  LOG("filtered by username=" + username + ": " + logins.length + " logins left");
  if (logins.length > 0) {
    // replace one of the found logins with a new-style login info
    var oldLoginInfo = logins[0];
    var nsLoginInfo = new Components.Constructor(
      "@mozilla.org/login-manager/loginInfo;1",
      Components.interfaces.nsILoginInfo, "init");
    var loginInfo = new nsLoginInfo(host, "", "InfoLister", username,
                                     oldLoginInfo.password, "", "");
    loginManager.modifyLogin(oldLoginInfo, loginInfo);
  }
}
