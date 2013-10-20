// ----------------- Routes --------------------

module.exports = function(app) {
  app.get('/apis/rest/:p1/:p2', doGetDelete);
  app.delete('/apis/rest/:p1/:p2', doGetDelete);
  app.post('/apis/rest/:p1/:p2', doPostPut);
  app.put('/apis/rest/:p1/:p2', doPostPut);
};

// ----------------- Handlers -------------------------

doGetDelete = function(request, reply) {
  reply.type('application/json');
  var results = new Object();
  results.p1 = request.params.p1;
  results.p2 = request.params.p2;
  results.p3 = request.query.p3;
  results.p4 = request.query.p4;
  reply.json(results);
};

doPostPut = function(request, reply) {
  reply.type('application/json');
  var results = new Object();
  results.p1 = request.params.p1;
  results.p2 = request.params.p2;
  results.p3 = request.query.p3;
  results.p4 = request.query.p4;
  results.p5 = request.body.p5;
  results.p6 = request.body.p6;
  reply.json(results);
}
