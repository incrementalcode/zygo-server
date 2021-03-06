import React from 'react';
import jspm from 'jspm';
import builder from './systemjs-builder';
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import * as Routes from './routes';
import * as Debug from './debug';

//Wrapper around importing a component before rendering.
export function renderComponent(path, state) {
  return jspm.import(path)
    .then((componentModule) => {
      let element = React.createElement(componentModule.default, state);
      return _renderComponent(element, [path]);
    })
    .catch(Debug.propagate("Error rendering component: "));
}

//Renders the given react component to page elements, with given state.
//Embeds css traces of the given list of component module paths.
function _renderComponent(component, modulePaths=[]) {
  let result = {
    cssTrace: null,
    component: null
  };

  return traceAllCss(modulePaths)
    .then((cssTrace) => result.cssTrace = cssTrace)
    .then(() => React.renderToString(component))
    .then((rendered) => result.component = rendered)
    .then(() => result)
    .catch(Debug.propagate("Error in _renderComponent(): "));
}

//Get a list of combined traces from a list of modules
function traceAllCss(modulePaths) {
  let cssTrace = [];
  return Promise.all(modulePaths.map(traceCss))
    .then((traces) => traces.reduce((a, b) => a.concat(b), []))
    .then((traces) => traces.filter((a, i) => traces.indexOf(a) === i))
    .catch(Debug.propagate("Error tracing css: "));
}

//Traces the css of a module asynchronously, returns a list
// of file paths to the css files a module requires/imports.
function traceCss(modulePath) {
  return builder.trace(modulePath)
    .then((trace) => {
      return Object.keys(builder.loader.loads)
        .map((key) => builder.loader.loads[key].address)
        .filter((address) => !!address.match('\\.css$'))
        .map((address) => address.substr('file:'.length));
    });
}

//Given an ordered list of matched routes, most general to least general,
// return component render nesting them and render it to page elements.
//The given context is that modfied and returned by the component handlers.
export function renderRoutes(routes, context) {
  //We render backwards - we need to inject the least general into its parent etc
  // all the way up the chain.
  routes.reverse();

  //Get component modules
  let loadedModules = [];

  //Load in component modules in order, grabbing identity if component not specified.
  return Promise.all(
    routes
      .map((route) => route.component)
      .map((module, i) => {
        return Promise.resolve()
          .then(() => {
            if (module) return jspm.import(module);
            return require('../defaults/id-component');
          })
          .then((componentModule) =>
            loadedModules[i] = componentModule.default
          );
      })
  )
  .then(() => {
    //Reduce routes down to a single component, return render.
    return loadedModules.reduce((component, next, i) => {
      return React.createElement(next, context, component);
    }, null);
  })
  .then((component) => {
    //grab modules for css trace
    let modules = routes
      .map((route) => route.component)
      .filter((module) => !!module);

    //undo reverse, as it is mutable
    routes.reverse();

    return _renderComponent(component, modules);
  })
  .then((renderObject) => {
    renderObject.context = context;
    renderObject.routes = routes;
    return renderObject;
  })
  .catch(Debug.propagate("Error rendering routes: "));
}

//Given renderObject from the other functions, renders the template specified in config.
// Returns HTML.
//Requires a zygo instance as we need to inject various config things, such as
// the routes object, the bundles JSON, etcetera.
export function renderPage(renderObject, zygo) {
  //we need to pass in:
  // bundling information
  // css trace information - _normalized_
  let host = renderObject.context.request.headers.host;
  let templateMeta = renderObject.context.templateMeta;
  return runSerialize(renderObject.routes, renderObject.context)
    .then(() => {
      var includeBundles = zygo.config.bundlesJSON && zygo.config.env === 'production';

      let templateData = {
        cssTrace: normalizeCssTrace(renderObject.cssTrace, zygo),
        bundles: includeBundles ? JSON.stringify(zygo.config.bundlesJSON) : null,
        visibleBundles: includeBundles ? getVisibleBundles(renderObject.routes, zygo) : null,
        component: renderObject.component,
        routes: JSON.stringify(zygo.routes),
        matchedRoutes: JSON.stringify(renderObject.routes),
        context: JSON.stringify(renderObject.context || {}),
        path: renderObject.context.curRoute.path,
        title: renderObject.context.pageTitle || '',
        meta: templateMeta,
        baseURL: 'http://' + host,
        addLinkHandlers: zygo.config.anchors
      };

      let template = Handlebars.compile(zygo.config.template);
      return template(templateData);
    })
    .catch(Debug.propagate("Error rendering page: "));
}

//Given the routes and the context, serialize if necessary
function runSerialize(routes, context) {
  //default serialize out request data and meta
  delete context.request;
  delete context.templateMeta;

  let handlers = [];
  return Promise.all(routes.map(getHandler))
    .then(() => {
      handlers.map((handler, i) => {
        if (handler && handler.serialize) handler.serialize(context);
      });
    });

  function getHandler(route, i) {
    Routes.getHandler(route)
      .then((handler) => handlers[i] = handler ? handler : null)
      .catch(Debug.propagate("Error getting handler in runSerialize(): "));
  }
}

//Find bundles visible to the given routes. We inject these as script tags
// for a performant first load.
//Set bundles visible to given routes
export function getVisibleBundles(routes, zygo) {
  if (!zygo.config.bundlesJSON) return;

  let bundles = [];
  Object.keys(zygo.config.bundlesJSON).map((key) => {
    let sharedRoutes =
      routes.filter((route) => zygo.config.bundlesJSON[key].routes.indexOf(route._path) !== -1);

    if (sharedRoutes.length > 0)
      bundles.push('/' + key);
  });

  return bundles;
}

//Normalize a css trace relative to Zygo's base URL, so the client can find it.
function normalizeCssTrace(cssTrace, zygo) {
  return cssTrace.map((trace) => trace.substr(zygo.baseURL.length));
}
