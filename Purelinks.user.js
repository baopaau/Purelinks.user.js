// ==UserScript==
// @name         Purelinks.user.js
// @namespace    baopaau.purelinks
// @version      2020.07.13
// @description  Resolve actual hyperlinks in common websites
// @author       Baopaau
// @license      GPL-3.0-only
// @match        *://*/*
// @include      *
// @grant        none
// @connect      *
// @run-at       document-end
// ==/UserScript==

(function() {
  'use strict';
  
  /* Ensure that the script runs only once. */
  const isExecuted = encodeURIComponent('cytzu:purelinks:status');
  if (window[isExecuted]) return;
  window[isExecuted] = true;
  
  const globalRules = {
    'http[s]://[www.]google.com[.*]/search*':
    [GETVAL('q'),
     GETVAL('url')],

    'http[s]://[{www|zhuanlan}.]zhihu.com/*':
    [TK('http[s]://link.zhihu.com[.*]/?target=%s'),
     RE('http[s]://zhuanlan.zhihu.com[.*]/p/http%s','http$1'),
     decodeURIComponent],

    'http[s]://[*.]jianshu.com[/*]':
    [TK('https://links.jianshu.com/go?to=%s'),
     decodeURIComponent],
     
  };
  
  SHOW(globalRules);
  
  const DEBUG = () => {};
  const TEST = DEBUG;
  const SHOW = window.alert;
  DEBUG('Purelinks is loading');
  
  function takeLinkFromHead() {
    //const url = window.location.href;
    const url = 'https://m.baidu.com/from=844b/ssid=0/uid=0/bd_page_type=1/pu=usm%408%2Csz%40320_1004%2Cta%40iphone_2_10.0__/baiduid=3D1C581E3752E837454FC821B9FD6FA5/w=0_10_/t=iphone/l=1/tc?ref=www_iphone&lid=8186921914807332657&order=9&fm=alop&isAtom=1&is_baidu=0&tj=Wc_9_0_10_lNaN&clk_info=%7B%22tplname%22%3A%22tieba_newxml%22%2C%22srcid%22%3A%2210%22%7D&wd=&eqid=719dca1af7f3af31100000005f0bfc9e&w_qd=IlPT2AEptyoA_ykz5hEc8uOxJ5xTeJe&bdver=2&tcplug=1&dict=-1&l=1&sec=4950&di=79416b55749c6eed&bdenc=1&tch=124.132.206.3244.1.593&nsrc=wzhTfiM676EB1UMC1ra5zP1VA0XfALoKZeetBPGzSyYsiCp%2FgFmf6bxiKpFjMmxIOTuTMBs7td8x4Te3GKQpoz70W%2BQtLwbguDmdso2FHh%2FSlSiRQ5eIvqtdJt2ZM7EfVkpy0KWyKy5FsMs72nS8xo5xhsn1drDU8ihLNu4Lwcg%3D';  
    checkStatus(url)
        .then((response) => {
      let str = url + '\n';
      SHOW('REQUEST: '+str+'\n');
      str += response.getAllResponseHeaders() + '\n';
      for (const key in response) {
        //if (key != 'responseText' && key != 'response')
          str += key + ': ' + response[key] + '\n';
      }
      SHOW(str);
    }).catch((error) => {
      SHOW('ERROR\n'+error);
    });
  }
  
  function checkStatus(url) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest(); 
      request.open('HEAD', url)

      request.onreadystatechange = () => {
        if (request.readyState >= 2) {
          resolve(request)
          //request.abort()
        }
      }

      request.onerror = (e) => {
        reject(e)
      }
 
      request.send()
    })
  }
  
  
  // General use
  function TK(rule) {
    const re = new RegExp(mapStr4Regex(rule));
    return (str) => str.replace(re, '$1');
  }
  
  function RE(find, replace) {
    const re = new RegExp(mapStr4Regex(find));
    const tar = mapStr4Regex(replace);
    return (str) => str.replace(re, tar);
  }
  
  function RG(find, replaceAll) {
    const re = new RegExp(mapStr4Regex(find), 'g');
    const tar = mapStr4Regex(replaceAll);
    return (str) => str.replace(re, tar);
  }
  
  function GETVAL(key) {
    //return TK('*?*&' + key + '=%s[&*]');
    return key;
  }

  function mapStr4Regex(rule) {
    return rule
    // make URL characters alive
    //.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    .replace(/[-\/+?.]/g, '\\$&')
    // convert wildcard characters
    .replace(/\*/g, '\.\*')
    // convert 
    .replace(/\[/g, '\(\?:')
    .replace(/\]/g, '\)\?')
    .replace(/\{/g, '\(\?:')
    .replace(/\}/g, '\)')
    // mark the target
    .replace(/%s/g, '\(\.\*\)');
  }
  
  const pageRules = (() => {
    const here = window.location.href;
    for (const page in globalRules) {
      const gotIt = (new RegExp(mapStr4Regex(page))).test(here);
      if (gotIt)
        return globalRules[page];
    }
  })(); // type: Array of functions (String) -> String
  DEBUG('pageRules:\n'+pageRules);

  // no rule is found then we can skip this page
  if (pageRules === undefined) return;
  
  let hrefDict = {};
  function queryTargetHref(href) {
    let result = hrefDict[href];
    if (result === undefined) {
      const modifiedHref = pageRules.reduce(
        (str, mapf) => mapf(str), href);
      result = (modifiedHref != href) ? modifiedHref : null;
      hrefDict[href] = result;
    }
    return result;
  }

  function processAllLinks() {
    let links = document.getElementsByTagName('a');
    for (let link of links)
      processLink(link);
  }
  
  function processLink(link) {
    const modifiedHref = queryTargetHref(link.href);
    if (modifiedHref != null)
      link.href = modifiedHref;
  }
  
  const pageMutObserver = new MutationObserver((mutations) => {
    let targetSet = mutations.reduce((tsa, mutation) => {
      return Array.from(mutation.addedNodes).reduce((ts, node) => {
        let links = node.parentNode.getElementsByTagName('a');
        return new Set([...ts, ...links]);
      }, tsa);
    }, new Set());
    targetSet.forEach(processLink);
      
    SHOW(Array.from(targetSet));
  });
  
  function pageLoadedCallback() {
    SHOW('GOO');
    //takeLinkFromHead();
    processAllLinks();
    pageMutObserver.observe(document.documentElement,
      {'childList': true, 'subtree': true });
  }
  
  
  function runWhenDocReady(callback) {
    if (document.readyState === "complete" ||
        (document.readyState !== "loading" &&
         !document.documentElement.doScroll)
    ) {
      callback();
    } else {
      document.addEventListener(
        "DOMContentLoaded", callback);
    }
  }
  runWhenDocReady(pageLoadedCallback);
  DEBUG('END');
})();
