window['$'] = function(){ return document.getElementById.apply(document, arguments); };
window['$A'] = function(){ var a=[]; for (var i=0; i<arguments.length; i++) { a.push(arguments[i]); } return a; };

window['$E'] = function(){
  var tagName = arguments[0],
      attributes = arguments[1] || {},
      children = Array.filter(arguments, function(a,i){ return i > 1; });

  var el = document.createElement(tagName);
  for each (var [k,v] in Iterator(attributes)) { el.setAttribute(k, v); }
  children.forEach(function(child){
    el.appendChild(typeof child == 'string' ? document.createTextNode(child) : child);
  });

  return el;
};

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
    return 'http://'+this.username+':'+this.password+
           '@twitter.com/statuses/update.xml';
  },
  
  get privateUpdatesList() { return $('private-updates'); },
  get publicUpdatesList() { return $('public-updates'); },

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
    return json.map(function(update){
      return $E('richlistitem', {class:'update'},
        $E('vbox', {pack:'center'},
          $E('image', {src:update.user.profile_image_url})
        ),
        $E('vbox', {flex:'1'},
          $E('hbox', {align:'center'},
            $E('label', {class:'username', value:update.user.screen_name}),
            $E('label', {class:'time', value:update.created_at})
          ),
          $E('description', {class:'message', flex:'1'}, update.text)
        )
      );
    });
  },
  
  postUpdate: function(){
    if (this.isUpdatable()) {
      var that = this;

      this.request({
        url: 'http://www.example.com/',
        method: 'post',
        data: 'status='+$('update-message').value,
        onLoading: function(){
          dump('LOADING\n');
          that.updateStatusbar('Sending update...');
        },
        onSuccess: function(){
          dump('SUCCESS\n');
          that.updateStatusbar('');
          $('update-message').value = '';
          that.reloadUpdates();
        },
        onFailure: function(){
          alert('FAIL');
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
          } catch (e) { options.onException(req, e); }
          break;
      }
    };

    req.open(options.method, options.url, options.asynchronous);
    if (options.method == 'POST') req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    req.send(options.data);

    return req;
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



function toOpenWindowByType(inType, uri) {
  var winopts = "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar";
  window.open(uri, "_blank", winopts);
}
