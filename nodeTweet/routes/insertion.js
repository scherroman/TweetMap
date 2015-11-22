var r = require('rethinkdb');
var request = require('request-json');

//Var to make requests to Solr
var solrRequestClient = request.createClient('http://' + hosts.solrServer + ':8983/');

//Lets assume the array of relatedTerms is already formatted properly
var rTerms = null;
//Lets also assume we have the theme in a var, formatted for an exact match in Solr. MAKE SURE SCHEMA REQUESTS EXACT MATCH
var themeForQuery = null;

var solrUrl = 'solr/articles/query?q=' + themeForQuery + '&rows=1000';

solrRequestClient.get(solrUrl, function solrRequestQuery(error, response, body) {
	
	if (!error && response.statusCode == 200) {
		
		//THERE ARE 2 POSSIBILITIES: TERM EXISTS OR IT DOESNT (numFound == 0 or numFound == 1)
		var nmFound = body.response.numFound;

		//IF TERM DOESNT EXIST ON SOLR, IT DOESNT EXIST. WE MUST ADD IT TO DB AND INDEX ON SOLR
		if (nmFound === 0) {

			//We establish connection to DB
			r.connect( {host: 'localhost', port: 28015}, function(err, conn) {

				if (err) throw err;

				//We insert to DB
				r.db('NodeTweet').table('terms').insert(
					{term:themeForQuery, relatedTerms:rTerms}).run(conn, function(err, result) {
						//where rTerms has following format: [{term:term, count:0}, ....]
						if (err) throw err;

						//Result will contain the UUID assigned to new term (theme)
						//NOW WE HAVE TO INDEX ON SOLR FOR FUTURE RETRIEVAL OR UUID
						var newUUID = result.generated_keys[0];

						var data = {
							term: theme,
							uuid: newUUID
						};
						//REPLACE ARTICLES WITH CORE NAME
						var solrUrlPOST = 'solr/articles/update/json/docs?commit=true'

						solrRequestClient.post(solrUrlPOST, data, function(err, response, body) {

							if (err) {
								return console.error('post failed:' err);
							}
						})//Closing bracket for Solr POST REQUEST
				})//Closing bracket for insertion
			})//Closing bracket for DB connection
		}//Closing bracket for else(non previously existing theme)
		//NOW WE MUST ACCOUNT FOR THE INSTANCES WHERE THE TERM DOES EXIST ALREADY
		else {
			//this variable should have the uuid from the object (doc) that was in the following format: {term:theme, relatedTerms:[{term:term, count:0}], uuid:uuid}
			var uuidToRetrive = body.response.doc[0].uuid;

			//BEFORE ACCESS, WE MUST MAKE CONNECTION TO DB
			r.connect( {host: 'localhost', port: 28015}, function(err, conn) {
				if (err) throw err;
				/*ATTEMPT TO USE RETHINKDB TO NOT WRITE AS MUCH CODE BUT LIMITED BY .update's CAPABILITIES
				for(i = 0; i < relatedTerms.length; i++) {

				r.db('NodeTweet').table('terms').get(uuidToRetrive).update(
				{relatedTerms: r.row.term(relatedTerms[i]).add(1).default(1)}
				).run(conn, function(err, result) {
					if (err) throw err;
				})//Closing bracket of update

				}//End of for-loop
				*/
				//HERE WE MUST ACCESS DB USING UUID FOR RETRIEVAL OF RELATED TERMS
				r.db('NodeTweet').table('terms').get(uuidToRetrive).run(conn, function(err, theme) {
					if (err) throw err;

					//HERE WE MUST UPDATE THE RELATED TERMS ARRAY TO UPDATE COUNT AND THEN UPDATE FIELD OF OBJECT IN DB
					var arrayFromDB = theme.relatedTerms;
					for(i = 0; i < rTerms.length; i++) {
						var wasFound = false;
						for(j = 0; j < arrayFromDB.length; j++) {
							if(arrayFromDB[j].term === rTerms[i].term) { //rTerms MIGHT NEED TO BE REFORMATTED
								arrayFromDB[j].count++;
								wasFound = true;
							}
						}
						if(!wasFound){
							var newRelatedTerm = {term:rTerms[i], count:1};
							arrayFromDB.push(newRelatedTerm);
						}
					}
					//arrayFromDB WAS UPDATED SO WE HAVE TO UPDATE IT IN DB

					r.db('NodeTweet').table('terms').get(uuidToRetrive).update({relatedTerms: arrayFromDB})
					.run(conn, function(err, theme) {
						if (err) throw err;
					})//Closing bracket of DB update
				})//Closing bracket for access to DB for theme retrieval 
			})//Closing bracket for DB connection
		}//Closing bracket for already existing theme
	}//Closing bracket for if (!error && response.statusCode == 200) {
})//Closing bracket for Solr theme query
