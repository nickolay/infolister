var InfoListerWindows = require("common").InfoListerWindows;
var ILPrefs = require("common").ILPrefs;

exports.testAboutInfo = function(test) {
  //test.pass();
  //return;

  var wm = Cc['@mozilla.org/appshell/window-mediator;1']
           .getService(Ci.nsIWindowMediator);
  var browserWindow = wm.getMostRecentWindow("navigator:browser");
  if (!browserWindow) {
    test.pass("Note: no browser window found, may be normal if not running in a browser app");
    return;
  }

  test.waitUntilDone();
  ILPrefs.clearUserPrefSafe("xpiLinksCache");

  // common boilerplate for loading about:info in the browser and waiting for it to load.
  function runTest(template, checkDocumentCallback, doneCallback) {
    require("common").ILPrefs.setCharPref("template.uri",
      (template == "xml") ?
        "xml" :
        "chrome://infolister/locale/templates/" + template);

    var tabBrowser = browserWindow.gBrowser;
    var newTab = tabBrowser.addTab("about:info");
    tabBrowser.selectedTab = newTab;
    var b = tabBrowser.getBrowserForTab(newTab);

    if (checkDocumentCallback(b.contentDocument)) {
      test.assert(true, "Loaded non-empty about:info (without load callback; template=" +
                  template + ")");
      tabBrowser.removeTab(newTab);
      doneCallback();
    } else {
      function onPageLoad() {
        b.removeEventListener("load", onPageLoad, true);

        test.assert(checkDocumentCallback(b.contentDocument),
                    "Loaded non-empty about:info (in load callback; template=" + template + ")");
        tabBrowser.removeTab(newTab);
        test.pass("");
        doneCallback();
      }
      b.addEventListener("load", onPageLoad, true);
      if (template == "xpilist.template") {
        // XXX "load" event doesn't fire for the xpi template in Firefox 3.6...
        (function repeatTesting() {
          require("timer").setTimeout(function() {
            if (checkDocumentCallback(b.contentDocument)) {
              test.assert(true, "Loaded non-empty about:info (without load callback; template=" +
                          template + ")");
              tabBrowser.removeTab(newTab);
              doneCallback();
            } else {
              repeatTesting();
            }
          }, 100)
        })();
      }
    }
  }


  var tests = [
    { template: "html.template",
      checkDocumentCallback: function(contentDocument) {
        if (contentDocument.documentElement.innerHTML.indexOf("InfoLister") > 0) {
          return true;
        }
        return false;
      }
    },
    { template: "text.template",
      checkDocumentCallback: function(contentDocument) {
        if (contentDocument.documentElement.innerHTML.indexOf("InfoLister") > 0) {
          test.assertEqual(contentDocument.body.children.length, 1);
          test.assertEqual(contentDocument.body.children[0].tagName.toUpperCase(), "PRE");
          return true;
        }
        return false;
      }
    },
    { template: "bbcode.template",
      checkDocumentCallback: function(contentDocument) {
        if (contentDocument.documentElement.innerHTML.indexOf("InfoLister") > 0) {
          test.assertEqual(contentDocument.body.children.length, 1);
          test.assertEqual(contentDocument.body.children[0].tagName.toUpperCase(), "PRE");
          return true;
        }
        return false;
      }
    },
    { template: "xml",
      checkDocumentCallback: function(contentDocument) {
        if (contentDocument.documentElement.tagName == "infolister") {
          test.assert(contentDocument.documentElement.firstElementChild.children.length > 1);
          return true;
        }
        return false;
      }
    },
    { template: "xpilist.template",
      checkDocumentCallback: function(contentDocument) {
        if (contentDocument.documentElement.innerHTML.indexOf("InfoLister") > 0) {
          test.assertEqual(contentDocument.body.children.length, 1);
          test.assertEqual(contentDocument.body.children[0].tagName.toUpperCase(), "PRE");
          //XXX test for existence of an XPI link: contentDocument.documentElement.innerHTML.indexOf("")
          return true;
        }
        return false;
      }
    }
    // XXX custom
    // XXX xml+xslt
  ];

  (function runNextTest() {
    runTest(tests[0].template, tests[0].checkDocumentCallback,
            function() {
              tests.shift();
              if (tests.length == 0) {
                ILPrefs.clearUserPrefSafe("template.uri");
                test.done();
              } else {
                runNextTest();
              }
            });
  })();

};

exports.testInfoListerWindow = function(test) {
  test.waitUntilDone();
  var win = require("common").InfoListerWindows.open(InfoListerWindows.Info);
  win.addEventListener("load", function() {
    var infoFrame = win.document.getElementById("infoFrame");
    
    (function poll() {
      if (infoFrame.contentDocument.documentElement.innerHTML.indexOf("InfoLister")>0) {
        test.pass("Non-empty content in InfoLister window");
        test.done();
      } else {
        require("timer").setTimeout(poll, 300);
      }
    })();
  }, false);
}