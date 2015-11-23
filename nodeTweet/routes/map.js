var express = require('express');
var router = express.Router();
var r = require('rethinkdb');
var url = require('url');
var request = require('request-json');
var hosts = require('../hosts');
var keyword_extractor = require("keyword-extractor");

//Var to make requests to Solr
var solrRequestClient = request.createClient('http://' + hosts.solrServer + ':8983/');
// var solrRequestClient = request.createClient('http://localhost:8983/');

/* GET home page. */
router.get('/', function(req, res, next) {

  // var tweetText = "Praise & the Lord$ almighty| in the house, Of God. | Praise Jesus oh lordy.";
  // var tweetText = "'06 NFL MVP 31 TD's in 1 season 5th leading rusher";
  // var tweetText = "Sources: #BlueJays acquire #Athletics’ Jesse Chavez.";
  var tweetText = "In other news, my edges are laid, my skin is poppin and I'm educated...shout out to my parents for these genes🙌🏽😂";

  var filteredWords = keyword_extractor.extract(tweetText,{
                                                            language:"english",
                                                            remove_digits: true,
                                                            return_changed_case:true,
                                                            remove_duplicates: true
                                                          });

  //Remove words with special characters from the filteredWords array
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

	console.log("theme: ", theme); // theme: family
	console.log("relatedTerms: ", relatedTerms); //relatedTerms: [ 'skin', 'news', 'parents' ]

  var rTerms = relatedTerms;
  
  var themeForQuery = theme;

  var solrUrl = 'solr/terms/query?q=' + themeForQuery;

  solrRequestClient.get(solrUrl, function solrRequestQuery(error, response, body) {
    
    if (!error && response.statusCode == 200) {

      //THERE ARE 2 POSSIBILITIES: TERM EXISTS OR IT DOESNT (numFound == 0 or numFound == 1)
      var nmFound = body.response.numFound;

      //IF TERM DOESNT EXIST ON SOLR, IT DOESNT EXIST. WE MUST ADD IT TO DB AND INDEX ON SOLR
      if (nmFound === 0) {

        //We establish connection to DB
        r.connect( {host: 'localhost', port: 28015}, function(err, conn) {

          if (err) throw err;

          var jsonRelatedTerms = [];
          for(i = 0; i < rTerms.length; i++) {
              var jsonTerm = {term:rterms[i], count:1}
              jsonRelatedTerms.push(jsonTerm)
          }
          //We insert to DB
          r.db('NodeTweet').table('terms').insert(
            {term:themeForQuery, relatedTerms:jsonRelatedTerms}).run(conn, function(err, result) {
              //where rTerms has following format: [{term:term, count:0}, ....]
              if (err) throw err;

              //Result will contain the UUID assigned to new term (theme)
              //NOW WE HAVE TO INDEX ON SOLR FOR FUTURE RETRIEVAL OR UUID
              var newUUID = result.generated_keys[0];

              var data = {
                term: theme,
                id: newUUID
              };
              //where terms is the core name
              var solrUrlPOST = 'solr/terms/update/json/docs?commit=true'

              solrRequestClient.post(solrUrlPOST, data, function(err, response, body) {

                if (err) {
                  return console.error('post failed:', err);
                }
                console.log(body)
              })//Closing bracket for Solr POST REQUEST
          })//Closing bracket for insertion
        })//Closing bracket for DB connection
      }//Closing bracket for else(non previously existing theme)
      //NOW WE MUST ACCOUNT FOR THE INSTANCES WHERE THE TERM DOES EXIST ALREADY
      else {
        //this variable should have the uuid from the object (doc) that was in the following format: {term:theme, relatedTerms:[{term:term, count:0}], uuid:uuid}
        var uuidToRetrive = body.response.docs[0].id;

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
                if(arrayFromDB[j].term === rTerms[i]) { 
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

            r.db('NodeTweet').table('terms').get(uuidToRetrive).update(
              {relatedTerms: arrayFromDB})
            .run(conn, function(err, result) {
              if (err) throw err;

              console.log(result)
            })//Closing bracket of DB update
          })//Closing bracket for access to DB for theme retrieval 
        })//Closing bracket for DB connection
      }//Closing bracket for already existing theme
    }//Closing bracket for if (!error && response.statusCode == 200) {
  })//Closing bracket for Solr theme query
});//Closing bracket for post request

module.exports = router;