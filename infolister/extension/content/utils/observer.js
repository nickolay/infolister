/** 
 * observer.js
 *
 * @fileoverview Helper to help create and register observers with nsIObserverService.
 * @version 1.0 
 */

// This can be freely redistributed and reused, just make sure to change 
// 'ObserverWrapper1' to something else if you're changing the code.

// do not define the same version twice
if(typeof(ObserverWrapper1) != "function") {

/**
 * Creates a new wrapper.
 * @param {string} aTopic The topic the observer will listen to.
 * @param {function} aObserver The observe() function to be called by the observer service.
 *
 * @note |this| in the observer function will be set to the wrapper object.
 *
 * @constructor
 */
function ObserverWrapper1(aTopic, aObserver) {
  this._topic = aTopic;
  this.observe = aObserver;
}

ObserverWrapper1.prototype = {
  /**
   * Indicates whether the observer was registered with the observer service yet
   */
  _registered: false,

  get observerService() {
    return Components.classes["@mozilla.org/observer-service;1"]
                      .getService(Components.interfaces.nsIObserverService);
  },

  /**
   * Registers the observer with the observer service.
   */
  register: function() {
    if(!this._registered)
      this.observerService.addObserver(this, this._topic, false);//strong ref
    this._registered = true;
  },

  /**
   * Unregisters the observer with the observer service.
   */
  unregister: function() {
    if(this._registered)
      this.observerService.removeObserver(this, this._topic);
    this._registered = false;
  }
};

}
