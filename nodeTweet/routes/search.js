var express = require('express');
var router = express.Router();
var r = require('rethinkdb');
var url = require('url');
var request = require('request-json');
var hosts = require('../hosts');

var TERM_SEARCH = 'term';
var THEME_SEARCH = 'theme';
var NUM_TWEETS_TO_RETURN = 20;

var solrRequestClient = request.createClient('http://' + hosts.solrServer + ':8983/');


/* GET home page. */
router.get('/', function(req, res, next) {

  //Check for search request
  if (req.query.input) {
  	console.log("Received Search Request.");
  	handleSearchRequest(req, res, next);
  }
  else {
  	//Get article title & body from DB entry for title passed in
  	res.render('search', { "title": 'Search for Tweets', "searchResultsToRender": false});
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


		var solrRequestClient = request.createClient('http://' + hosts.solrServer + ':8983/');

		//String manipulation for Solr query where term:searchTerm
		var solrUrl = 'solr/terms/query?q=' + searchInput;

		//Solr GET request
		solrRequestClient.get(solrUrl, function solrRequestQuery(error, response, body) {

			//What we do if we successfuly make the query
			if (!error && response.statusCode == 200) {

				// body.response.docs now contains the JSON with format {term:term, id:uuid, relatedTerms: {r1, r2, r3...}}
				var uuid = body.response.docs[0].id;

				//NOW THAT WE HAVE UUID, WE MUST LOOK FOR RELATED TERMS ON DB
				//Establishing connection to DB
				r.connect( {host:'localhost', port: 28015}, function(err, conn) {
					if (err) throw err;

					//NOW THAT CONNECTION WAS ESTABLISHED, WE HAVE TO ACCESS DB
					r.db('NodeTweet').table('terms').get(uuid).run(conn, function(err, theme){
						if (err) throw err;
						//Format of theme should be the following: {term:theme, relatedTerms:[{term:rTerm, count:0}], id:uuid}
						//Here we must format relatedTerms based on weight for Solr query

						/*
						theme should be in the following format: {term:theme, relatedTerms:[{term:rTerm, count:0}], id:uuid}
						HERE WE HAVE TO ORGANIZE THE RELATED TERMS IN AN ARRAY BASED ON COUNT
						WHERE THE FIRST ELEMENT HAS THE HIGHEST COUNT TO BE FORMATTED INTO SOLR RETRIEVAL
						For instance: (source: http://stackoverflow.com/questions/3088907/in-solr-can-i-apply-a-boost-to-each-term-in-a-phrase)
						"The quick brown fox jumped over the lazy dog."
						bq=(title:The)^1&bq=(title:quick)^2&bq=(title:brown)^2
						where bq = boostQuery and is used for ranking of terms
						*/

						var sortedRelatedTerms = theme.relatedTerms;
						
						/*
						compare is similar to the compareTo function in Java, it allows for custom sort functions.
						where a,b are elements of the array. Reference: http://stackoverflow.com/questions/6567941/how-does-sort-function-work-in-javascript-along-with-compare-function
						*/
						sortedRelatedTerms.sort(function compare(a,b) {
							return b.count - a.count;
						})//Closing bracket of compare function
						//NOW THAT TERMS ARE SORTED BASED ON COUNT (descending order), WE MUST FORMAT STRING TO PERFORM SOLR QUERY
						//This is an example of a final URL: http://localhost:8983/solr/tweets/query?q=text%3A(good+OR+day+OR+boy)&defType=edismax&bq=day%5E1000+AND+good%5E100+AND+boy%5E4000
						//where the exponent of bq denotes how much each term is boosted by (default of 1). To "negate" a term: (*:* -xxx)^999  you boost everything but the term
						//Since each term must be added to the "queries" and to the "boost queries", 2 strings should be concatenated for final result
						var q = "(";
						var bq = "defType=edismax&bq=";
						for(i = 0; i < sortedRelatedTerms.length; i++) {
							if(i != sortedRelatedTerms.length-1) {
								bq += sortedRelatedTerms[i].term + "^" + sortedRelatedTerms[i].count + "+AND+";
								q += sortedRelatedTerms[i].term + "+OR+";
							}
							else {
								bq += sortedRelatedTerms[i].term + "^" + sortedRelatedTerms[i].count;
								q += sortedRelatedTerms[i].term + ")&";
							}
						}//Closing bracket of for-loop
						//q and bg are formatted, so now we have to format into URL for query
						var relatedTermsSolrUrl = 'solr/tweets/query?q=text%3A' + q + bq;
						console.log("relatedTermsSolrUrl: " + relatedTermsSolrUrl);
						//NOW WE MUST PERFORM SOLR QUERY FOR UUIDs OF TWEETS
						solrRequestClient.get(relatedTermsSolrUrl, function solrRequestQuery(error, response, body) {
							if (!error && response.statusCode == 200) {

								//array of objects with UUIDs
								var tweetsToObtain = body.response.docs;
								
								//String to render
								var tweetsToShow = addTweetsToArray(tweetsToObtain);
								
								console.log("tweetsToShow: " + JSON.stringify(tweetsToShow));
								dateFormatter(tweetsToShow);
								var nextTweetsAvailable = true;
 								var prevTweetsAvaialable = true;
 								console.log("tweetsToShow: " + JSON.stringify(tweetsToShow));
 								console.log("sortedRelatedTerms: " + JSON.stringify(sortedRelatedTerms));
								//HERE tweetsToShow IS THE ARRAY OF TWEETS TO DISPLAY
								res.render('search', { "title": 'Search for Tweets', 
												 "searchResultsToRender": true,
												 "numTotalTweets": body.response.numFound, 
												 "topRelatedTerms": sortedRelatedTerms,
												 "tweets": tweetsToShow,
												 "prevTweetsAvaialable": prevTweetsAvaialable,
												 "nextTweetsAvailable": nextTweetsAvailable,
												 "type": searchType,
												 "searchInput": searchInput
								});
							}//Closing bracket of "if (!error && response.statusCode == 200)"
						})//Closing bracket for Solr query for tweets with related terms
					})//Closing bracket of DB access for related terms
				})//Closing bracket of DB connection
			}//Closing bracket of "if (!error && response.statusCode == 200)"
		})//Closing bracket of Solr GET request to obtain uuid of theme
	}//Closing bracket for "else if (searchType === THEME_SEARCH)  {"

	// tweetUser = 'Aaron';
	// tweetText =  "In other news, my edges are laid, my skin is poppin and I'm educated...shout out to my parents for these genes🙌🏽😂";
	// tweetPlace = 'NYC, New York';
	// tweetTime = '8:33 PM - 22 Nov 2015';

	// var numTotalTweets = 1000 //Test value
 //  var nextTweetsAvailable = true;
 //  var prevTweetsAvaialable = true;
	// topRelatedTerms = ['lion', 'cup', 'fool', 'andy', 'huh', 'what', 'gum'];
	// topRelatedTerms = topRelatedTerms.join(", ");


	// var tweet = {
	// 	user: tweetUser,
	// 	text: tweetText,
	// 	place: tweetPlace,
	// 	time: tweetTime
	// }

	// var tweets = [];

	// var numTweets = NUM_TWEETS_TO_RETURN; //test value
	// for (var i = 0; i < numTweets; i++) {
	// 	tweets[i] = tweet;
	// }

	// res.render('search', { "title": 'Search for Tweets', 
	// 											 "searchResultsToRender": true,
	// 											 "numTotalTweets": numTotalTweets, 
	// 											 "topRelatedTerms": topRelatedTerms,
	// 											 "tweets": tweets,
	// 											 "prevTweetsAvaialable": prevTweetsAvaialable,
	// 											 "nextTweetsAvailable": nextTweetsAvailable,
	// 											 "type": searchType,
	// 											 "searchInput": searchInput
	// 										 });
}
function dateFormatter(tweetArray) {
/*tweetArray will be filled with tweets in the following format: 
{ "id": "4c6d3a58-7402-4b1a-9dd8-de7ee36a05f3" , 
"place": "New York, USA" , 
"text": "My boy Bieber just followed me on Twitter. Today is a good day https://t.co/2OfU6JMabX" , 
"timestamp_ms": "1447105319795" , "user": "HAleYeAhh" }
We want time to be in the following format: 8:33 PM - 22 Nov 2015
*/
  for(i = 0; i < tweetArray.length; i++) {
    dateFormatterSingle(tweetArray[i]);
  }
}

function addTweetsToArray(tweet, tweetsToShow) {

	var tweetsToShow = [];

	for(i = 0; i < tweetsToObtain.length; i++) {

		var currentUUID = tweetsToObtain[i].id;
		
		//HERE WE OBTAIN EACH OF THE TWEETS TO FORMAT INTO ARRAY
		r.db('NodeTweet').table('tweets').get(currentUUID).run(conn, function(err, tweet) {
			if (err) throw err;
			console.log("Tweets from DB: " + JSON.stringify(tweet));
			
			tweetsToShow.push(tweet);

		})//Closing bracket of DB access for tweet
	}//Closing bracket of for-loop
}

function dateFormatterSingle(tweet) {
  var d = new Date(parseInt(tweet.timestamp_ms));
 
  var myEDTString = moment(d.toUTCString()).tz('America/New_York').format("h:m A - D MMM YYYY")

  tweet.timestamp_ms = myEDTString;
}

module.exports = router;