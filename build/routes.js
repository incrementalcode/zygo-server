"use strict";
Object.defineProperties(exports, {
  match: {get: function() {
      return match;
    }},
  runHandlers: {get: function() {
      return runHandlers;
    }},
  __esModule: {value: true}
});
var $__url_45_pattern__,
    $__jspm__;
var pattern = ($__url_45_pattern__ = require("url-pattern"), $__url_45_pattern__ && $__url_45_pattern__.__esModule && $__url_45_pattern__ || {default: $__url_45_pattern__}).default;
var jspm = ($__jspm__ = require("jspm"), $__jspm__ && $__jspm__.__esModule && $__jspm__ || {default: $__jspm__}).default;
function match(path, routes) {
  var result = _match(path, '', routes);
  if (!result)
    return null;
  var options = result[0].options;
  delete result[0].options;
  return {
    options: options,
    routes: result.reverse()
  };
}
function _match(path, curPattern, curRoute) {
  var childRoutes = {};
  var otherParams = {_path: curPattern};
  Object.keys(curRoute).map((function(key) {
    if (key[0] === '/')
      childRoutes[key] = curRoute[key];
    else
      otherParams[key] = curRoute[key];
  }));
  var match = pattern.newPattern(curPattern || '/').match(path);
  if (match !== null) {
    otherParams.options = match;
    return [otherParams];
  }
  if (pattern.newPattern(curPattern + '(.*)').match(path)) {
    Object.keys(childRoutes).map((function(key) {
      var result = _match(path, curPattern + key, childRoutes[key]);
      if (result) {
        result.push(otherParams);
        match = result;
      }
    }));
  }
  return match;
}
function runHandlers(routes) {
  var context = arguments[1] !== (void 0) ? arguments[1] : {};
  return routes.reduce((function(chain, route) {
    return chain.then((function() {
      return route.serverHandler ? jspm.import(route.serverHandler) : null;
    })).then((function(module) {
      return !module && route.handler ? jspm.import(route.handler) : null;
    })).then((function(module) {
      return module ? module.handler(context) : null;
    }));
  }), Promise.resolve()).then((function() {
    return context;
  }));
}
//# sourceURL=routes.js