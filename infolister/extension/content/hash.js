/**
 * A wrapper around the security/hash component available in Gecko 1.8. Used to
 * get an MD5 hash for given data.
 *
 * Usage:
 *   var hash = new CryptoHash();
 *   hash.update("string1", "string2");
 *   hash.update2("long string data");
 *   var hashValue = hash.finish();
 */
function CryptoHash() {
  this._hash = ILHelpers.createInstance("security/hash;1", "nsICryptoHash");
  this._hash.init(CI.nsICryptoHash.MD5);
}

CryptoHash.prototype = { // xxx is there a way to just pass a string as [in octet] param?
  // for short strings
  update: function() {
    if(!this._hash) return;

    for(var i=0; i<arguments.length; i++) {
      var s = arguments[i].toString();
      for(var j=0; j<s.length; j++)
        this._hash.update([s[j]], 1);
    }
  },

  // this is faster than update() on long strings; used for calculating hash for collected data
  update2: function(aData) {
    if(!this._hash) return;

    var sis = ILHelpers.createInstance("io/string-input-stream;1", "nsIStringInputStream");
    sis.setData(aData, aData.length); // xxx this makes an extra copy of the string
    this._hash.updateFromStream(sis, -1);
  },

  finish: function() {
    return this._hash.finish(true);
  }
};
