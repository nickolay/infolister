// This is a server script for httpd.js.
// Used as a target for InfoLister's HTTP (DAV) upload function in test-upload.js.
const CC = Components.Constructor;
const BinaryInputStream = CC("@mozilla.org/binaryinputstream;1",
                             "nsIBinaryInputStream",
                             "setInputStream");

function handleRequest(request, response)
{
  var body = "";
  var bodyStream = new BinaryInputStream(request.bodyInputStream);
  var bytes = [], avail = 0;
  while ((avail = bodyStream.available()) > 0)
   body += String.fromCharCode.apply(String, bodyStream.readByteArray(avail));

  setSharedState("test-upload: PUT data", body); // store the file PUT for test-upload-check-results.sjs
  response.write("");
}
