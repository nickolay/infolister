exports.testBasicHTTPServer = function(test) {
  const {Cc} = require("chrome");
  const port = 8080;

  var basePath = require("file").dirname( // the directory...
                   require("url").toFilename(__url__)); // ...this file is in
  var {startServerAsync} = require("httpd/httpd");

  var srv = startServerAsync(port, basePath);

  test.waitUntilDone();
  
  var pref = require("preferences-service");
  pref.set("extensions.infolister.ftp.host", "localhost:" + port);
  pref.set("extensions.infolister.ftp.path", "test-upload-put-target.sjs");
  pref.set("extensions.infolister.ftp.protocol", "http");
  pref.set("extensions.infolister.ftp.username", "test-username");
  // TODO: set password and check for it in the SJS handler
  
  var InfoListerService = Cc["@mozilla.doslash.org/infolister/service;1"].
                          getService().wrappedJSObject;
  InfoListerService.uploadInfo("");

  require("timer").setTimeout(function() {
    var Request = require('request').Request;
    Request({
      url: "http://localhost:" + port + "/test-upload-check-results.sjs",
      onComplete: function (response) {
        //console.debug("Posted data: " + response.text);
        test.assertEqual(response.text.indexOf("<!DOCTYPE HTML"), 0,
                         "PUT data starting with <!DOCTYPE HTML");
        test.assert(response.text.indexOf("</html>") > 0,
                    "PUT data is not cut off");
        test.assert(response.text.indexOf("InfoLister") > 0,
                    "PUT data mentions InfoLister");
        done();
      }
    }).get();
  }, 500);

  function done() {
    srv.stop(function() {
      test.pass();
      test.done();
    });
  }
};
