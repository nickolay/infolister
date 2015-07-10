// xxx clean up this

/*
function onFilePrefWrite() {
  var filename = el("filename").value;
  if(filename == "")
    return ;
  getPref("file").path;
}

// responsible for managing the output file pref
var OutputFilePref = {
  _outputFile: null,
  valid: true,
  getOutputFile: function() {
    var path = el("filename").value;
    this.valid = true;
    if(!this._outputFile || (this._outputFile.path != path))  // xxx?
    {
      if(path != "") {
        try {
          this._outputFile = Components.classes["@mozilla.org/file/local;1"].
                             createInstance(Components.interfaces.nsILocalFile);
          this._outputFile.initWithPath(path);
        } catch(e) {
          this._outputFile = null;
          this.valid = false;
        }
      } else
        this._outputFile = null;
    }
    return this._outputFile;
  },

  checkValid: function() {
    this.getOutputFile(); // this sets |valid|
    if(!this.valid) {
      alert("invalid file name:" + el("filename").value);//xxx
      return false;
    }
    return true;
  },

  // display a filepicker to set the output file
  browseForFile: function() {
    var file = this.getOutputFile();
    var rv = ILHelpers.pickFile(window, "", file);
    if(!rv) return; // Cancel

    this._outputFile = rv.file;
    el("filename").value = rv.file.path;
  },
  
  // write info to specified file
  rewriteFile: function() {
    if(!this.checkValid()) return;
    var apply = confirm(getStr("applyprompt"));
    if(!apply) return;

//XXX    InfoListerPrefsDialog.onAccept();

    try {
      XXX var file = InfoListerService.makeLocalFile();
      InfoListerService.saveToFile(file);
    } catch(e) {
      alert("Couldn't write to the file: \n\n" + e);
    }
  },
  
  // read pref
  read: function() {
    try {
      this._outputFile = ILPrefs.getFilePref("file");
      el("filename").value = this._outputFile.path;
    } catch(e) {
    }
  },
  // write pref
  write: function() {
    var file = OutputFilePref.getOutputFile(); // also sets |valid|
    if(OutputFilePref.checkValid()) { // do not touch the file pref if new value is invalid
      if(file)
        ILPrefs.setFilePref("file", file);
      else
        ILPrefs.clearUserPrefSafe("file");
    }
  }
};
*/
