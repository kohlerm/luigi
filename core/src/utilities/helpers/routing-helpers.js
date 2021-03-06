// Helper methods for 'routing.js' file. They don't require any method from 'routing.js' but are required by them.
// They are also rarely used directly from outside of 'routing.js'
import { LuigiConfig } from '../../core-api';
import { AsyncHelpers, EscapingHelpers, GenericHelpers } from './';
import { Routing } from '../../services/routing';

class RoutingHelpersClass {
  constructor() {
    this.defaultContentViewParamPrefix = '~';
  }

  getLastNodeObject(pathData) {
    const lastElement = [...pathData.navigationPath].pop();
    return lastElement ? lastElement : {};
  }

  async getDefaultChildNode(pathData) {
    const lastElement =
      pathData.navigationPath[pathData.navigationPath.length - 1];

    const children = await AsyncHelpers.getConfigValueFromObjectAsync(
      lastElement,
      'children',
      pathData.context
    );
    const pathExists = children.find(
      childNode => childNode.pathSegment === lastElement.defaultChildNode
    );

    if (lastElement.defaultChildNode && pathExists) {
      return lastElement.defaultChildNode;
    } else if (children && children.length) {
      const rootPath = pathData.navigationPath.length === 1;
      if (rootPath) {
        const firstNodeWithPathSegment = children.find(
          child => child.pathSegment
        );
        return (
          (firstNodeWithPathSegment && firstNodeWithPathSegment.pathSegment) ||
          console.error(
            'At least one navigation node in the root hierarchy must have a pathSegment.'
          )
        );
      }
      const validChild = children.find(
        child =>
          child.pathSegment &&
          (child.viewUrl || (child.externalLink && child.externalLink.url))
      );
      if (validChild) return validChild.pathSegment;
    }

    return '';
  }

  parseParams(paramsString) {
    const result = {};
    const viewParamString = paramsString;
    const pairs = viewParamString ? viewParamString.split('&') : null;
    if (pairs) {
      pairs.forEach(pairString => {
        const keyValue = pairString.split('=');
        if (keyValue && keyValue.length > 0) {
          result[decodeURIComponent(keyValue[0])] = decodeURIComponent(
            keyValue[1]
          );
        }
      });
    }
    return result;
  }

  getNodeParams(params) {
    const result = {};
    const paramPrefix = this.getContentViewParamPrefix();
    if (params) {
      Object.entries(params).forEach(entry => {
        if (entry[0].startsWith(paramPrefix)) {
          const paramName = entry[0].substr(paramPrefix.length);
          result[paramName] = entry[1];
        }
      });
    }
    return this.sanitizeParamsMap(result);
  }

  applyPathParams(path, pathParams) {
    let result = path;
    if (pathParams) {
      Object.entries(pathParams).forEach(([param, value]) => {
        result = result.replace(new RegExp(':' + param, 'g'), value);
      });
    }
    return result;
  }

  findViewGroup(node) {
    if (node.viewGroup) {
      return node.viewGroup;
    } else if (node.parent) {
      return this.findViewGroup(node.parent);
    }
  }

  getContentViewParamPrefix() {
    let prefix = LuigiConfig.getConfigValue('routing.nodeParamPrefix');
    if (prefix === false) {
      prefix = '';
    } else if (!prefix) {
      prefix = this.defaultContentViewParamPrefix;
    }
    return prefix;
  }

  addRouteChangeListener(callback) {
    const hashRoutingActive = LuigiConfig.getConfigValue(
      'routing.useHashRouting'
    );

    window.addEventListener('message', e => {
      if ('refreshRoute' === e.data.msg && e.origin === window.origin) {
        const path = hashRoutingActive
          ? Routing.getHashPath()
          : Routing.getModifiedPathname();
        callback(path);
      }
    });

    if (hashRoutingActive) {
      return window.addEventListener('hashchange', event => {
        callback(Routing.getHashPath(event.newURL));
      });
    }

    window.addEventListener('popstate', () => {
      callback(Routing.getModifiedPathname());
    });
  }

  buildRoute(node, path, params) {
    return !node.parent
      ? path + (params ? '?' + params : '')
      : this.buildRoute(
          node.parent,
          `/${node.parent.pathSegment}${path}`,
          params
        );
  }

  getRouteLink(node, pathParams) {
    if (node.externalLink && node.externalLink.url) {
      return node.externalLink;
      // externalLinkUrl property is provided so there's no need to trigger routing mechanizm
    } else if (node.link) {
      const link = node.link.startsWith('/')
        ? node.link
        : Routing.buildFromRelativePath(node);
      return link;
    }

    let route = RoutingHelpers.buildRoute(node, `/${node.pathSegment}`);
    return GenericHelpers.replaceVars(route, pathParams, ':', false);
  }

  getNodeHref(node, pathParams) {
    if (LuigiConfig.getConfigBooleanValue('navigation.addNavHrefs')) {
      const link = RoutingHelpers.getRouteLink(node, pathParams);
      return link.url || link;
    }
    return 'javascript:void(0)';
  }

  substituteDynamicParamsInObject(object, paramMap, paramPrefix = ':') {
    return Object.entries(object)
      .map(([key, value]) => {
        let foundKey = Object.keys(paramMap).find(
          key2 => value === paramPrefix + key2
        );
        return [key, foundKey ? paramMap[foundKey] : value];
      })
      .reduce((acc, [key, value]) => {
        return Object.assign(acc, { [key]: value });
      }, {});
  }

  substituteViewUrl(viewUrl, componentData) {
    const contextVarPrefix = 'context.';
    const nodeParamsVarPrefix = 'nodeParams.';

    viewUrl = GenericHelpers.replaceVars(
      viewUrl,
      componentData.pathParams,
      ':',
      false
    );
    viewUrl = GenericHelpers.replaceVars(
      viewUrl,
      componentData.context,
      contextVarPrefix
    );
    viewUrl = GenericHelpers.replaceVars(
      viewUrl,
      componentData.nodeParams,
      nodeParamsVarPrefix
    );
    return viewUrl;
  }

  sanitizeParamsMap(paramsMap) {
    return Object.entries(paramsMap).reduce((sanitizedMap, paramPair) => {
      sanitizedMap[
        EscapingHelpers.sanitizeParam(paramPair[0])
      ] = EscapingHelpers.sanitizeParam(paramPair[1]);
      return sanitizedMap;
    }, {});
  }
}

export const RoutingHelpers = new RoutingHelpersClass();
