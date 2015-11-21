var r = require('rethinkdb');
var request = require('request-json');

var searchTerm = null;

//FIRST WE MUST QUERY SOLR FOR TERM TO OBTAIN UUID FOR DB

//Var to make GET request to Solr
var solrRequestClient = request.createClient('http://' + hosts.solrServer + ':8983/');

//String manipulation for Solr query where term:searchTerm
var solrUrl = 'solr/articles/query?q=' + searchRequest + '&rows=10'

//Solr GET request
solrRequestClient.get(solrUrl, function solrRequestQuery(error, response, body) {

	//What we do if we successfuly make the query
	if (!error && response.statusCode == 200) {

		// body.response.docs now contains the JSON with format {term:term, uuid:uuid, relatedTerms: {r1, r2, r3...}}
		var uuid = body.response.docs.uuid;

		//NOW THAT WE HAVE UUID, WE MUST LOOK FOR RELATED TERMS ON DB
		//Establishing connection to DB
		r.connect( {host:'localhost', port: 28015}, function(err, conn) {
			if (err) throw err;

			//NOW THAT CONNECTION WAS ESTABLISHED, WE HAVE TO ACCESS DB
			r.db('NodeTweet').table('terms').get(uuid).run(conn, function(err, theme){
				if (err) throw err;
				//Format of theme should be the following: {term:theme, relatedTerms:[{rTerm:rTerm, count:0}], uuid:uuid}
				//Here we must format relatedTerms based on weight for Solr query

				/*
				theme should be in the following format: {term:theme, relatedTerms:[{rTerm:rTerm, count:0}], uuid:uuid}
				HERE WE HAVE TO ORGANIZE THE RELATED TERMS IN AN ARRAY BASED ON COUNT
				WHERE THE FIRST ELEMENT HAS THE HIGHEST COUNT TO BE FORMATTED INTO SOLR RETRIEVAL
				For instance: (source: http://stackoverflow.com/questions/3088907/in-solr-can-i-apply-a-boost-to-each-term-in-a-phrase)
				"The quick brown fox jumped over the lazy dog."
				bq=(title:The)^1&bq=(title:quick)^2&bq=(title:brown)^2
				where bq = boostQuery and is used for ranking of terms
				*/

				var numRelatedTerms = theme.relatedTerms.length;

				var sortedRelatedTerms = theme.relatedTerms;
				
				/*
				compare is similar to the compareTo function in Java, it allows for custom sort functions.
				where a,b are elements of the array. Reference: http://stackoverflow.com/questions/6567941/how-does-sort-function-work-in-javascript-along-with-compare-function
				*/
				sortedRelatedTerms.sort(function compare(a,b) {
					return b.count - a.count;
				})//Closing bracket of compare function
				//NOW THAT TERMS ARE SORTED BASED ON COUNT (descending order), WE MUST FORMAT STRING TO PERFORM SOLR QUERY
				//This is an example of a final URL: http://localhost:8983/solr/articles/query?q=title:New%20York&q=Southern&defType=edismax&bq=Southern^5&debugQuery=true
				//where the exponent of bq denotes how much each term is boosted by (default of 1). To "negate" a term: (*:* -xxx)^999  you boost everything but the term
				//Since each term must be added to the "queries" and to the "boost queries", 2 strings should be concatenated for final result
				var q = null;
				var bq = null;
				for(i = 0; i < sortedRelatedTerms.length; i++) {
					if(i != sortedRelatedTerms.length-1) {
						bq = "bq=text:" + sortedRelatedTerms[i].term + "^" + sortedRelatedTerms[i].count + "&";
					}
					else {
						bq = "bq=text:" + sortedRelatedTerms[i].term + "^" + sortedRelatedTerms[i].count;
					}
					q = "q=text:" + sortedRelatedTerms[i].term + "&";
				}//Closing bracket of for-loop
				//q and bg are formatted, so now we have to format into URL for query
				var relatedTermsSolrUrl = 'solr/articles/query?' + q + bq;

				//NOW WE MUST PERFORM SOLR QUERY FOR UUIDs OF TWEETS
				solrRequestClient.get(relatedTermsSolrUrl, function solrRequestQuery(error, response, body) {
					if (!error && response.statusCode == 200) {

						//array of objects with UUIDs
						var tweetsToObtain = body.response.docs;
						
						//String to render
						var tweetsToShow = "[ ";

						for(i = 0; i < tweetsToObtain.length; i++) {

							var currentUUID = JSON.stringify(tweetsToObtain[i].uuid);
							
							//HERE WE OBTAIN EACH OF THE TWEETS TO FORMAT INTO ARRAY
							r.db('NodeTweet').table('terms').get(currentUUID).run(conn, function(err, tweet) {
								if (err) throw err;
								
								if(i === tweetsToObtain.length-1) {
									tweetsToShow += JSON.stringify(tweet) + "]";
								}
								else {
									tweetsToShow += JSON.stringify(tweet) + ",";
								}

							})//Closing bracket of DB access for tweet
						}//Closing bracket of for-loop

						//HERE tweetsToShow HAS THE ARRAY OF TWEETS TO DISPLAY
						res.setHeader('content-type', 'application/vnd.api+json');
						res.end(JSON.stringify(response));
					}//Closing bracket of "if (!error && response.statusCode == 200)"
				})//Closing bracket for Solr query for tweets with related terms
			})//Closing bracket of DB access for related terms
		})//Closing bracket of DB connection
	}//closing bracket of "if (!error && response.statusCode == 200)"
}//closing bracket of solrRequestClient