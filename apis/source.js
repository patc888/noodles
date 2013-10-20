// ----------------- Routes --------------------

module.exports = function(app) {
  app.get('/apis/source', doGet);
};

// ----------------- Handlers -------------------------

var fs = require('fs');

doGet = function(request, reply) {
  fs.readFile(request.query.file, 'utf8', function (err, data) {
    if (err) {
      return console.log(err);
    }
    reply.type('text/plain');
    reply.send(data);
  });
};
