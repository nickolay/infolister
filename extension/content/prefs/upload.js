var LOG = ILHelpers.log;

function getPassword() {
  if (lmUtils.useLoginManager) { // Fx3+
    var login = lmUtils.getLogin();
    return login ? login.password : "";
  }

  // fx2
  var password = { value: "" };
  var prefHost = getPref("host");
  var prefUsername = getPref("username");
  if(prefHost || prefUsername) {
    var host = { value: "" };
    var username = { value: "" };

    try {
      var pmi = ILHelpers.getService("passwordmanager;1",
                                     "nsIPasswordManagerInternal");
      pmi.findPasswordEntry(prefHost, prefUsername, "",
                            host, username, password);
    } catch(e) {}
  }
  return password.value;
}

function setPassword(value) {
  var prefHost = getPref("host");
  var prefUsername = getPref("username");
  if(prefHost || prefUsername) {
    if (lmUtils.useLoginManager) {
      try {
        lmUtils.updateLoginInfo({password: value});
      } catch(e) {
        Components.utils.reportError(e)
      }
    } else {
      var pm = ILHelpers.getService("passwordmanager;1", "nsIPasswordManager");
      try {
        pm.removeUser(prefHost, prefUsername);
      } catch(e) { /* failure is OK here. */ }
      pm.addUser(prefHost, prefUsername, value);
    }
    return value;
  }
  return "";
}

function onUploadPaneLoad()
{
  // XXX ugly workaround
  var p = el("pref_password");
  p.__defineGetter__("valueFromPreferences", getPassword);
  p.__defineSetter__("valueFromPreferences", setPassword);
  p.value = p.valueFromPreferences;
  p.updateElements();
}

function upload() {
  // XXX apply changes
  InfoListerService.uploadInfo("from options");
}
