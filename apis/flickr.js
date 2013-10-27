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
  var lines = require('fs').readFileSync(__dirname+'/../api_keys').toString().split(/\r?\n/);
  for (var i in lines) {
    var parts = lines[i].split(/\s+/);
    if (parts[0] === name && !lines[i].match(/^\s*(#.*)?$/)) {
      return parts[1];
    }
  }
  return process.env['API_KEY_'+name];
}

