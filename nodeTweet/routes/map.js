var express = require('express');
var router = express.Router();
var r = require('rethinkdb');
var url = require('url');
var request = require('request-json');
var hosts = require('../hosts');
var keyword_extractor = require("keyword-extractor");

var solrRequestClient = request.createClient('http://' + hosts.solrServer + ':8983/');

//Establish DB connection
var connection = null;
    r.connect( {host: 'localhost', port: 28015}, function(err, conn) {
          if (err) throw err;
          connection = conn;
})

/* GET home page. */
router.get('/', function(req, res, next) {

  var tweetText = "Praise & the Lord$ almighty| in the house, Of God. | Praise Jesus oh lordy.";
  // var tweetText = "'06 NFL MVP 31 TD's in 1 season 5th leading rusher";
  // var tweetText = "Sources: #BlueJays acquire #Athletics’ Jesse Chavez.";
  // var tweetText = "In other news, my edges are laid, my skin is poppin and I'm educated...shout out to my parents for these genes🙌🏽😂";

  var filteredWords = keyword_extractor.extract(tweetText,{
                                                                language:"english",
                                                                remove_digits: true,
                                                                return_changed_case:true,
                                                                remove_duplicates: true
                                                             });

  var wordsWithSpecialCharacters = [];
  var filteredWordsLength = filteredWords.length;
  for (var i = 0; i< filteredWordsLength; i++) {
  	var regx = /^[A-Za-z#]+$/;
    	if (!regx.test(filteredWords[i])) {
    		wordsWithSpecialCharacters.push(filteredWords[i]);
    	}
  }

  console.log("wordsWithSpecialCharacters: ", wordsWithSpecialCharacters);

	filteredWords = filteredWords.filter( function(word) {
		return wordsWithSpecialCharacters.indexOf( word ) < 0;
	});

	console.log("filteredWords final: ", filteredWords);

  //Get article title & body from DB entry for title passed in
  res.render('map', { title: 'Map a Tweet', tweetUser: 'Aaron', tweetText: tweetText, 
  	tweetPlace: 'NYC, New York', tweetTime: '2:00 PM Oct 15 2015', 
  	tokens:filteredWords });
  
});

router.post('/', function(req, res) {
	var theme = req.body.theme; //Title from webpage body
	theme = theme.toLowerCase();
	var relatedTerms = JSON.parse(req.body.relatedTerms);

	var relatedTermsLength = relatedTerms.length;
	for (var i = 0; i < relatedTermsLength; i++) {
		relatedTerms[i] = relatedTerms[i].toLowerCase();
	} 

	console.log("theme: ", theme);
	console.log("relatedTerms: ", relatedTerms);
});

module.exports = router;