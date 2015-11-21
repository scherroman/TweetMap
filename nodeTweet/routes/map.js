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
  	tokens:['Praise', 'the', 'Lord'] });
  
});

router.post('/', function(req, res) {
	var theme = req.body.theme; //Title from webpage body
	theme = theme.toLowerCase();
	var relatedTerms = JSON.parse(req.body.relatedTerms);

	var relatedTermsLength = relatedTerms.length;
	for (var i = 0; i < relatedTermsLength; i++) {
		relatedTerms[i] = relatedTerms[i].toLowerCase();
		console.log("relatedTerm: ", relatedTerms[i]);
	} 

	console.log("theme: ", theme);
	console.log("relatedTerms: ", relatedTerms);
});

module.exports = router;