/* upload.js
 *
 * (almost) Generic uploader + UI.
 *
 * Based on Torisugari's BookmarksFTP code.
 *
 */

// XXX incorrect path - (no "/")users/mozilla/testing/123.html shows no message and does not upload

const CI = Components.interfaces, CC = Components.classes, CR = Components.results;

const MAGIC_NUMBER = 0x804b0000;
const netErrorStrings = {
  "1": "unexpected",
  "2": "usercancel",
  "13": "refused",
  "14": "netTimeout",
  "16": "netOffline",
  "21": "ftplogin",
  "22": "ftpcwd",
  "23": "ftppasv",
  "24": "ftppwd",
  "25": "ftplist",
  "30": "unknown"
};

var gUploadService = {
  // process aJob - uploads contents of aJob.streamToUpload to aJob.targetURI
  sendData: function(aJob) {
    try {
      var uri = aJob.targetURI;
      var stream = aJob.streamToUpload;
      if(!stream || !uri) {
        flagedExit(-1);
        return;
      }
      LOG("uploadService.sendData: uploading " + stream + " to " + uri + ".");

      var iosvc = CC["@mozilla.org/network/io-service;1"].getService(CI.nsIIOService);
      this.channel = iosvc.newChannelFromURI(uri).QueryInterface(CI.nsIUploadChannel);

      LOG("uploadService.sendData: calling " + this.channel + ".setUploadStream()");
      this.channel.setUploadStream(stream, aJob.contentType, -1);

      LOG("calling asyncOpen()...");
      setStatusText("send", null);
      this.channel.asyncOpen(gStreamListener, window);
    } catch(e) {
      var urispec = uri ? uri.spec : null;
      var x = RegExp("^([^:]*://)([^:]*):([^@]*)@(.*)$").exec(urispec);
      if(x) { // strip name/password data
        var uristr = x[1] + ((x[2].length>0) ? "[name]" : "") + ":" +
                   ((x[3].length>0) ? "[password]" : "") + "@" + x[4];
      } else
        uristr = "{bad uri: " + urispec + "}"; // presumably no private info there
      LOG("uri=" + uristr);
      alert(e);
      flagedExit(-2);
    }
  },

  cancel: function() {
    if(this.channel)
      this.channel.cancel(MAGIC_NUMBER + 2);
  }
};

var gStreamListener = {
  // nsIStreamListener
  onDataAvailable: function(aChannel, aCtxt, aInStr, aSourceOffset, aCount) {},
  // nsIRequestObserver
  onStartRequest: function(aChannel, aCtxt) {},
  onStopRequest: function(aChannel, aCtxt, aErrCode) {
    LOG("onStopRequest(" + aErrCode + ")");
    if(aCtxt instanceof CI.nsIDOMWindowInternal)
      aCtxt.flagedExit(aErrCode);
  }
};


/*******  Dialog interface  ***************************************************/
var gLifeTime = 2;
var gStringBundle;
var gStatusBox;
var gJob;
var gSilent; // whether to close on error

function onLoad()
{
  gStringBundle = document.getElementById("strbundle");
  gStatusBox = document.getElementById("status");

  gJob = window.arguments[0];
  gSilent = (1 in window.arguments) ? window.arguments[1] : false;

  if(gJob) {
    gJob = CC[gJob].createInstance().wrappedJSObject; // xxx
    setStatusText("init", null);
    setTimeout(startUpload, 0);
    return;
  }
  setStatusText("unexpected", -3);
  window.getAttention();
}

function startUpload() {
  gUploadService.sendData(gJob);
}

// updates status text and sets close-window timeout if 
// aCode does not indicate that an error has occured
function flagedExit(aCode)
{
  setStatusText("", aCode);
  const DELAY = 2000;

  if(gSilent) {                 // silent mode
    if(aCode == 0)              // success - close immediately
      setTimeout(onSuccessfulUpload, 0);
    else                        // failure - close after delay
      setTimeout(close, DELAY);
  } else {                      // normal mode
    if(aCode == 0)              // success - close after delay
      setTimeout(onSuccessfulUpload, DELAY);
    else // xxx beep, perhaps?  // failure - don't close
      window.getAttention();
  }
}

function onSuccessfulUpload() {
  gJob.onUploaded();
  window.close();
}

function getErrorStr(aCode)
{
  if(aCode == 0) return "done";
  if(aCode < MAGIC_NUMBER) return "notneterror";
  aCode %= MAGIC_NUMBER;
  LOG(aCode);
  if(aCode in netErrorStrings)
    return netErrorStrings[aCode];
  return "unexpected";
}

function getLocalizedString(aStr)
{
  try {
    return gStringBundle.getString(aStr);
  } catch(e) {}
  return aStr;
}

// aMsg is either a blank string or one of strings from neterrors.properties,
// aErrCode is either undefined or an error code.
// At least one of params must be defined.
function setStatusText(aMsg, aErrCode)
{
  var status;
  if(aMsg)
    status = getLocalizedString(aMsg);
  else {
    aMsg = getErrorStr(aErrCode);
    status = getLocalizedString(aMsg);
  }

  if(aMsg == "notneterror" || aMsg == "unexpected")
    status += " (" + aErrCode + ")";

  gStatusBox.value = status;
}

function LOG(aStr) {
//  dump(aStr);
}
