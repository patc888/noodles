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
      Y.io('http://api.wallab.ee/users/' + userId + '/saveditems', {
        headers: {
          'X-WallaBee-API-Key': api_key,
        },
        on: {
          success: function(tx, r) {
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

    // Retrieves all items in the market.
    // Resolves a map of item_type_id -> { number, cost } 
    var marketItemsP = new Y.Promise(function (resolve, reject) {
      Y.io('http://api.wallab.ee/market', {
        headers: {
          'X-WallaBee-API-Key': api_key,
        },
        on: { 
          success: function(tx, r) {
            var obj = JSON.parse(r.responseText).items;
            var items = new Object();
            for (var key in obj) {
              itemType = obj[key].item_type_id;
              var num = parseInt(obj[key].number);
              var cost = parseInt(obj[key].cost);
              if (!items[itemType]) {
                items[itemType] = { "number": num, "cost": cost };
              } else if (num < items[itemType].number) {
                var n = items[itemType].number;
                var c = items[itemType].cost;
                items[itemType].number = num;
                items[itemType].cost = cost;
                num = n;
                cost = c;
              }
              if (num > items[itemType].number
                  && (!items[itemType].nx_number || num < items[itemType].nx_number)) {
                items[itemType].nx_number = num;
                items[itemType].nx_cost = cost;
              }
            }
            resolve(items);
          } 
        }
      });
    });

    // Retrieves the item type names.
    // Resolves an array of { item_type_id, number, image_url, name, cur_number }
    // sorted by cost.
    function getItemTypeNamesP(marketItems) {
      var ids = new Array();
      for (var key in marketItems) {
        ids.push(key);
      }
      return new Y.Promise(function (resolve, reject) {
        Y.io('http://api.wallab.ee/itemtypes/'+ids.join(), {
          headers: {
            'X-WallaBee-API-Key': api_key,
          },
          on: { 
            success: function(tx, r) {
              var items = new Array();
              var obj = JSON.parse(r.responseText);
              for (var key in obj) {
                var itemTypeId = obj[key].item_type_id;
                marketItems[itemTypeId].name = obj[key].name;
                marketItems[itemTypeId].image_url = obj[key].image_url_50;
                marketItems[itemTypeId].item_type_id = itemTypeId;
                items.push(marketItems[itemTypeId]);
              }

              // Sort the items by cost
              items.sort(function (a, b) {
                if (a.cost > b.cost) {
                  return 1;
                } else if (a.cost < b.cost) {
                  return -1;
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

    Y.batch(savedItemsP, marketItemsP).then(function(data) {
      var savedItems = data[0];
      var marketItems = data[1];

      // For each market item, if number is not smaller, remove it
      for (var key in marketItems) {
        var number = savedItems[key];
        // Add the user's current number
        marketItems[key].cur_number = number;
        if (!number || number < marketItems[key].number) {
          delete marketItems[key];
        }
      }

      // Get the item type names and then display them
      getItemTypeNamesP(marketItems).then(function(items) {
        reply.type('application/json');
        reply.json(items);
      });
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
