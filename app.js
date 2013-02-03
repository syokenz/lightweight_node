var express = require('express')
  , routes = require('./routes');
var async = require('async');

var mongo_server = 'mongo-server'
var oracle_server = 'oracle-server'


var app = express();

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.get('/', function(req, res){
  res.render('index', { title: 'Express' })
});

app.get('/mongo/bukken', function(req, res){
  var mongo = require('mongodb'),
    Server = mongo.Server,
    Db = mongo.Db;
  
  var server = new Server(mongo_server, 27017, {});
  var db = new Db('lw', server, {safe:true});
  var user_id   = req.param('user_id');
  var bukken_id = req.param('bukken_id');

  var q = {};
  q['bukken_id'] = parseInt(bukken_id);

  db.open(function(err, db) {
    db.collection('bukken', function(err, collection) {
      collection.findOne(q, function(err, doc) {
        //debug
        for (var key in q) {
          console.log('q = '+ key + ':'+q[key]);
        }  
        res.render('bukken', { user_id:   user_id,
                               bukken_id: bukken_id,
                               doc: doc })
        db.close();
      });
    });
  });
});

app.get('/mongo/api', function(req, res){
  var mongo = require('mongodb'),
    Server = mongo.Server,
    Db = mongo.Db;
  
  var server = new Server(mongo_server, 27017, {});
  db = new Db('lw', server, {safe:true});
  user_id = req.param('user_id');
  api_id  = req.param('api_id');
  json = "";

  db.open(function(err, db) {
    // レコメンド物件取得処理 
    async.waterfall( [getActionHistory, getBukkenIds, calcKeyword, getKeyBestTen, calcBukken, getBukkenJson],
                     function(err, results) {
                       if (err) { throw err; }
                       res.send(results);
                       console.log("res.send");
                       db.close();
                   });
  });
});



/* レコメンド取得処理 */
/* 行動履歴取得 */
function getActionHistory(callback){
  db.collection('actionhistory', function(err, collection) {
    collection.find({'user_id' : parseInt(user_id)}, function(err, docs) {
      callback(null, docs);
    });
  });
}

/* 行動履歴から物件情報リストを作成する */
function getBukkenIds(docs, callback){
  var bukken_ids = new Array();
  
  db.collection('keyword', function(err, collection) {
    docs.each( function(err, doc){
      if (doc == null ) {
        callback(null, bukken_ids); 
      }else{
        bukken_ids.push({'bukken_id' : doc.bukken_id});
      }
    });
  });
}

/* 物件情報リストから物件に含まれるキーワードごとの合計を計算 */
function calcKeyword(bukken_ids, callback){
  var keyhash = {};
  
  db.collection('keyword', function(err, collection) {
    collection.find({'$or' : bukken_ids}, function(err, keywords) {
        keywords.each( function(err, key){
          if (key == null ) {
            callback(null, keyhash); 
          }else{
            if ( typeof keyhash[key.keyword] === "undefined" ) {
              keyhash[key.keyword] = 1;
            } else {
              keyhash[key.keyword] = keyhash[key.keyword] + 1;
            }
          }
        });
      });
  });
}

/* キーワード上位10件を配列化 */
function getKeyBestTen(keyhash, callback) {
  var keyword_list = new Array();

  keyhash = sortObj(keyhash, false, true, true);
  var count = 0;
  for (var key in keyhash) {
    count++;
    if (count > 10){break;}
    keyword_list.push({'keyword' : key});
  }
  callback(null, keyword_list);
}

/* キーワードを含む物件のIDを取得 */
function calcBukken(keyword_list, callback){
  var bukkenhash = {};
  db.collection('keyword', function(err, collection) {
    collection.find({'$or' : keyword_list}, function(err, keywords) {
      keywords.each( function(err, key){
        if (key == null ) {
          callback(null, bukkenhash);
        }else{
          if ( typeof bukkenhash[key.bukken_id] === "undefined" ) {
            bukkenhash[key.bukken_id] = 1;
          } else {
            bukkenhash[key.bukken_id] = bukkenhash[key.bukken_id] + 1;
          }
        }
      });
    });
  });
}

/* 物件上位2件をjsonとして返す */
function getBukkenJson (bukkenhash, callback) {
  /* 物件が2以下だった場合はnullを返す */
  if (bukkenhash.length < 2) {
    callback(null, null);
  } else {

    bukkenhash = sortObj(bukkenhash, false, true, true);
    var bukken_ids = new Array();
    var count = 0;
    for (var bukken_id in bukkenhash) {
      count++;
      if (count > 2){break;}
      bukken_ids.push({'bukken_id':parseInt(bukken_id)});
    }

    db.collection('bukken', function(err, collection) {
      //collection.find({'$or' : bukken_ids}).toArray(function(err, bukkens) {
      collection.find({'$or' : bukken_ids}).toArray(function(err, bukkens) {
        callback(null, bukkens);
      }); 
    }); 
  }
}





app.get('/mongo', function(req, res){
  var mongo = require('mongodb'),
    Server = mongo.Server,
    Db = mongo.Db;
  
  var server = new Server(mongo_server, 27017, {});
  var db = new Db('test', server, {safe:true});
  
  db.open(function(err, db) {
    console.log("DB name: " + db.databaseName);
    db.collection('users', function(err, collection) {
      console.log("Collection name: " + collection.collectionName);
      collection.find().toArray(function(err, doc) {
        console.log(doc);
        res.send(doc);
        db.close();
      });
    });
  });
});

app.get('/oracle', function(req, res){
  var oracle = require('db-oracle');
  new oracle.Database({
      hostname: oracle_server,
      user: 'test',
      password: 'test',
      database: 'XE'
  }).connect(function(error) {
      if (error) {
          return console.log("CONNECTION ERROR: " + error);
      }
  
      this.query().select('*').from('EMP').execute(function(error, rows) {
          if (error) {
              return console.log('ERROR: ' + error);
          }
          console.log(rows.length + ' ROWS');
          console.log(rows[0]);
          res.send(rows[0]);
      });
  });
});

function sortObj(obj, isKey, isNumber, isDesc){
  var ary = new Array();
  for(var i in obj){
    ary.push({key:i, value:obj[i]});
  }
  ary = ary.sort(sortFunc);
  var ret = new Object();
  for(var i = 0; i < ary.length; i++){
    ret[ary[i].key] = ary[i].value;
  }
  return ret;
  
  function sortFunc(left, right){
    var kv = (isKey) ? "key" : "value";
    var a = left[kv], b = right[kv];
    if(isNumber){
      a = parseFloat(a);
      b = parseFloat(b);
    }else{
      a = String(a);
      b = String(b);
    }
    if(isDesc){
      return a > b ? -1 : a < b ? 1 : 0;
    }else{
      return a < b ? -1 : a > b ? 1 : 0;
    }
  }
}

app.listen(80);
