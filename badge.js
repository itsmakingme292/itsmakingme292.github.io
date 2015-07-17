(function(){
  var API_URL = 'https://api.github.com/';

  /**
   * Load and cache JSONP data
   */
  var loadJSONP = function ( url, callback ) {
    var setLocalData = false;

    /*
     * Setting a variable callback method since we're writing to window
     */
    var callbackMethod = url.replace(/[^a-zA-Z0-9]/g, '_')
    /*
     * Send data to the callback function, caching data if needed
     */
    window[callbackMethod] = function(data){
      if(setLocalData){
        //Cache for 1 day
        var d = new Date();
        d.setDate(d.getDate()+1);

        try {
          localStorage.setItem(url, JSON.stringify({expiry: d.getTime(), value: data}));
        } catch(e){
          console.log("Could not add item to local storage...clearing localStorage...", e);
          localStorage.clear();
        }
      }

      window[callback](data);
    }

    /*
     * Make the JSONP request
     */
    function requestDataFromRemote(){
      // Create script with url and callback (if specified)
      var ref = window.document.getElementsByTagName( 'script' )[ 0 ];
      var script = window.document.createElement( 'script' );
      script.src = url + (url.indexOf( '?' ) + 1 ? '&' : '?') + 'callback='+callbackMethod

      // Insert script tag into the DOM (append to <head>)
      ref.parentNode.insertBefore( script, ref );

      // After the script is loaded (and executed), remove it
      script.onload = function () {
          this.remove();
      };
    }

    var stored = localStorage.getItem(url);
    if(stored){
      var now = (new Date()).getTime();
      var json = JSON.parse(stored);

      if(json.expiry > now){
        window[callbackMethod](json.value);
      } else {
        localStorage.removeItem(url);
        setLocalData = true;
        requestDataFromRemote();
      }
    } else {
      setLocalData = true;
      requestDataFromRemote();
    }
  };

  /*
   * Shorthand to grab an element
   */
  var el = function(s){
    return document.createElement(s);
  }

  /*
   * Set basic info from the widget
   */
  function widgetInit(widget, data){
    widget.className = 'github-badge';
    data.orientation = widget.getAttribute('orientation') || 'vertical';
    if(data.orientation) widget.className += ' '+data.orientation;
    data.badge = widget.getAttribute('badge') || 'octo';
    widget.className += ' '+data.badge;
    data.username = widget.getAttribute('user');
  }

  /*
   * Build the widget summary column
   */
  function widgetSummaryColumnElements(widget, data, nodes){
    //Create summary column
    nodes.summary = el('div');
    nodes.summary.className = 'gb-summary';

    var img = el('img');
    img.className = "user";
    img.width = (data.badge == 'octo' ? "50" : "100");
    nodes.img = img;
    nodes.summary.appendChild(nodes.img);

    var name = el('h4');
    nodes.name = name;
    nodes.summary.appendChild(nodes.name);

    function pwContent(contentName, iconClass){
      var containerName = contentName + 'Container';
      var c = el('p');
      c.className = contentName;
      var i = el('i');
      i.className=iconClass;
      c.appendChild(i);
      nodes[contentName] = el('span');
      c.appendChild(nodes[contentName]);
      nodes[containerName] = c;
      nodes.summary.appendChild(nodes[containerName]);
    }

    if(data.badge != 'octo') pwContent('location', 'fa fa-map-marker');
    pwContent('followers', 'fa fa-users');
    pwContent('repostotal', 'octicon octicon-repo');
    pwContent('stars', 'fa fa-star');
    if(data.badge != 'octo') pwContent('gists', 'fa fa-pencil');

    widget.appendChild(nodes.summary);
  }

  /*
   * Create detail elements
   */
  function widgetDetailElements(widget, data, nodes){
    if(data.badge != 'octo'){
      //Repos
      nodes.detail = el('div');
      nodes.detail.className = "detail";

      nodes.repos = {
        container: el('section'),
        title: el('h4'),
        listContainer: el('div')
      }

      nodes.repos.container.className = 'repos';
      nodes.repos.title.innerHTML = 'Popular repositories';

      var r_ = nodes.repos;
      var rc = r_.container;
      rc.appendChild(r_.title);
      rc.appendChild(r_.listContainer);
      nodes.detail.appendChild(rc);

      //Languages
      nodes.languages = {
        container: el('section'),
        title: el('h4'),
        listContainer: el('div')
      }

      nodes.languages.container.className = 'languages';
      nodes.languages.title.innerHTML = 'Codes in';
      nodes.languages.container.appendChild(nodes.languages.title);
      nodes.languages.container.appendChild(nodes.languages.listContainer);

      nodes.detail.appendChild(nodes.languages.container);

      widget.appendChild(nodes.detail);
    }
  }

  /*
   * Add octodex to the widget
   */
  function widgetOctodex(widget){
    var octodex = el('img');
    octodex.className = 'octodex';
    octodex.width = '30';
    widget.appendChild(octodex);
  }

  /*
   * Load the Widget's Basic Data
   */
  function widgetDataBasic(widget, widget_data, nodes, callback){
    // Function to run on success
    window.gh_badge_basicData = function(res) {
      var meta = res.meta;
      var data = res.data;

      widget.addEventListener('click', function(){
        var a = el('a');
        a.target = "_blank";
        a.href = data.html_url;
        a.click();
      });

      if(nodes.img) nodes.img.src = data.avatar_url;

      if(nodes.name) nodes.name.innerHTML = data.name;

      if(nodes.location) nodes.location.innerHTML = data.location;

      if(nodes.followers) nodes.followers.innerHTML = data.followers + (widget_data.badge != 'octo' ? ' followers' : '');

      if(nodes.repostotal){
        nodes.repostotal.innerHTML = data.public_repos + (widget_data.badge != 'octo' ? ' public repos' : '');
        widget_data.repos_count = data.public_repos;
      }

      if(nodes.gists) nodes.gists.innerHTML = data.public_gists + ' gists';
      //if(nodes.followers) nodes.followers.innerHTML = data.followers + ' followers';
    
      var page = 0;
      callback(data);
    }
  }

  /*
   * Load the Widget's Repo Data
   */ 
  function widgetDataRepos(widget, widget_data, nodes, basic_data){
    //Number of requests to make
    var n = Math.ceil(basic_data.public_repos/30);
    //Counter to check completed requests
    var n_ = 0;

    var untilDone = setInterval(function(){
      if(n_ == n){
        clearInterval(untilDone);

        if(widget_data.badge != 'octo'){
          var sorted = widget_data.repos.sort(function(a, b){
            if(a.stargazers_count < b.stargazers_count) return 1;
            if(a.stargazers_count > b.stargazers_count) return -1;
            return 0;
          });

          var t = sorted.slice(0, 3);
          t.map(function(repo){
            var p = el('p');
            var i = el('i');
            i.className = 'fa fa-star';
            p.appendChild(i);
            var s = el('span');
            s.innerHTML = repo.stargazers_count;
            p.appendChild(s);
            p.innerHTML = p.innerHTML + repo.name + ' ('+repo.language+')';
            nodes.repos.listContainer.appendChild(p);
          });

          
          var langP = el('p');
          var langArray = [];
          for(var key in widget_data.languages){
            if(key != 'null'){
              var obj = {name: key, value: widget_data.languages[key]};
              langArray.push(obj);
            }
          }

          var langSorted = langArray.sort(function(a, b){        
            if(a.value < b.value) return 1;
            if(a.value > b.value) return -1;
            return 0;
          });

          var langString = langSorted.map(function(lang){
            return lang.name;
          }).join(', ');


          langP.innerHTML = langString;

          nodes.languages.listContainer.appendChild(langP);
        }
      }
    }, 1);

    window.gh_badge_repoData = function(res){
      var meta = res.meta;
      var data = res.data;

      data.map(function(repo){
        widget_data.stargazers = widget_data.stargazers + repo.stargazers_count;
        widget_data.repos.push(repo);
        if(widget_data.languages[repo.language]){
          ++widget_data.languages[repo.language];
        } else {
          widget_data.languages[repo.language] = 1;
        }
      });

      if(nodes.stars) nodes.stars.innerHTML = widget_data.stargazers + (widget_data.badge != 'octo' ? ' stars' : '');
      ++n_;
    }

    //n JSONP calls
    for(var i=1;i<(n+1);i++){

    }
  }

  /*
   * Add the history elements
   */
  function widgetHistoryElement(widget, widget_data, nodes){  
    if(widget_data.badge == 'octo'){
      nodes.history = el('div');
      nodes.history.className = 'history';
      nodes.history.id = 'github-badge-history';

      var day = new Date();
      day.setHours(0,0,0,0);
      day.setDate(day.getDate()-29);
      var DAYS_OF_HISTORY = 30;

      function padDigits(number, digits) {
        return Array(Math.max(digits - String(number).length + 1, 0)).join(0) + number;
      }

      widget_data.history = {days: {}};
      for(var i=0;i<DAYS_OF_HISTORY;i++){
        var date = [day.getFullYear(), padDigits((day.getMonth()+1), 2), padDigits(day.getDate(), 2)].join('-')
        var dayEl = el('i');
        widget_data.history.days[date] = {
          el: dayEl,
          value: 0
        };
        dayEl.setAttribute('data-date', date);
        day.setDate(day.getDate()+1);
        nodes.history.appendChild(dayEl);
      }

      widget.appendChild(nodes.history);
    }
  }

  /*
   * Load the history data
   */
  function widgetHistoryData(widget, widget_data, nodes){
    if(widget_data.badge != 'octo') return;

    widget_data.history.pages = 0;

    function loadHistory(){
      loadJSONP( API_URL+'users/'+widget_data.username+'/events/public?page='+(++widget_data.history.pages), 'gh_badge_history' );
    }

    function githubDate(e){
      return e.created_at.split('T')[0];
    }

    function dateStringIn30Days(date){
      var today = new Date();
      today.setHours(0,0,0,0);
      today.setDate(today.getDate()-30);
      var monthAgo = today;

      var d = new Date(date);
      d.setDate(d.getDate()+1);

      return d > monthAgo;
    }

    function populateHistoryData(){
      var daysArr = widget_data.history.days;
      
      for(key in widget_data.history.days){
        var day = widget_data.history.days[key];

        var dayClass = '';

        if(day.value >= 18){
          dayClass = 'many-commits';
        } else if(day.value >= 12){
          dayClass = 'more-commits';
        } else if(day.value >= 6){
          dayClass = 'some-commits';
        } else if(day.value > 0){
          dayClass = 'few-commits';
        }

        day.el.className = dayClass;
      }
    }

    window.gh_badge_history = function(res){
      var meta = res.meta;
      var data = res.data;
      var daysObj = widget_data.history.days;
  
      data.map(function(e){
        if(e.type == 'PushEvent' || e.type == 'PullRequestEvent'){
          var s = githubDate(e);
          if(daysObj[s] != undefined){
            if(e.type == 'PushEvent'){
              daysObj[s].value += parseInt(e.payload.size);
            }

            if(e.type == 'PullRequestEvent'){
              daysObj[s].value += parseInt(e.payload.pull_request.commits);
            }
          } else {
          }
        }
      });

      if(data.length && widget_data.history.pages < 10){ //Only 10 days of data can be requested
        var lastEvent = githubDate(data[data.length-1]);
        if(dateStringIn30Days(lastEvent)){
          loadHistory();
        } else {
          populateHistoryData();
        }
      } else {
        populateHistoryData();
      }
    }

    loadHistory();
  }

  /*
   * Main Widget Class
   */
  var Widget = function(widget){
    var nodes = {};

    var data = {
      stargazers: 0,
      repos: [],
      repos_count: 0,
      languages: {}
    };

    //Create elements
    widgetInit(widget, data);
    widgetSummaryColumnElements(widget, data, nodes);
    widgetDetailElements(widget, data, nodes);
    widgetOctodex(widget);
    widgetHistoryElement(widget, data, nodes);

    //Load data
    widgetHistoryData(widget, data, nodes);
  }

  /*
   * Badge is Initialized Here
   */
  var init = (function(){
    var widgets = document.getElementsByTagName('github-badge');
    if(widgets.length){
      for(var i=0;i<widgets.length;i++){
        new Widget(widgets[i]);
      }
    }
  })();
})();
