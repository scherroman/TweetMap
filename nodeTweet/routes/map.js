var express = require('express');
var router = express.Router();
var r = require('rethinkdb');
var url = require('url');
var request = require('request-json');
var hosts = require('../hosts');

var solrRequestClient = request.createClient('http://' + hosts.solrServer + ':8983/');

//Establish DB connection
var connection = null;
    r.connect( {host: 'localhost', port: 28015}, function(err, conn) {
          if (err) throw err;
          connection = conn;
})

/* GET home page. */
router.get('/', function(req, res, next) {
  //Get article title & body from DB entry for title passed in
  res.render('map', { title: 'Map a Tweet', tweetUser: 'Aaron', tweetText: 'Praise the Lord', 
  	tweetPlace: 'NYC, New York', tweetTime: '2:00 PM Oct 15 2015', 
  	tokens:['Praiseasldaldasldladslasldalsdalsdladlasl', 'the', 'Lord', 'yeah', 'a', 'b', 'c', 'd', 'efsfwsf', 'f', 'g', 'h'] });
  
});

module.exports = router;