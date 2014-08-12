// ----------------- Routes --------------------

module.exports = function(app) {
  app.get('/apis/wallabee/users/:user_id/find_lower', findLower);
  app.get('/apis/wallabee/users/:user_id/average', average);
};

// ----------------- Handlers -------------------------

var YUI = require('yui').YUI;

average = function(request, reply) {
  var userId = request.params.user_id;

  // Get the api key
  var api_key = getApiKey('wallabee');
  if (!api_key) {
    reply.status(500).send('Missing API key');
    return;
  }

  YUI().use('io-base', 'json-parse', 'promise', function(Y) {
    // Retrieve's the user's saved items and computes the average item number
    Y.io('http://api.wallab.ee/users/' + userId + '/saveditems', {
      headers: {
        'X-WallaBee-API-Key': api_key,
      },
      on: {
        success: function(tx, r) {
          var obj = JSON.parse(r.responseText).saveditems;
          var total = 0;
          var count = 0;
          for (var key in obj) {
            total += parseInt(obj[key].number);
            count++;
          }
          reply.type('text/plain');
          reply.send('' + (total / count));
        } 
      }
    });
  });
};

findLower = function(request, reply) {
  var userId = request.params.user_id;

  // Get the api key
  var api_key = getApiKey('wallabee');
  if (!api_key) {
    reply.status(500).send('Missing API key');
    return;
  }

  YUI().use('io-base', 'json-parse', 'promise', function(Y) {
    // Retrieve's the user's saved items.
    // Resolves a map of item_type_id -> number.
    var savedItemsP = new Y.Promise(function (resolve, reject) {
      console.log("getting user's saved items");
      Y.io('http://api.wallab.ee/users/' + userId + '/saveditems', {
        headers: {
          'X-WallaBee-API-Key': api_key,
        },
        on: {
          success: function(tx, r) {
            console.log("got user's saved items");
            var obj = JSON.parse(r.responseText).saveditems;
            var items = new Object();
            for (var key in obj) {
              items[key] = parseInt(obj[key].number);
            }
            resolve(items);
          } 
        }
      });
    });

    function q(url) {
      return new Y.Promise(function (resolve, reject) {
        console.log("getting market:" + url);
        Y.io(url, {
          headers: {
            'X-WallaBee-API-Key': api_key,
          },
          on: { 
            success: function(tx, r) {
              console.log("got market:" + url);
              var obj = JSON.parse(r.responseText).items;
              var items = new Object();
              for (var key in obj) {
                itemType = obj[key].item_type_id;
                var num = parseInt(obj[key].number);
                var cost = parseInt(obj[key].cost);
                if (cost <= 5000) {
                  if (!items[itemType]) {
                    items[itemType] = { "number": num, "cost": cost };
                  } else if (num < items[itemType].number) {
                    items[itemType].number = num;
                    items[itemType].cost = cost;
                  }
                }
              }
              Y.later(1000*Math.random(), null, function() {
                resolve(items);
              }, [], false);
            } 
          }
        });
      });
    }

    // Resolves an array of { item_type_id, number, name, cur_number, rare }
    // sorted by cost.
    function getItemTypeNamesP(marketItems) {
      var ids = new Array();
      for (var key in marketItems) {
        if (!marketItems[key].name) {
          ids.push(key);
        }
      }
      return new Y.Promise(function (resolve, reject) {
        Y.io('http://api.wallab.ee/itemtypes/'+ids.join(), {
          headers: {
            'X-WallaBee-API-Key': api_key,
          },
          on: { 
            success: function(tx, r) {
              var obj = JSON.parse(r.responseText);
              for (var key in obj) {
                var itemTypeId = obj[key].item_type_id;
                marketItems[itemTypeId].name = obj[key].name;
              }

              var items = new Array();
              for (var key in marketItems) {
                items.push(marketItems[key]);
              }

              // Sort the items by cost
              items.sort(function (a, b) {
                if (a.rare < b.rare) {
                  return -1;
                } else if (a.rare > b.rare) {
                  return 1;
                } else if (a.cost < b.cost) {
                  return -1;
                } else if (a.cost > b.cost) {
                  return 1;
                }
                // The greater gain should be first
                return a.number - b.number;
              });
              resolve(items);
            }
          }
        });
      });
    }

    var numPages = 2;
    var marketItemsP = new Array();
    for (var i=1; i<=numPages; i++) {
      marketItemsP.push(q('http://api.wallab.ee/market?page='+i));
    }
    var raresMap = getRaresMap();

    Y.batch(savedItemsP, marketItemsP[0], marketItemsP[1], marketItemsP[2], 
            marketItemsP[3], marketItemsP[4]).then(function(data) {
      var savedItems = data[0];
      var pickedItems = {};

      // For each market item, if number is not smaller, remove it
      for (var i=1; i<=numPages; i++) {
        var page = data[i];
        for (var key in page) {
          var savedNumber = savedItems[key];

          if (page[key].number < 1000 && raresMap[key]) {
            page[key].item_type_id = key;
            page[key].rare = raresMap[key][1];
            page[key].name = raresMap[key][2];
            page[key].cur_number = savedNumber;   // Add the user's saved number
            pickedItems[key] = page[key];
          } else if (page[key].number < 1000 && page[key].cost <= 300
             || page[key].number < 500 && page[key].cost <= 500
             || page[key].number < 250 && page[key].cost <= 1000
             || page[key].number < 200 && page[key].cost <= 2000
             || page[key].number < 100 && page[key].cost <= 15000) {
              // Cheap
            page[key].item_type_id = key;
            page[key].rare = 1000;
            page[key].name = raresMap[key] ? raresMap[key][2] : "unknown";
            page[key].cur_number = savedNumber;
            pickedItems[key] = page[key];
          } else if (key == 1191 && page[key].cost <= 250) { // invisibility
            page[key].item_type_id = key;
            page[key].rare = raresMap[key][1];
            page[key].name = raresMap[key][2];
            page[key].cur_number = savedNumber;
            pickedItems[key] = page[key];
          }

          // Cheap
          if (page[key].number < 1000 && page[key].cost <= 300
             || page[key].number < 500 && page[key].cost <= 500
             || page[key].number < 250 && page[key].cost <= 1000
             || page[key].number < 200 && page[key].cost <= 2000) {
              page[key].rare = 1100;              // Mark as rare
              page[key].item_type_id = key;
              page[key].name = raresMap[key] ? raresMap[key][2] : "unknown";
              page[key].cur_number = savedNumber; // Add the user's saved number
              pickedItems[key] = page[key];
          }
        }
      }
      var sortedItems = new Array();
      for (var key in pickedItems) {
        sortedItems.push(pickedItems[key]);
      }

      // Sort the items by cost
      sortedItems.sort(function (a, b) {
        if (a.rare < b.rare) {
          return -1;
        } else if (a.rare > b.rare) {
          return 1;
        } else if (a.cost < b.cost) {
          return -1;
        } else if (a.cost > b.cost) {
          return 1;
        }
        // The greater gain should be first
        return a.number - b.number;
      });

      reply.type('application/json');
      reply.json(sortedItems);
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

// File format: item_type_id | rarity | name
function getRaresMap() {
  var map = {};
  var lines = require('fs').readFileSync(__dirname+'/wallabee_rares.dat').toString().split(/\r?\n/);
  for (var i in lines) {
    var parts = lines[i].split(/\|/);
    parts[1] = parseInt(parts[1]);
    map[parts[0]] = parts;
  }
  return map;
}
