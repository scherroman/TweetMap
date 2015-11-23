var TERM_SEARCH = 'term'
var THEME_SEARCH = 'theme'

var tweetIndexCount = 0;

//searchButton click
$(document).ready(function(){
    $(".searchButton").click(function(){

    	// console.log("Sender: ", $(this));

    	var searchQuery = {
    		type: null,
            input: null,
    		count: -1,
    	};

    	//Term Search
    	if($(this).attr('id') == 'searchTermButton') {

    		var term = $('#search-query').val();
    		term = $.trim(term);
    		term = term.toLowerCase();

    		searchQuery.type = TERM_SEARCH;
    		searchQuery.input = term;
            searchQuery.count = 0;
    	}
    	//Theme Search
    	else if ($(this).attr('id') == 'searchThemeButton') {

    		var theme = $('#search-query').val();
    		theme = $.trim(theme);
    		theme = theme.toLowerCase();

    		searchQuery.type = THEME_SEARCH;
    		searchQuery.input = theme;
            searchQuery.count = 0;
    	}

    	console.log("SearchQuery: ", searchQuery);

    	if (searchQuery.type) {

            //Form query      
            var query = $.param({
                type: searchQuery.type, 
                input: searchQuery.input,
                count: searchQuery.count
            });

            //Reload page with query
            var url = [location.protocol, '//', location.host, location.pathname].join('');
            url = url.concat("?").concat(query);
            window.location.href = url;

	    	//Send the theme & related terms to the server
	        // $.ajax({
	        //     url: window.location.pathname,
	        //     type: "GET",
	        //     data: {searchQuery: searchQuery},
	        //     dataType: "json",
         //        error: function (xhr, ajaxOptions, thrownError) {
         //            console.log("Ajax request failure");
         //            console.log(xhr.status);
         //        },
	        //     success: function (result) {
	        //         // console.log(result);
         //         //    console.log(":tweets: ", result.tweets);

         //         //    var tweets = result.tweets;
         //         //    var numTweetsReturned = tweets.length;
         //         //    var numTotalTweets = result.numTotalTweets;

         //         //    if (tweets) {
         //         //        if (numTotalTweets > 0) {

         //         //            if (tweets.length > 0) {

         //         //            }
         //         //            else {
         //         //                //No more tweets to display
         //         //            }
         //         //        }
         //         //        else {
         //         //            //Search returned zero tweets
         //         //        }
         //         //    }
         //         //    else {
         //         //        console.log("Error retrieving tweets from server: received null for tweets");
         //         //    }
	        //     }
	        // });
	    }
    });
});