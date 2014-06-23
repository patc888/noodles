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

    // Resolves an array of { item_type_id, number, image_url, name, cur_number, rare }
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

      // Should move these into a file
      var rarekeys1 = [160,168,172,823,72,828,162,289,330,75,130,69,227,932,275,5,917,137,922,482,738,334,465,238,480,337,584,576,483,332,4,350,937,810,744,929,222,920,421,610,463,129,924,190,859,344,730,646,736,127,189,441,826,132,349,579,729,157,862,733,934,575,327,77,735,835,49,614,724,732,765,762,921,418,447,38,574,706,631,857,769,496,440,148,388,155,454,1034,466,611,358,276,973,65,573,623,154,926,87,581];
      var rarekeys2 = [171,931,324,997,111,319,1094,822,1115,516,938,804,343,1051,105,312,1017,33,74,390,768,248,981,136,108,259,41,897,26,858,116,458,553,830,201,1018,1132,772,928,8,114,407,1325,427,585,1019,781,23,42,785,109,241,64,425,426,83,654,18,609,1131,318,97,612,817,151,1336,606,824,748,166,393,528,677,309,1052,525,651,62,993,95,1039,333,679,770,518,1023,1191,630,161,138,1381,336,689,1382,529,1022,61,283,150,1208];
      var rarekeys3 = [551,10,1020,240,509,527,526,174,531,47,530,863,852,796,355,1016,406,179,1129,626,625,9,455,1047,1037,510,1326,473,371,1106,749,805,795,978,890,825,1098,951,462,1243,415,176,36,893,359,402,1209,326,1053,988,315,247,24,812,1096,887,899,420,200,147,320,1114,616,1015,708,976,444,1161,470,461,860,507,279,754,513,281,813,434,900,806,397,199,865,1054,650,419,990,423,657,549,552,416,107,1212,1335,225,80,128,141,485,1431];
      var rarekeys4 = [1196,1257,484,793,396,102,235,453,45,815,213,428,896,1223,1165,216,1394,431,759,29,258,13,790,1203,548,501,1121,879,210,1160,449,99,1199,22,808,228,618,655,956,1206,464,1055,3,180,875,538,627,374,1380,314,1338,1251,1225,389,1,613,1332,81,898,392,1240,489,424,1093,1388,439,653,1373,492,198,512,357,632,962,471,110,361,282,1216,855,366,923,827,221,1175,961,19,477,377,1408,311,1386,750,468,310,543,1226,173,851,710];
      var rarekeys5 = [780,1247,257,246,322,2,1328,395,1027,277,459,711,267,517,935,1178,1024,76,1174,502,242,280,394,250,957,1026,1176,758,1177,495,1130,307,452,901,803,152,1222,602,56,766,197,260,1183,861,701,446,285,753,683,656,51,430,1189,756,959,37,1038,457,91,936,96,92,229,891,353,1331,256,1035,134,370,380,845,1099,237,376,432,365,1207,1029,1097,17,989,211,63,577,554,1025,184,288,1040,734,1036,737,731,245,979,183,746,82,578];

      // For each market item, if number is not smaller, remove it
      for (var i=1; i<=numPages; i++) {
        var page = data[i];
        for (var key in page) {
          var number = savedItems[key];

          // Only add items with lower numbers
          if ((!number || page[key].number < number)
              && (!lowestItems[key] || page[key].number < lowestItems[key].number)) {
            page[key].rare = 0;              // Mark as not rare
            page[key].cur_number = number;   // Add the user's current number
            lowestItems[key] = page[key];
          }

          // Add the very rare items
          for (var j=0; j<rarekeys1.length; j++) {
            if (key == rarekeys1[j] && page[key].number < 1000) {
              page[key].rare = 1;              // Mark as rare
              page[key].cur_number = number;   // Add the user's current number
              lowestItems[key] = page[key];
            }
          }

          // Add the very rare items
          for (var j=0; j<rarekeys2.length; j++) {
            if (key == rarekeys2[j] && page[key].number < 1000) {
              page[key].rare = 2;              // Mark as rare
              page[key].cur_number = number;   // Add the user's current number
              lowestItems[key] = page[key];
            }
          }

          // Add the next rare items
          for (var j=0; j<rarekeys3.length; j++) {
            if (key == rarekeys3[j] && page[key].number < 1000) {
              page[key].rare = 3;              // Mark as rare
              page[key].cur_number = number;   // Add the user's current number
              lowestItems[key] = page[key];
            }
          }

          // Add the next rare items
          for (var j=0; j<rarekeys4.length; j++) {
            if (key == rarekeys4[j] && page[key].number < 1000) {
              page[key].rare = 4;              // Mark as rare
              page[key].cur_number = number;   // Add the user's current number
              lowestItems[key] = page[key];
            }
          }

          // Add the next rare items
          for (var j=0; j<rarekeys5.length; j++) {
            if (key == rarekeys5[j] && page[key].number < 1000) {
              page[key].rare = 5;              // Mark as rare
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

function getRares() {
  var lines = require('fs').readFileSync(__dirname+'/rares.dat').toString().split(/\r?\n/);
  for (var i in lines) {
    var parts = lines[i].split(/,/);
    if (parts[0] === name && !lines[i].match(/^\s*(#.*)?$/)) {
      return parts[1];
    }
  }
  return process.env['API_KEY_'+name];
}
