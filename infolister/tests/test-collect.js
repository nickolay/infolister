var collect = require("collect");

exports.testCollectDataBasic = function(test) {
  var tagNames = ["lastupd", "useragent"];
  var listTagNames = ["extensions", "themes", "plugins"];
  // append listTagNames to the tagNames array:
  Array.prototype.push.apply(tagNames, listTagNames);

  test.waitUntilDone();
  collect.collectData(true, tagNames,
    function haveData(rv) {
      var [doc, infoElt] = rv;
      test.assertEqual(infoElt.ownerDocument, doc);
      test.assertEqual(infoElt.tagName, "info", "<info> element has the right tagName");
      test.assert(infoElt.hasAttribute("app"), "<info> element has 'app' attribute");
      for each(var tagName in tagNames) {
        test.assertEqual(doc.getElementsByTagName(tagName).length, 1,
                         "exactly one <" + tagName + "> element found in the collected data.");
      }
      
      for each(var listTagName in listTagNames) {
        var containerElt = doc.getElementsByTagName(listTagName)[0];
        test.assert(containerElt.children.length > 0,
                    "have data about "+ listTagName);
        
        var expectedChildTagName;
        if (listTagName == "extensions") expectedChildTagName = "ext";
        else if (listTagName == "themes") expectedChildTagName = "theme";
        else if (listTagName == "plugins") expectedChildTagName = "plugin";
        else test.fail("Unexpected listTagName: " + listTagName);
        
        for(var i = 0; i<containerElt.children.length; i++) {
          var childElt = containerElt.children[i];
          test.assertEqual(childElt.tagName, expectedChildTagName,
                           i+"th child of <" + listTagName +
                           "> is <" + expectedChildTagName + ">");
        }
      }
      test.done();
    });
};
