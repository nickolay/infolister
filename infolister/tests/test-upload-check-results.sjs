// This is a server script for httpd.js.
// Used to get the results PUT at "/test-upload-put-target.sjs" in test-upload.js.
function handleRequest(request, response)
{
  response.setHeader("Content-Type", "text/plain", false);
  response.write(getSharedState("test-upload: PUT data"));
}
