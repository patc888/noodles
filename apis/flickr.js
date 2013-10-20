// ----------------- Routes --------------------

module.exports = function(app) {
  app.get('/apis/flickr/:query', findPhotos);
};

// ----------------- Handlers -------------------------

var YUI = require('yui').YUI;

findPhotos = function(request, reply) {
  // Get parameters
  var query = request.params.query;

  // Get the api key
  var api_key = getApiKey('flickr');
  if (!api_key) {
    reply.status(500).send('Missing API key');
    return;
  }

  // Execute a YQL query
  yquery = 'select * from flickr.photos.search where api_key="'
    + api_key + '" and has_geo="true" and text="' + query + '"';
  YUI().use('yql', function(Y) {
    Y.YQL(yquery, function(r) {
      reply.type('application/json');
      reply.json(r.query);
    });
  });
};

function getApiKey(name) {
  var fs = require('fs');
  var str = fs.readFileSync(__dirname + "/../api_keys.json").toString();
  var data = eval('(' + str + ')');
  return data[name];
}

