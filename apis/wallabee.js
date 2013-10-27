// ----------------- Routes --------------------

module.exports = function(app) {
  app.get('/apis/wallabee/find_lower', findLower);
};

// ----------------- Handlers -------------------------

var YUI = require('yui').YUI;

findLower = function(request, reply) {
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
      Y.io('http://api.wallab.ee/users/5601/saveditems', {
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
    // Resolves a map of item_type_id -> { lo_number, image_url, name, cur_number }.
    function getItemTypeNamesP(items) {
      var ids = new Array();
      for (var key in items) {
        ids.push(key);
      }
      return new Y.Promise(function (resolve, reject) {
        Y.io('http://api.wallab.ee/itemtypes/'+ids.join(), {
          headers: {
            'X-WallaBee-API-Key': api_key,
          },
          on: { 
            success: function(tx, r) {
              var obj = JSON.parse(r.responseText);
              var names = new Object();
              for (var key in obj) {
                var itemTypeId = obj[key].item_type_id;
                items[itemTypeId].name = obj[key].name;
                items[itemTypeId].image_url = obj[key].image_url_50;
              }
              resolve(items);
            } 
          }
        });
      });
    }

    Y.batch(savedItemsP, marketItemsP)
      .then(function(data) {
         var savedItems = data[0];
         var marketItems = data[1];

         // For each market item, if number is not smaller, remove it
         for (var key in marketItems) {
           var number = savedItems[key];
           marketItems[key].cur_number = number;
           if (!number || number < marketItems[key].lo_number
                || marketItems[key].cost > 5000) {
             delete marketItems[key];
           }
         }

         // Get the item type names and then display them
         getItemTypeNamesP(marketItems).then(function(items) {
           reply.type('text/html');
           var output = '';
           for (var key in items) {
             if (items[key].cur_number >= 1000 && items[key].lo_number < 1000) {
               output += '<img src="' + items[key].image_url + '"/> '
                 + items[key].name + " (" + items[key].cur_number + " -> " 
                 + items[key].lo_number + ") $" + items[key].cost + "<br>";
             }
           }
           output += "<hr/>";
           for (var key in items) {
             if (items[key].cost <= 5000 && items[key].cur_number < 1000) {
               output += '<img src="' + items[key].image_url + '"/> '
                 + items[key].name + " (" + items[key].cur_number + " -> " 
                 + items[key].lo_number + ") $" + items[key].cost + "<br>";
             }
           }
           reply.write(output);
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

