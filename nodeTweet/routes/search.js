var express = require('express');
var router = express.Router();
var r = require('rethinkdb');
var url = require('url');
var request = require('request-json');
var hosts = require('../hosts');

var TERM_SEARCH = 'term'
var THEME_SEARCH = 'theme'

var solrRequestClient = request.createClient('http://' + hosts.solrServer + ':8983/');

//Establish DB connection
var connection = null;
    r.connect( {host: 'localhost', port: 28015}, function(err, conn) {
          if (err) throw err;
          connection = conn;
})

/* GET home page. */
router.get('/', function(req, res, next) {

  //Check for search request
  if (req.query.input) {
  	console.log("Received Search Request.");
  	handleSearchRequest(req, res, next);
  }
  else {
  	//Get article title & body from DB entry for title passed in
  	res.render('search', { "title": 'Search for Tweets', "dataToRender": false});
  }
});


//This method handles search requests
handleSearchRequest = function(req, res, next) {

	console.log("Search Query: ", req.query);

	var searchInput = req.query.input;
	var searchType = req.query.type;
	console.log("Search input: ", searchInput);

	if (searchType === TERM_SEARCH) {
		console.log("Term search: ", searchInput.term);
		console.log("tweetStartingIndex: ", searchInput.tweetStartingIndex);
		console.log("numTweetsRequested: ", searchInput.numTweetsRequested);

	}
	else if (searchType === THEME_SEARCH)  {
		console.log("Theme search: ", searchInput.theme);
		console.log("tweetStartingIndex: ", searchInput.tweetStartingIndex);
		console.log("numTweetsRequested: ", searchInput.numTweetsRequested);
	}

	tweetUser = 'Aaron';
	tweetText =  "In other news, my edges are laid, my skin is poppin and I'm educated...shout out to my parents for these genes🙌🏽😂";
	tweetPlace = 'NYC, New York';
	tweetTime = '8:33 PM - 22 Nov 2015';

	numTotalTweets = 1000 //Test value
	topRelatedTerms = ['lion', 'cup', 'fool', 'andy', 'huh', 'what', 'gum'];
	topRelatedTerms = topRelatedTerms.join(", ");


	var tweet = {
		user: tweetUser,
		text: tweetText,
		place: tweetPlace,
		time: tweetTime
	}

	var tweets = [];

	var numTweets = 10; //test value
	for (var i = 0; i < numTweets; i++) {
		tweets[i] = tweet;
	}

	res.render('search', { "title": 'Search for Tweets', 
												 "dataToRender": true,
												 "numTotalTweets": numTotalTweets, 
												 "topRelatedTerms": topRelatedTerms,
												 "tweets": tweets,
												 "type": searchType,
												 "searchInput": searchInput
											 });
}

module.exports = router;