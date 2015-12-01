var express = require('express');
var router = express.Router();
var r = require('rethinkdb');
var url = require('url');
var request = require('request-json');
var hosts = require('../hosts');
var async = require('async');
var moment = require('moment-timezone');

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

	console.log("Search Query: ", req.query); //e.g. {"input":"sports","type":"theme","count":"0"}

	var searchInput = req.query.input;
	var searchType = req.query.type;
	var tweetStartingIndex = req.query.count;
	console.log("Search input: ", searchInput);

	if (searchType === TERM_SEARCH) {
		console.log("Term search: ", searchInput);
		console.log("tweetStartingIndex: ", tweetStartingIndex);

		var sorlUrl = "solr/tweets/query?q=" + searchInput + "&rows=" + NUM_TWEETS_TO_RETURN + "&start=" + tweetStartingIndex;

		//Solr GET request
		solrRequestClient.get(solrUrl, function solrRequestQuery(error, response, body) {
			console.log("Solr GET request to obtain UUID of tweets based on term.");
			if (!error && response.statusCode == 200) {
				//array of objects with UUIDs
				var tweetsToObtain = body.response.docs;
				
				//String to render
				var tweetsToShow = [];

				//async IS USED TO USE A CALLBACK DURING ITERATION TO ASSIGN VALUES TO tweetsToShow
				async.each(tweetsToObtain, function(currentSearchResult, callback) {
					r.db('NodeTweet').table('tweets').get(currentSearchResult.id).run(conn, function(err, tweet) {
						if (err) throw err;

						tweetsToShow.push(tweet);
						return callback(null);

					});
				}, function(err) {
					console.log("Finished multiple DB calls to put all tweetsToShow into an array.");
					var topRelatedTerms = [];

					//format dates using moment
					dateFormatter(tweetsToShow);
					//enable/disable pagination accordingly
					var nextTweetsAvailable = (body.response.numFound > NUM_TWEETS_TO_RETURN);
						var prevTweetsAvailable = (tweetStartingIndex > 0);

					//HERE tweetsToShow IS THE ARRAY OF TWEETS TO DISPLAY
					res.render('search', { "title": 'Search for Tweets', 
									 "searchResultsToRender": true,
									 "numTotalTweets": body.response.numFound, 
									 "topRelatedTerms": topRelatedTerms,
									 "tweets": tweetsToShow,
									 "prevTweetsAvaialable": prevTweetsAvailable,
									 "nextTweetsAvailable": nextTweetsAvailable,
									 "type": searchType,
									 "searchInput": searchInput
					});//Closing bracket of callback to call when iterator of async is done
				});//Closing bracket of async call
			}
		});
	}
	else if (searchType === THEME_SEARCH)  {
		console.log("Theme search: ", ssearchInput);
		console.log("tweetStartingIndex: ", tweetStartingIndex);

		//String manipulation for Solr query where term:searchTerm
		var solrUrl = 'solr/terms/query?q=' + searchInput;

		//Solr GET request
		solrRequestClient.get(solrUrl, function solrRequestQuery(error, response, body) {
			console.log("Solr GET request to obtain UUID of theme.");
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
						console.log("Accessed DB for theme to obtain relatedTerms");
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
						var relatedTermsSolrUrl = 'solr/tweets/query?q=text%3A' + q + bq + "&rows=" + NUM_TWEETS_TO_RETURN + "&start=" + tweetStartingIndex;
						console.log("relatedTermsSolrUrl: " + relatedTermsSolrUrl);
						//NOW WE MUST PERFORM SOLR QUERY FOR UUIDs OF TWEETS
						solrRequestClient.get(relatedTermsSolrUrl, function solrRequestQuery(error, response, body) {
							if (!error && response.statusCode == 200) {
								console.log("Solr GET request to obtain UUIDs of tweets after query based on relatedTerms.");
								//array of objects with UUIDs
								var tweetsToObtain = body.response.docs;
								
								//String to render
								var tweetsToShow = [];

								//async IS USED TO USE A CALLBACK DURING ITERATION TO ASSIGN VALUES TO tweetsToShow
								async.each(tweetsToObtain, function(currentSearchResult, callback) {
									r.db('NodeTweet').table('tweets').get(currentSearchResult.id).run(conn, function(err, tweet) {
										if (err) throw err;

										tweetsToShow.push(tweet);
										return callback(null);

									});
								}, function(err) {
									console.log("Finished multiple DB calls to put all tweetsToShow into an array.");
									var topRelatedTerms = [];
									//for-loop to format topRelatedTerms into array of Strings, not JSON
									for(i = 0; i < sortedRelatedTerms.length; i++) {// && i < 10; i++) {
										topRelatedTerms.push(sortedRelatedTerms[i].term);
									}
									//format dates using moment
									dateFormatter(tweetsToShow);
									//enable/disable pagination accordingly
									var nextTweetsAvailable = (body.response.numFound > NUM_TWEETS_TO_RETURN);
	 								var prevTweetsAvailable = (tweetStartingIndex > 0);

									//HERE tweetsToShow IS THE ARRAY OF TWEETS TO DISPLAY
									res.render('search', { "title": 'Search for Tweets', 
													 "searchResultsToRender": true,
													 "numTotalTweets": body.response.numFound, 
													 "topRelatedTerms": topRelatedTerms,
													 "tweets": tweetsToShow,
													 "prevTweetsAvaialable": prevTweetsAvailable,
													 "nextTweetsAvailable": nextTweetsAvailable,
													 "type": searchType,
													 "searchInput": searchInput
									});//Closing bracket of callback to call when iterator of async is done
								});//Closing bracket of async call
							}//Closing bracket of "if (!error && response.statusCode == 200)"
						})//Closing bracket for Solr query for tweets with related terms
					})//Closing bracket of DB access for related terms
				})//Closing bracket of DB connection
			}//Closing bracket of "if (!error && response.statusCode == 200)"
		})//Closing bracket of Solr GET request to obtain uuid of theme
	}//Closing bracket for "else if (searchType === THEME_SEARCH)  {"
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

function dateFormatterSingle(tweet) {
  var d = new Date(parseInt(tweet.timestamp_ms));
 
  var myEDTString = moment(d.toUTCString()).tz('America/New_York').format("h:m A - D MMM YYYY")

  tweet.timestamp_ms = myEDTString;
}

module.exports = router;