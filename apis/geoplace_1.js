// ----------------- Routes --------------------

module.exports = function(app) {
  app.get('/apis/geoplace_1/:location', getLocations);
};

// ----------------- Handlers -------------------------

var YUI = require('yui').YUI;

getLocations = function(request, reply) {
  var location = request.params.location;

  // Execute a YQL query
  yquery = 'select * from geo.places where text="' + location + '"';
  YUI().use('yql', function(Y) {
    Y.YQL(yquery, function(r) {
      reply.type('application/json');
      reply.json(r.query);
    });
  });
};
