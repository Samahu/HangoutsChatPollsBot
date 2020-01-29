// log proxy
var log = (function () {
  return {
    info: function (msg) { /*console.info(msg);*/ },
    error: function (msg) { console.error(msg); }
  }
})();