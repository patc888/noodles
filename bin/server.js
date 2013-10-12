
/**
 * Module dependencies.
 */

var express = require('express');
var expressHbs  = require('express3-handlebars');
var expressLoad = require('express-load');
var http = require('http');
var path = require('path');
var rootPath = path.join(__dirname, '/..');
var app = express();

// Configs for all environments
app.set('views', path.join(rootPath, '/webpages'));
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(rootPath, 'webpages')));
app.set('port', process.env.PORT || 3000);
app.engine('handlebars', expressHbs());
app.set('view engine', 'handlebars');

// Configs for dev environment only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}
expressLoad(path.join(rootPath, 'apis')).into(app);

// Start server
http.createServer(app).listen(app.get('port'), function(){
  console.log('Server listening on port ' + app.get('port'));
});
