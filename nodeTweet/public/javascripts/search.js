var TWEET_REQUEST_COUNT = 10;

//searchButton click
$(document).ready(function(){
    $(".searchButton").click(function(){

    	// console.log("Sender: ", $(this));

    	var searchQuery = {
    		type: null,
    		tweetStartingIndex: 0,
    		numTweetsRequested: TWEET_REQUEST_COUNT
    	};

    	//Term Search
    	if($(this).attr('id') == 'searchTermButton') {

    		var term = $('#search-query').val();
    		term = $.trim(term);
    		term = term.toLowerCase();

    		searchQuery.type = 'termSearch';
    		searchQuery.term = term;
    	}
    	//Theme Search
    	else if ($(this).attr('id') == 'searchThemeButton') {

    		var theme = $('#search-query').val();
    		theme = $.trim(theme);
    		theme = theme.toLowerCase();

    		searchQuery.type = 'termSearch';
    		searchQuery.theme = theme;
    	}

    	console.log("SearchQuery: ", searchQuery);

    	if (searchQuery.type != null) {
	    	//Send the theme & related terms to the server
	        $.ajax({
	            url: window.location.pathname,
	            type: "GET",
	            data: {searchQuery: searchQuery},
	            dataType: "json",
	            success: function (result) {
	                console.log(result);
	            },
	            error: function (xhr, ajaxOptions, thrownError) {
	            	console.log("Ajax request failure");
	                console.log(xhr.status);
	            }
	        });
	    }
    });
});