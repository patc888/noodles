// ----------------- Routes --------------------

module.exports = function(app) {
  app.get('/apis/wallabee/users/:user_id/find_lower', findLower);
};

// ----------------- Handlers -------------------------

var YUI = require('yui').YUI;

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
    // Resolves a map of item_type_id -> { lo_number, cost } 
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
              if (!items[itemType] 
                  || parseInt(obj[key].number) < items[itemType].lo_number) {
                items[itemType] = { "lo_number": parseInt(obj[key].number),
                                    "cost": parseInt(obj[key].cost) };
              }
            }
            resolve(items);
          } 
        }
      });
    });

    // Retrieves the item type names.
    // Resolves an array of { item_type_id, lo_number, image_url, name, cur_number }
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
                  if (a.cost > b.cost)
                    return 1;
                  if (a.cost < b.cost)
                    return -1;
                  // a must be equal to b
                  return 0;
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
        if (!number || number < marketItems[key].lo_number) {
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
  var fs = require('fs');
  var str = fs.readFileSync(__dirname + "/../api_keys.json").toString();
  var data = eval('(' + str + ')');
  return data[name];
}

