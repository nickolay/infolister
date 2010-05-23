// thunderbird.js - Thunderbird-specific code.
// Part of InfoLister by Nickolay Ponomarev <asqueella@gmail.com>

if(ILHelpers.hostApp == ILHelpers.AppGuids.Thunderbird || ILHelpers.hostApp == ILHelpers.AppGuids.Sunbird)
  window.addEventListener("load", hideFirefoxItems, false);

function hideFirefoxItems() {
  var items = document.getElementsByAttribute("ffoxonly", "true");
  for(var i in items)
    items[i].hidden = true;
}

if(ILHelpers.hostApp == ILHelpers.AppGuids.Thunderbird)
  window.addEventListener("load", hideUploadintbItems, false);

function hideUploadintbItems() {
  var items = document.getElementsByAttribute("notintb", "true");
  for(var i in items)
    items[i].hidden = true;
}