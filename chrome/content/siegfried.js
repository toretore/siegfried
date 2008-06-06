window['$'] = function(){ return document.getElementById.apply(document, arguments); }

Siegfried = {

  get username() { return $('twitter-username').value; },
  set username(v) { $('twitter-username').value = v; },
  get password() { return $('twitter-password').value; },
  set password(v) { $('twitter-password').value = v; },
  get updateFrequency() { return $('update-frequency').value; },
  set updateFrequency(v) { $('update-frequency').value = v; },

  get privateTimelineURL() {
    return 'http://'+this.username+':'+this.password+
           '@twitter.com/statuses/friends_timeline.xml'
  },
  publicTimelineURL: 'http://twitter.com/statuses/public_timeline.xml',
  get updateURL() {
    return 'http://'+this.username+':'+this.password+
           '@twitter.com/statuses/update.xml';
  },

  init: function(){
    with ($('twitter-username')) value = getAttribute('savedValue');
    with ($('twitter-password')) value = getAttribute('savedValue');
    with ($('update-frequency')) value = getAttribute('savedValue');
    if (!this.isUpdatable()) { this.showPreferences(); }
    this.reloadUpdates();
    this.createReloader();
  },
  
  destruct: function(){
    with ($('twitter-username')) setAttribute('savedValue', value);
    with ($('twitter-password')) setAttribute('savedValue', value);
    with ($('update-frequency')) setAttribute('savedValue', value);
  },
  
  isUpdatable: function(){
    return this.username && this.password;
  },

  reloadUpdates: function(){
    if (this.isUpdatable()) {
      $('private-updates').setAttribute('datasources', 'rdf:null');
      $('public-updates').setAttribute('datasources', 'rdf:null');
      $('private-updates').setAttribute('datasources', this.privateTimelineURL);
      $('public-updates').setAttribute('datasources', this.publicTimelineURL);
    }
  },
  
  postUpdate: function(){
    if (this.isUpdatable()) {
      var that = this;
      var req = new XMLHttpRequest();
      req.onreadystatechange = function(){
        if (req.readyState == 4) {
          if (req.status == 200) {
            that.updateStatusbar('');
            $('update-message').value = '';
            that.reloadUpdates();
          } else {
            alert('FAIL');
          }
        }
      };
      req.open('POST', this.updateURL, true);
      req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      req.send('status='+$('update-message').value);
      this.updateStatusbar('Sending update..');
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
        dump('reloader\n');
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
  }

};
