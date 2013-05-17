#!/usr/bin/env node

var program = require('commander'),
    db = require('../lib/db'),
    Article = require('../lib/article'),
    Feed = require('../lib/feed'),
    User = require('../lib/user'),
    async = require('async'),
    EventEmitter = require('events').EventEmitter;

var app = new EventEmitter();

program
  .version('0.0.1')
  .option('-d, --debug', 'Debug flag')
  .parse(process.argv);

console.log('Timeline Updater starting...');

db.on('connect', function() {
  app.emit('nextarticle');
});

app.on('nextarticle', function() {
  async.waterfall(
    [
      function(callback) {
        // Get article key to integrate...
        db.blpop('articles:integration', 0, callback);
      },
      function(replies, callback) {
        // Get article from db...
        var aid = replies[1];
        Article.get(aid, callback);
      },
      function(article, callback) {
        console.log('Integrating article %s (%s)...', article.id, article.pubdate);
        var updateUserTimelines = function(uid, next) {
          User.addArticleToTimeline(uid, 'global', article, next);
        }
        // Get feed subscribers...
        var parts = article.id.split(':');
        var fid = parts[0] + ':' + parts[1];
        Feed.getSubscribers(fid, function(err, uids) {
          if (err) return callback(err);
          async.each(uids, updateUserTimelines, callback);
        });
      },
      function() {
        app.emit('nextarticle');
      }
    ],
    function(err) {
      console.log('Error: %s', err);
      app.emit('nextarticle');
    }
  );
});

