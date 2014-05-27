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

    function q(url) {
      return new Y.Promise(function (resolve, reject) {
        Y.io(url, {
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

    var numPages = 5;
    var marketItemsP = new Array();
    for (var i=1; i<=numPages; i++) {
      marketItemsP.push(q('http://api.wallab.ee/market?page='+i));
    }

    Y.batch(savedItemsP, marketItemsP[0], marketItemsP[1], marketItemsP[2], 
            marketItemsP[3], marketItemsP[4]).then(function(data) {
      var savedItems = data[0];
      var lowestItems = new Array();
      var rarekeys = [171,931,707,324,111,1094,997,319,822,1115,938,516,343,804,105,1051,312,33,1017,74,390,768,248,981,136,108,41,259,897,26,858,116,458,830,201,1132,1018,772,928,8,114,407,1352,427,585,1019,781,23,42,785,241,109,64,425,426,83,654,18,609,1131,97,318,612,817,151,1336,606,824,748,166, 393,528,677,309,1052,525,62,651,95,993,333,1039,679,518,770,1023,630,1191,161,138,336,689,1022,529,1208,150,61,551,283,10,160,168,172,823,72,828,162,289,330,75,69,130,227,932,275,5,917,482,137,922,738,334,465,238,480,584,337,576,483,332,4,350,810,937,744,929,222,920,610,421,463,129,924,190,859,344,646,730,127,736,189,441,132,826,349,579,729,157,733,862,934,327,575,77,735,835,49,614,724,732,765,762,921,418,447,38,574,706,631,857,769,496,148,440,388,454,155,1034,466,611,358,276,973,65,573,623,154,926,581,87];

      // For each market item, if number is not smaller, remove it
      for (var i=1; i<=numPages; i++) {
        var page = data[i];
        for (var key in page) {
          var number = savedItems[key];

          // Only add items with lower numbers
          if ((!number || page[key].number < number)
              && (!lowestItems[key] || page[key].number < lowestItems[key].number)) {
            page[key].cur_number = number;   // Add the user's current number
            lowestItems[key] = page[key];
          }

          // Add the rare items
          for (var j=0; j<rarekeys.length; j++) {
            if (key == rarekeys[j] && page[key].number < 1000) {
              page[key].cur_number = number;   // Add the user's current number
              lowestItems[key] = page[key];
            }
          }
        }
      }

      // Get the item type names and then display them
      getItemTypeNamesP(lowestItems).then(function(items) {
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
