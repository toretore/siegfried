window['$'] = function(){ return document.getElementById.apply(document, arguments); };
window['$A'] = function(){ var a=[]; for (var i=0; i<arguments.length; i++) { a.push(arguments[i]); } return a; };

window['$E'] = (function(){

  var namespaces = {
    xul: 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
    html: 'http://www.w3.org/1999/xhtml'
  };

  return function(){
    var tagName = arguments[0],
        attributes = arguments[1] || {},
        children = Array.filter(arguments, function(a,i){ return i > 1; });

    var m = tagName.match(/([^:]+):(.*)/);
    var ns = m && namespaces[m[1]],
        el;

    if (ns) {
      el = document.createElementNS(namespaces[m[1]], tagName);
    } else {
      el = document.createElement(tagName);
    }

    for each (var [k,v] in Iterator(attributes)) { el.setAttribute(k, v); }
    children.forEach(function(child){
      el.appendChild(typeof child == 'string' ? document.createTextNode(child) : child);
    });

    return el;
  };
})();

Siegfried = {

  get username() { return $('twitter-username').value; },
  set username(v) { $('twitter-username').value = v; },
  get password() { return $('twitter-password').value; },
  set password(v) { $('twitter-password').value = v; },
  get updateFrequency() { return $('update-frequency').value; },
  set updateFrequency(v) { $('update-frequency').value = v; },

  get privateTimelineURL() {
    if (!this.username || !this.password) { return null; }
    return 'http://'+this.username+':'+this.password+
           '@twitter.com/statuses/friends_timeline.json'
  },
  publicTimelineURL: 'http://twitter.com/statuses/public_timeline.json',
  get updateURL() {
    if (!this.username || !this.password) { return null; }
    return 'http://'+this.username+':'+this.password+
           '@twitter.com/statuses/update.xml';
  },
  
  get privateUpdatesList() { return $('private-updates'); },
  get publicUpdatesList() { return $('public-updates'); },
  
  get selectedTabName() {
    return $('siegfried-tabpanels').selectedPanel.getAttribute('name');
  },

  init: function(){
    with ($('twitter-username')) value = getAttribute('savedValue');
    with ($('twitter-password')) value = getAttribute('savedValue');
    with ($('update-frequency')) value = getAttribute('savedValue');
    if (!this.privateTimelineURL) { this.showPreferences(); }
    this.reloadUpdates();
    this.createReloader();
  },
  
  destruct: function(){
    with ($('twitter-username')) setAttribute('savedValue', value);
    with ($('twitter-password')) setAttribute('savedValue', value);
    with ($('update-frequency')) setAttribute('savedValue', value);
  },

  reloadUpdates: function(){
    this.getPublicUpdates();
    this.getPrivateUpdates();
  },
  
  reloadCurrent: function(){
    switch (this.selectedTabName) {
      case 'private':
        this.getPrivateUpdates();
        break;
      case 'public':
        this.getPublicUpdates();
        break;
    }
  },
  
  getUpdates: function(url, options){
    return this.request(this.merge({
      url: url,
      evalJSON: true,
      onFailure: function(){ dump('FAILed to get updates: '+url+'\n'); },
      onException: function(r,e){ dump('FAIL: '+e+'\n'); }
    }, options || {}));
  },
  
  getPublicUpdates: function(opts){
    var that = this;
    var list = this.publicUpdatesList;

    return this.getUpdates(this.publicTimelineURL, this.merge({
      onLoading: function(){
        while (list.firstChild) { list.removeChild(list.firstChild); }
        list.appendChild($E('description', {}, 'Loading...'));
      },
      onSuccess: function(res){
        while (list.firstChild) { list.removeChild(list.firstChild); }
        that.buildUpdatesFromJSON(res.responseJSON).forEach(function(item){
          list.appendChild(item);
        });
      }
    }, opts || {}));
  },
  
  getPrivateUpdates: function(opts){
    if (!this.privateTimelineURL) { return null; }

    var that = this;
    var list = this.privateUpdatesList;

    return this.getUpdates(this.privateTimelineURL, this.merge({
      onLoading: function(){
        while (list.firstChild) { list.removeChild(list.firstChild); }
        list.appendChild($E('description', {class:'loading', flex:'1'}, 'Loading...'));
      },
      onSuccess: function(res){
        while (list.firstChild) { list.removeChild(list.firstChild); }
        that.buildUpdatesFromJSON(res.responseJSON).forEach(function(item){
          list.appendChild(item);
        });
      }
    }, opts || {}));
  },
  
  buildUpdatesFromJSON: function(json){
    var that = this, odd = false;
    return json.map(function(update){
      var time = new Date(update.created_at);
      return $E('richlistitem', {class:'update '+((odd = !odd) ? 'odd' : 'even')},
        $E('vbox', {pack:'center'},
          $E('image', {src:update.user.profile_image_url})
        ),
        $E('vbox', {flex:'1'},
          $E('hbox', {align:'center'},
            $E('label', {class:'username', value:update.user.screen_name}),
            $E('label', {class:'time', value:that.formatTime(time)})
          ),
          $E.apply(window, ['description', {class:'message', flex:'1'}].concat(that.formatUpdateText(update.text)))
        )
      );
    });
  },
  
  postUpdate: function(){
    if (this.updateURL) {
      var that = this;

      this.request({
        url: this.updateURL,
        method: 'post',
        data: 'status='+$('update-message').value,
        onLoading: function(){
          $('cmd_siegfried_send_update').setAttribute('disabled', 'true');
        },
        onSuccess: function(){
          $('update-message').value = '';
          that.reloadUpdates();
        },
        onFailure: function(){
          alert('FAIL');
        },
        onComplete: function(){
          $('cmd_siegfried_send_update').removeAttribute('disabled');
        },
        onException: function(req, e){
          alert('FAIL: '+e);
        }
      });
    }
  },

  showPreferences: function(){
    $('siegfried-tabs').selectedTab = $('preferences-tab');
    $('siegfried-tabpanels').selectedPanel = $('preferences-tabpanel');
  },

  updateStatusbar: function(v){
    $('status-message').value = v;
  },
  
  createReloader: function(){
    var minutes, that = this;
    if (this._reloader) { clearInterval(this._reloader); }
    if (minutes = $('update-frequency').value) {
      this._reloader = setInterval(function(){
        that.reloadUpdates();
      }, minutes*60*1000);
    }
  },

  quit: function(aForceQuit) {
    var appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].
        getService(Components.interfaces.nsIAppStartup);

    // eAttemptQuit will try to close each XUL window, but the XUL window can cancel the quit
    // process if there is unsaved data. eForceQuit will quit no matter what.
    var quitSeverity = aForceQuit ? Components.interfaces.nsIAppStartup.eForceQuit :
          Components.interfaces.nsIAppStartup.eAttemptQuit;
    appStartup.quit(quitSeverity);
  },

  request: function(options){
    options = this.merge({
      onSuccess: this.K,
      onFailure: this.K,
      onLoading: this.K,
      onComplete: this.K,
      onException: this.K,
      method: 'get',
      asynchronous: true,
      data: null
    }, options || {});

    options.method = options.method.toUpperCase();

    //readyState 1 fires twice for some reason,
    //make sure onLoading only runs once
    var onLoading = options.onLoading;
    options.onLoading = function(){
      var hasRun = false;
      return function(){
        if (!hasRun){
          hasRun = true;
          return onLoading.apply(this, arguments);
        }
      };
    }();

    var req = new XMLHttpRequest();
    req.onreadystatechange = function(){
      switch (req.readyState) {
        case 1:
          options.onLoading(req);
          break;
        case 4:
          try {
            try {
              if (options.evalJSON) req.responseJSON = eval(req.responseText);
            } catch (e) { throw('JSON Error: '+e); }
            options['on'+(req.status == 200 ? 'Success' : 'Failure')](req);
            options.onComplete(req);
          } catch (e) { options.onException(req, e); }
          break;
      }
    };

    req.open(options.method, options.url, options.asynchronous);
    if (options.method == 'POST') req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    req.send(options.data);

    return req;
  },
  
  formatTime: function(time){
    var now = new Date(),
        str = '';
    if (time.getYear() == now.getYear() && time.getMonth() == now.getMonth()) {
      if (time.getDate() == now.getDate()) {
        str += 'Today at ';
      } else if (now.getDate() - time.getDate() == 1) {
        str += 'Yesterday at ';
      } else {
        str += time.toLocaleFormat('%a %e %b at ');
      }
    } else {
      str += time.toLocaleFormat('%a %e %b %Y at');
    }

    return str + time.toLocaleFormat('%H:%M');
  },
  
  formatUpdateText: function(text){
    return text.split(/(@[a-zA-Z0-9_-]+)/).reduce(function(els,s){
      var m = s.match(/(@)([a-zA-Z0-9_-]+)/);
      if (m){
        els.push($E('html:a', {href:'#'}, m[1]+m[2]));
      } else {
        els = els.concat(s.split(/((?:http:\/\/|www\.)[^ ]+)/).map(function(s){
          var m = s.match(/((?:http:\/\/|www\.)[^ ]+)/);
          return m ? $E('html:a', {href:s, class:'text-link'}, s) : s;
        }));
      }
      return els;
    }, []);
  },

  merge: function(target, source, keep){
    var o = {};
    for (var p in target) { o[p] = target[p]; }
    for (var p in source) {
      if (source.hasOwnProperty(p) && (!keep || !target.hasOwnProperty(p))) {
        o[p] = source[p];
      }
    }
    return o;
  },

  K: function(){}

};



if (!Array.prototype.reduce)
{
  Array.prototype.reduce = function(fun /*, initial*/)
  {
    var len = this.length;
    if (typeof fun != "function")
      throw new TypeError();

    // no value to return if no initial value and an empty array
    if (len == 0 && arguments.length == 1)
      throw new TypeError();

    var i = 0;
    if (arguments.length >= 2)
    {
      var rv = arguments[1];
    }
    else
    {
      do
      {
        if (i in this)
        {
          rv = this[i++];
          break;
        }

        // if array contains no values, no initial value to return
        if (++i >= len)
          throw new TypeError();
      }
      while (true);
    }

    for (; i < len; i++)
    {
      if (i in this)
        rv = fun.call(null, rv, this[i], i, this);
    }

    return rv;
  };
}




function toOpenWindowByType(inType, uri) {
  var winopts = "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar";
  window.open(uri, "_blank", winopts);
}
