var {Cc, Ci} = require("chrome");

exports.testSave = function(test) {
  test.waitUntilDone();
  var InfoListerService = Cc["@mozilla.doslash.org/infolister/service;1"].
                          getService().wrappedJSObject;

  var file = Cc["@mozilla.org/file/directory_service;1"].
              getService(Ci.nsIProperties).get("TmpD", Ci.nsIFile);
  file.append("infolister.tmp");
  file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);
  InfoListerService.saveToFile(file);

  (function checkIfFileReady() {
    if (file.fileSize > 0) {
      file.remove(false);
      test.pass();
      test.done();
    }
    else {
      require("timer").setTimeout(checkIfFileReady, 50)
    }
  })();
}