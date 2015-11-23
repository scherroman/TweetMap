var r = require('rethinkdb');
var request = require('request-json');

var searchTerm = null;

//FIRST WE MUST QUERY SOLR FOR TERM TO OBTAIN UUID FOR DB

//Var to make GET request to Solr
var solrRequestClient = request.createClient('http://' + hosts.solrServer + ':8983/');

//String manipulation for Solr query where term:searchTerm
var solrUrl = 'solr/terms/query?q=' + searchRequest + '&rows=10'

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
						bq = bq + sortedRelatedTerms[i].term + "%5" + sortedRelatedTerms[i].count + "+AND+";
						q = q + sortedRelatedTerms[i] + "+OR+";
					}
					else {
						bq = sortedRelatedTerms[i].term + "%5" + sortedRelatedTerms[i].count;
						q = q + sortedRelatedTerms[i] + ")&";
					}
				}//Closing bracket of for-loop
				//q and bg are formatted, so now we have to format into URL for query
				var relatedTermsSolrUrl = 'solr/tweets/query?q=text%3A' + q + bq;

				//NOW WE MUST PERFORM SOLR QUERY FOR UUIDs OF TWEETS
				solrRequestClient.get(relatedTermsSolrUrl, function solrRequestQuery(error, response, body) {
					if (!error && response.statusCode == 200) {

						//array of objects with UUIDs
						var tweetsToObtain = body.response.docs;
						
						//String to render
						var tweetsToShow = [];

						for(i = 0; i < tweetsToObtain.length; i++) {

							var currentUUID = tweetsToObtain[i].id;
							
							//HERE WE OBTAIN EACH OF THE TWEETS TO FORMAT INTO ARRAY
							r.db('NodeTweet').table('tweets').get(currentUUID).run(conn, function(err, tweet) {
								if (err) throw err;
								
								tweetsToShow.push(tweet);

							})//Closing bracket of DB access for tweet
						}//Closing bracket of for-loop
						dateFormatter(tweetsToShow);
						//HERE tweetsToShow IS THE ARRAY OF TWEETS TO DISPLAY
						res.setHeader('content-type', 'application/vnd.api+json');
						res.end(JSON.stringify(response));
					}//Closing bracket of "if (!error && response.statusCode == 200)"
				})//Closing bracket for Solr query for tweets with related terms
			})//Closing bracket of DB access for related terms
		})//Closing bracket of DB connection
	}//Closing bracket of "if (!error && response.statusCode == 200)"
}//Closing bracket of solrRequestClient

function dateFormatter(tweetArray) {
/*tweetArray will be filled with tweets in the following format: 
{ "id": "4c6d3a58-7402-4b1a-9dd8-de7ee36a05f3" , 
"place": "New York, USA" , 
"text": "My boy Bieber just followed me on Twitter. Today is a good day https://t.co/2OfU6JMabX" , 
"timestamp_ms": "1447105319795" , "user": "HAleYeAhh" }
We want time to be in the following format: 8:33 PM - 22 Nov 2015
*/
	for(i = 0; i < tweetArray.length; i++) {
		var d = new Date(parseInt(tweetArray[i].timestamp_ms));
		var time = d.toLocaleTimeString(); // 12:29:41 AM
		time = time.substring(0, time.lastIndexOf(':')) + " " + time.substring(time.length-2); // 12:29 PM

		var date = d.toLocaleDateString(); // 11/23/2015
		date = d.substring(d.indexOf("/")+1, d.lastIndexOf("/")) + " "; // 23 
		date = date + monthConvert(d.substring(0, d.indexOf("/"))) + " "; // 23 Nov 
		date = date + d.substring(d.lastIndexOf("/")); // 23 Nov 2015

		var finalDate = time + " - " + date;
		tweetArray[i].timestamp_ms = finalDate;
}
function monthConvert(m){
	if(m === 1)
		return "Jan";
	else if (m === 2)
		return "Feb";
	else if (m === 3)
		return "Mar";
	else if (m === 4)
		return "Apr";
	else if (m === 5)
		return "May";
	else if (m === 6)
		return "Jun";
	else if (m === 7)
		return "Jul";
	else if (m === 8)
		return "Aug";
	else if (m === 9)
		return "Sep";
	else if (m === 10)
		return "Oct";
	else if (m === 11)
		return "Nov";
	else return "Dec";
}